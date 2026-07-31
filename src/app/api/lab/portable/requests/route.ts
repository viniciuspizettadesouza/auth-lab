import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createPresentationRequest,
  denyPresentationRequest
} from "@/features/portable/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const claim = z.enum(["given_name", "age_over_18", "membership_level", "city"]);
const createSchema = z.object({ requestedClaims: z.array(claim).min(1).max(4) });
const denySchema = z.object({ requestId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = createSchema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const created = await createPresentationRequest({
    requestedClaims: [...new Set(parsed.data.requestedClaims)], visitorId
  });
  return NextResponse.json({
    ...created,
    clientId: created.audience,
    dcqlQuery: {
      credentials: [{
        claims: created.requestedClaims.map((name) => ({ path: [name] })),
        format: "auth-lab-sd-jwt-model",
        id: "community_card"
      }]
    },
    responseMode: "direct_post",
    responseType: "vp_token"
  }, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = denySchema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!(await denyPresentationRequest(visitorId, parsed.data.requestId))) {
    return NextResponse.json({ error: "invalid_or_consumed_request" }, { status: 409 });
  }
  return new NextResponse(null, { status: 204 });
}
