import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  revokeApiKey,
  rotateApiKey
} from "@/features/workload/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const schema = z.object({ apiKey: z.string().min(60).max(160) });

async function input(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  return visitorId && parsed.success ? { visitorId, apiKey: parsed.data.apiKey } : null;
}

export async function POST(request: NextRequest) {
  const parsed = await input(request);
  if (!parsed) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const replacement = await rotateApiKey(parsed.visitorId, parsed.apiKey);
  if (!replacement) return NextResponse.json({ error: "invalid_key" }, { status: 401 });
  return NextResponse.json(replacement, {
    status: 201,
    headers: { "cache-control": "no-store", pragma: "no-cache" }
  });
}

export async function DELETE(request: NextRequest) {
  const parsed = await input(request);
  if (!parsed) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!(await revokeApiKey(parsed.visitorId, parsed.apiKey))) {
    return NextResponse.json({ error: "invalid_key" }, { status: 401 });
  }
  return new NextResponse(null, { status: 204 });
}
