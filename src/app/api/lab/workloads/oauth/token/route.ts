import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { WORKLOAD_AUDIENCE } from "@/features/workload/server/protocol";
import { exchangeClientCredentials } from "@/features/workload/server/service";

const schema = z.object({
  audience: z.string().url().max(200),
  clientId: z.string().startsWith("svc_").max(80),
  clientSecret: z.string().min(60).max(160),
  grantType: z.literal("client_credentials"),
  scope: z.string().min(1).max(80)
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await exchangeClientCredentials(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 });
  return NextResponse.json({
    access_token: result.accessToken,
    audience: WORKLOAD_AUDIENCE,
    expires_in: Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1_000)),
    scope: parsed.data.scope,
    token_type: result.tokenType
  }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
}
