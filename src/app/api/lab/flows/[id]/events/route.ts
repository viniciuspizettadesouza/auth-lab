import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getMethodAdapter } from "@/features/method-registry";
import { getVisitorIdFromHeaders } from "@/lib/visitor";
import {
  appendOwnedEvent,
  getOwnedFlow,
  setFlowStatus
} from "@/services/recorder/service";

type Context = { params: Promise<{ id: string }> };

const clientEventSchema = z.object({
  operation: z.string().min(1).max(80),
  outcome: z.enum(["success", "failure"]),
  statusCode: z.number().int().min(100).max(599),
  durationMs: z.number().int().min(0).max(120_000)
});

export async function POST(request: NextRequest, context: Context) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }

  const parsed = clientEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const { id } = await context.params;
  const flow = await getOwnedFlow(id, visitorId);
  const method = flow ? getMethodAdapter(flow.method) : null;
  const operations = method?.recorder.operations as
    | Record<
        string,
        {
          endpoint: string;
          method: "GET" | "POST" | "DELETE";
          success: string;
          failure: string;
          completesFlow?: boolean;
        }
      >
    | undefined;
  const template = operations?.[parsed.data.operation];
  if (!template) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
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
  if (template.completesFlow && parsed.data.outcome === "success") {
    await setFlowStatus(id, "completed");
  }
  return NextResponse.json({ event }, { status: 201 });
}
