import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  isDpopPublicJwk,
  issueDpopGrant
} from "@/features/session-token/server/dpop";
import { auth } from "@/lib/auth";

const bodySchema = z.object({ publicJwk: z.record(z.string(), z.unknown()) });

export async function POST(request: NextRequest) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success || !isDpopPublicJwk(parsed.data.publicJwk)) {
    return NextResponse.json({ error: "A valid P-256 public key is required." }, { status: 400 });
  }
  const grant = await issueDpopGrant({
    publicJwk: parsed.data.publicJwk,
    sessionId: current.session.id,
    userId: current.user.id
  });
  return NextResponse.json(grant, {
    status: 201,
    headers: { "cache-control": "no-store" }
  });
}
