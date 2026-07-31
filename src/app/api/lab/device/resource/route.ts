import { NextRequest, NextResponse } from "next/server";

import { consumeDeviceAccessToken } from "@/features/device-flow/server/service";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, accessToken] = authorization.split(" ");
  if (scheme !== "Bearer" || !accessToken) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const grant = await consumeDeviceAccessToken(accessToken);
  if (!grant) {
    return NextResponse.json(
      { error: "invalid_token_or_scope" },
      { status: 403 }
    );
  }
  return NextResponse.json({
    device: {
      name: "Auth Lab constrained client",
      status: "authorized"
    },
    scope: grant.scope
  });
}
