import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  issueCredential,
  revokeCredential
} from "@/features/portable/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const issueSchema = z.object({ holderJwk: z.record(z.string(), z.unknown()) });
const revokeSchema = z.object({ credentialId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = issueSchema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const issued = await issueCredential(visitorId, parsed.data.holderJwk);
  if (!issued) return NextResponse.json({ error: "invalid_holder_key" }, { status: 400 });
  return NextResponse.json(issued, {
    status: 201,
    headers: { "cache-control": "no-store", pragma: "no-cache" }
  });
}

export async function DELETE(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = revokeSchema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!(await revokeCredential(visitorId, parsed.data.credentialId))) {
    return NextResponse.json({ error: "unknown_or_unowned_credential" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
