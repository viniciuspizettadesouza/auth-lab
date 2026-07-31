import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  scenario: z.enum([
    "valid",
    "revoked-card",
    "expired-certificate",
    "removed-directory-user",
    "stale-group"
  ])
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid smartcard scenario." }, { status: 400 });
  }
  const checks = [
    "local activation occurred on the card reader",
    "certificate chain anchors to the enterprise trust store",
    "certificate validity and revocation status accepted",
    "certificate subject maps to one active directory entry",
    "directory groups map to an allowed application role"
  ];
  const failures = {
    "revoked-card": "The certificate revocation check rejected this card.",
    "expired-certificate": "The card certificate is outside its validity period.",
    "removed-directory-user": "The directory identity is disabled or removed.",
    "stale-group": "No current directory group maps to application access."
  } as const;
  if (parsed.data.scenario !== "valid") {
    return NextResponse.json(
      {
        checks: checks.slice(0, Math.max(1, checks.length - 1)),
        reason: failures[parsed.data.scenario],
        sessionCreated: false
      },
      { status: 400 }
    );
  }
  return NextResponse.json({
    checks,
    sessionCreated: false,
    result:
      "All modeled checks passed. This simulation never accepts a PIN, certificate, private key, or directory credential."
  });
}
