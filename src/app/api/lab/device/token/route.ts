import { NextRequest, NextResponse } from "next/server";

import { exchangeDeviceCode } from "@/features/device-flow/server/service";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  if (
    form.get("grant_type") !==
    "urn:ietf:params:oauth:grant-type:device_code"
  ) {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 }
    );
  }
  const result = await exchangeDeviceCode({
    clientId: String(form.get("client_id") ?? ""),
    deviceCode: String(form.get("device_code") ?? "")
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        interval: result.intervalSeconds
      },
      {
        status: 400,
        headers: { "cache-control": "no-store", pragma: "no-cache" }
      }
    );
  }
  return NextResponse.json(
    {
      access_token: result.accessToken,
      token_type: "Bearer",
      expires_in: Math.max(
        0,
        Math.floor((result.expiresAt.getTime() - Date.now()) / 1_000)
      ),
      scope: result.scope
    },
    {
      headers: { "cache-control": "no-store", pragma: "no-cache" }
    }
  );
}
