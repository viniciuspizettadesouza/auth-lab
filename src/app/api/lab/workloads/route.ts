import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createWorkloadPrincipal,
  listWorkloadAudit
} from "@/features/workload/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const createSchema = z.object({
  name: z.string().trim().min(3).max(60)
});

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) {
    return NextResponse.json({ error: "Start a lab flow first." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A 3–60 character service name is required." }, { status: 400 });
  }
  const principal = await createWorkloadPrincipal(visitorId, parsed.data.name);
  return NextResponse.json(principal, {
    status: 201,
    headers: { "cache-control": "no-store", pragma: "no-cache" }
  });
}

export async function GET(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const principalId = request.nextUrl.searchParams.get("principalId");
  if (!visitorId || !principalId) return NextResponse.json({ events: [] });
  return NextResponse.json({
    events: await listWorkloadAudit(visitorId, principalId)
  });
}
