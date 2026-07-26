import { NextRequest, NextResponse } from "next/server";

import { createSecurityKeyStepUp } from "@/features/passkey/server/step-up";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const result = await createSecurityKeyStepUp(session.user.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Register a roaming security key before requesting step-up." },
      { status: 409 }
    );
  }
  return NextResponse.json({
    challengeId: result.id,
    expiresAt: result.expiresAt,
    options: result.options
  });
}
