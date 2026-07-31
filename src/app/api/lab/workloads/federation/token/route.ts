import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { exchangeWorkloadAssertion } from "@/features/workload/server/service";

const schema = z.object({
  audience: z.string().url().max(200),
  grantType: z.literal("urn:ietf:params:oauth:grant-type:token-exchange"),
  publicJwk: z.record(z.string(), z.unknown()),
  scope: z.string().min(1).max(80),
  subjectToken: z.string().min(40).max(4_000),
  subjectTokenType: z.literal("urn:ietf:params:oauth:token-type:jwt")
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await exchangeWorkloadAssertion({
    assertion: parsed.data.subjectToken,
    audience: parsed.data.audience,
    publicJwk: parsed.data.publicJwk,
    scope: parsed.data.scope,
    tokenEndpoint: `${request.nextUrl.origin}${request.nextUrl.pathname}`
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 });
  return NextResponse.json({
    access_token: result.accessToken,
    expires_in: Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1_000)),
    issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: parsed.data.scope,
    token_type: result.tokenType
  }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
}
