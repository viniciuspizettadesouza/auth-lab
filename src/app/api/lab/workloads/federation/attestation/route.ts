import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { issueSyntheticPlatformAssertion } from "@/features/workload/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const schema = z.object({ principalId: z.string().startsWith("svc_").max(80) });

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const tokenEndpoint = `${request.nextUrl.origin}/api/lab/workloads/federation/token`;
  const assertion = await issueSyntheticPlatformAssertion({
    audience: tokenEndpoint,
    principalId: parsed.data.principalId,
    visitorId
  });
  if (!assertion) return NextResponse.json({ error: "invalid_principal" }, { status: 401 });
  return NextResponse.json({ assertion, expires_in: 60, issuer: "https://platform.auth-lab.local" }, {
    status: 201,
    headers: { "cache-control": "no-store", pragma: "no-cache" }
  });
}
