import { NextRequest, NextResponse } from "next/server";

import { consumeCertificateBoundToken } from "@/features/enterprise/server/fapi";

export async function GET(request: NextRequest) {
  const [scheme, accessToken] = (
    request.headers.get("authorization") ?? ""
  ).split(" ");
  const certificateThumbprint = request.headers.get(
    "x-auth-lab-client-certificate"
  );
  if (scheme !== "Bearer" || !accessToken || !certificateThumbprint) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const grant = await consumeCertificateBoundToken({
    accessToken,
    certificateThumbprint
  });
  if (!grant) {
    return NextResponse.json({ error: "certificate_binding_failed" }, { status: 401 });
  }
  return NextResponse.json({
    message: "Certificate-bound regulated resource accessed.",
    scope: grant.scope,
    transportBoundary: "simulated-client-certificate-metadata"
  });
}
