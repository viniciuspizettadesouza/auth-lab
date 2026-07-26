import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { account } from "@/db/schema";
import { LOCAL_OIDC_PROVIDER_ID } from "@/features/federation/server/config";
import { auth } from "@/lib/auth";

async function owner(request: NextRequest) {
  return (await auth.api.getSession({ headers: request.headers }))?.user ?? null;
}

export async function GET(request: NextRequest) {
  const user = await owner(request);
  if (!user) return NextResponse.json({ accounts: [] });
  const accounts = await db
    .select({
      id: account.id,
      accountId: account.accountId,
      providerId: account.providerId,
      createdAt: account.createdAt
    })
    .from(account)
    .where(eq(account.userId, user.id));
  return NextResponse.json({
    accounts: accounts.map((item) => ({
      ...item,
      label:
        item.providerId === LOCAL_OIDC_PROVIDER_ID
          ? "Local OpenID Provider"
          : item.providerId === "credential"
            ? "Email and password"
            : item.providerId
    }))
  });
}

export async function DELETE(request: NextRequest) {
  const user = await owner(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json() as { id?: unknown };
  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid account." }, { status: 400 });
  }
  const accounts = await db
    .select({
      id: account.id,
      accountId: account.accountId,
      providerId: account.providerId
    })
    .from(account)
    .where(eq(account.userId, user.id));
  const selected = accounts.find(
    (item) => item.id === body.id && item.providerId === LOCAL_OIDC_PROVIDER_ID
  );
  if (!selected) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (accounts.length < 2) {
    return NextResponse.json(
      { error: "Link another sign-in method before unlinking the last account." },
      { status: 409 }
    );
  }
  try {
    await auth.api.unlinkAccount({
      headers: request.headers,
      body: {
        providerId: selected.providerId,
        accountId: selected.accountId
      }
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "A fresh authenticated session is required to unlink." },
      { status: 401 }
    );
  }
}
