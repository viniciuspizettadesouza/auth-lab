import { NextRequest, NextResponse } from "next/server";

import { consumeDpopGrant } from "@/features/session-token/server/dpop";

function accessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, value] = authorization.split(" ");
  return scheme === "DPoP" && value ? value : null;
}

export async function GET(request: NextRequest) {
  const token = accessToken(request);
  const proof = request.headers.get("dpop");
  if (!token || !proof) {
    return NextResponse.json(
      { error: "A DPoP access token and proof are required." },
      { status: 401 }
    );
  }
  const result = await consumeDpopGrant({
    accessToken: token,
    method: "GET",
    proof,
    uri: `${request.nextUrl.origin}${request.nextUrl.pathname}`
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }
  return NextResponse.json({
    message: "Sender-constrained resource accessed.",
    checks: [
      "access grant active",
      "public-key thumbprint matched",
      "ES256 signature valid",
      "HTTP method and URI bound",
      "access-token hash bound",
      "proof time accepted",
      "proof ID consumed once"
    ]
  });
}
