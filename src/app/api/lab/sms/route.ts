import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getVisitorIdFromHeaders } from "@/lib/visitor";
import { issueSimulatedSms } from "@/features/link-code/server/sms-simulator";

const schema = z.object({
  flowId: z.string().uuid(),
  scenario: z.enum(["delivered", "intercepted", "recycled-number"])
});

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  if (!visitorId || !parsed.success) {
    return NextResponse.json({ error: "Invalid simulation." }, { status: 400 });
  }

  const delivery = await issueSimulatedSms(
    visitorId,
    parsed.data.flowId,
    parsed.data.scenario
  );
  if (!delivery) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }
  return NextResponse.json({ delivery }, { status: 201 });
}
