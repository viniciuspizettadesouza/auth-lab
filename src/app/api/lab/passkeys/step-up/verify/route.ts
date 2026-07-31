import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifySecurityKeyStepUp } from "@/features/passkey/server/step-up";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  response: z.record(z.string(), z.unknown())
});

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid WebAuthn response." }, { status: 400 });
  }
  const result = await verifySecurityKeyStepUp({
    challengeId: parsed.data.challengeId,
    origin: request.headers.get("origin"),
    response: parsed.data.response as unknown as AuthenticationResponseJSON,
    userId: session.user.id,
    sessionId: session.session.id
  });
  if (!result.ok) {
    const status = result.reason === "expired-or-replayed" ? 409 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({
    verified: true,
    assurance: "phishing-resistant",
    purpose: "security-key-step-up"
  });
}
