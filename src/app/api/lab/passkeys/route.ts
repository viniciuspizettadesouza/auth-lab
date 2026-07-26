import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { passkey, passkeyKind } from "@/db/schema";
import { auth } from "@/lib/auth";

async function currentUser(request: NextRequest) {
  return (await auth.api.getSession({ headers: request.headers }))?.user ?? null;
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const passkeys = await db
    .select({
      id: passkey.id,
      name: passkey.name,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      createdAt: passkey.createdAt,
      kind: passkeyKind.kind
    })
    .from(passkey)
    .leftJoin(passkeyKind, eq(passkeyKind.credentialID, passkey.credentialID))
    .where(eq(passkey.userId, user.id));
  return NextResponse.json({ passkeys });
}

const deleteSchema = z.object({ id: z.string().min(1).max(128) });

export async function DELETE(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid passkey." }, { status: 400 });
  }
  const [owned] = await db
    .select({ credentialID: passkey.credentialID })
    .from(passkey)
    .where(and(eq(passkey.id, parsed.data.id), eq(passkey.userId, user.id)))
    .limit(1);
  if (!owned) {
    return NextResponse.json({ error: "Passkey not found." }, { status: 404 });
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(passkeyKind)
      .where(eq(passkeyKind.credentialID, owned.credentialID));
    await tx
      .delete(passkey)
      .where(and(eq(passkey.id, parsed.data.id), eq(passkey.userId, user.id)));
  });
  return NextResponse.json({ status: true });
}
