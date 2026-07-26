import { NextRequest, NextResponse } from "next/server";

import { defaultMethod } from "@/features/method-registry";
import { getVisitorIdFromHeaders } from "@/lib/visitor";
import { appendOwnedEvent } from "@/services/recorder/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }

  const parsed = defaultMethod.clientEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const { id } = await context.params;
  const template =
    defaultMethod.adapter.recorder.operations[parsed.data.operation];
  const event = await appendOwnedEvent(id, visitorId, {
    actor: "browser",
    action: `${parsed.data.operation}.${parsed.data.outcome}`,
    description: template[parsed.data.outcome],
    outcome: parsed.data.outcome,
    metadata: {
      endpoint: template.endpoint,
      method: template.method,
      statusCode: parsed.data.statusCode,
      durationMs: parsed.data.durationMs
    }
  });

  if (!event) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }
  return NextResponse.json({ event }, { status: 201 });
}
