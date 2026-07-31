import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  issueClientSecret,
  rotateClientSecret
} from "@/features/workload/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const schema = z.object({
  clientId: z.string().startsWith("svc_").max(80),
  currentSecret: z.string().max(160).optional()
});

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = parsed.data.currentSecret
    ? await rotateClientSecret(visitorId, parsed.data.clientId, parsed.data.currentSecret)
    : await issueClientSecret(visitorId, parsed.data.clientId);
  if (!result) return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  return NextResponse.json(result, {
    status: 201,
    headers: { "cache-control": "no-store", pragma: "no-cache" }
  });
}
