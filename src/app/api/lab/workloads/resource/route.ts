import { NextRequest, NextResponse } from "next/server";

import { WORKLOAD_AUDIENCE } from "@/features/workload/server/protocol";
import { authorizeApiKey } from "@/features/workload/server/service";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key") ?? "";
  const audience = request.headers.get("x-auth-lab-audience") ?? WORKLOAD_AUDIENCE;
  const scope = request.nextUrl.searchParams.get("scope") ?? "orders.read";
  const result = await authorizeApiKey({ apiKey, audience, scope });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }
  return NextResponse.json({
    audience,
    message: "Synthetic order inventory returned to a machine principal.",
    principalId: result.principalId,
    scope: result.scope
  });
}
