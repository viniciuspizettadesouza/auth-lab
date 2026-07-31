import { NextRequest, NextResponse } from "next/server";

import { createDeviceAuthorization } from "@/features/device-flow/server/service";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const clientId = String(form.get("client_id") ?? "");
  const scope = String(form.get("scope") ?? "");
  if (clientId.length > 100 || scope.length > 200) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const result = await createDeviceAuthorization({ clientId, scope });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(
    {
      device_code: result.deviceCode,
      user_code: result.userCode,
      verification_uri: result.verificationUri,
      verification_uri_complete: result.verificationUriComplete,
      expires_in: Math.max(
        0,
        Math.floor((result.expiresAt.getTime() - Date.now()) / 1_000)
      ),
      interval: result.intervalSeconds
    },
    {
      status: 201,
      headers: { "cache-control": "no-store", pragma: "no-cache" }
    }
  );
}
