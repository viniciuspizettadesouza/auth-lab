import { NextRequest, NextResponse } from "next/server";

import { WORKLOAD_AUDIENCE } from "@/features/workload/server/protocol";
import { consumeWorkloadAccessToken } from "@/features/workload/server/service";

export async function GET(request: NextRequest) {
  const [scheme, accessToken] = (request.headers.get("authorization") ?? "").split(" ");
  if (!accessToken || !["Bearer", "DPoP"].includes(scheme ?? "")) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const result = await consumeWorkloadAccessToken({
    accessToken,
    audience: WORKLOAD_AUDIENCE,
    authScheme: scheme as "Bearer" | "DPoP",
    method: request.method,
    proof: request.headers.get("dpop") ?? undefined,
    scope: "orders.read",
    uri: `${request.nextUrl.origin}${request.nextUrl.pathname}`
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 });
  return NextResponse.json({
    message: "Short-lived workload token accepted.",
    principalId: result.principalId,
    source: result.source
  });
}
