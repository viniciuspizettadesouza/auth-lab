import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { revokeWorkloadGrants } from "@/features/workload/server/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const schema = z.object({ principalId: z.string().startsWith("svc_").max(80) });

export async function DELETE(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  if (!visitorId || !parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!(await revokeWorkloadGrants(visitorId, parsed.data.principalId))) {
    return NextResponse.json({ error: "invalid_principal" }, { status: 401 });
  }
  return new NextResponse(null, { status: 204 });
}
