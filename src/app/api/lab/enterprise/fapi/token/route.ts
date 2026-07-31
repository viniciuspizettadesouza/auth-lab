import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticatePrivateKeyClient } from "@/features/enterprise/server/fapi";

const schema = z.object({
  clientAssertion: z.string().min(20).max(4_000),
  clientAssertionType: z.literal(
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
  ),
  clientId: z.string().min(1).max(100),
  certificateThumbprint: z.string().min(20).max(100),
  grantType: z.literal("client_credentials"),
  scope: z.literal("regulated.read")
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const result = await authenticatePrivateKeyClient({
    assertion: parsed.data.clientAssertion,
    audience: `${request.nextUrl.origin}${request.nextUrl.pathname}`,
    certificateThumbprint: parsed.data.certificateThumbprint,
    clientId: parsed.data.clientId
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }
  return NextResponse.json(
    {
      access_token: result.accessToken,
      certificate_thumbprint: result.certificateThumbprint,
      expires_in: Math.max(
        0,
        Math.floor((result.expiresAt.getTime() - Date.now()) / 1_000)
      ),
      scope: result.scope,
      token_type: "Bearer"
    },
    { headers: { "cache-control": "no-store", pragma: "no-cache" } }
  );
}
