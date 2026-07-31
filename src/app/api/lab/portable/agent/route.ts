import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAgentAction } from "@/features/portable/server/agent-policy";

const schema = z.object({
  scenario: z.enum(["read-calendar", "send-email", "wire-money", "expired-delegation"])
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_scenario" }, { status: 400 });
  return NextResponse.json(evaluateAgentAction(parsed.data.scenario));
}
