import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json() as { scenario?: unknown };
  if (body.scenario === "valid") {
    return NextResponse.json({
      accepted: true,
      checks: [
        "signed assertion",
        "expected issuer",
        "audience restriction",
        "destination",
        "InResponseTo correlation",
        "NotBefore / NotOnOrAfter",
        "single-use assertion ID"
      ],
      sessionCreated: false
    });
  }
  if (body.scenario === "wrong-audience" || body.scenario === "expired") {
    return NextResponse.json(
      {
        accepted: false,
        reason:
          body.scenario === "wrong-audience"
            ? "AudienceRestriction does not name this service provider."
            : "NotOnOrAfter has passed."
      },
      { status: 401 }
    );
  }
  return NextResponse.json({ error: "Invalid simulation scenario." }, { status: 400 });
}
