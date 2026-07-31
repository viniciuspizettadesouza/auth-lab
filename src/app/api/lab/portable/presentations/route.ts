import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyPresentation } from "@/features/portable/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const schema = z.object({
  nonce: z.string().min(20).max(100),
  state: z.string().uuid(),
  vpToken: z.object({
    disclosures: z.array(z.string().min(4).max(500)).min(1).max(4),
    holderProof: z.string().min(40).max(4_000),
    issuerJwt: z.string().min(40).max(8_000)
  })
});

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await verifyPresentation({
    ...parsed.data.vpToken,
    nonce: parsed.data.nonce,
    requestId: parsed.data.state,
    visitorId
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 });
  return NextResponse.json({
    audience: result.audience,
    disclosed: result.disclosed,
    issuer: result.issuer,
    message: "Portable presentation verified without creating an Auth Lab session.",
    pairwiseSubject: result.subject
  });
}
