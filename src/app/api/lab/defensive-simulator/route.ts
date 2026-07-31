import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  defensiveScenarioIds,
  evaluateDefensiveScenario
} from "@/features/defensive-simulator/server/scenarios";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const schema = z.object({ scenario: z.enum(defensiveScenarioIds) }).strict();

export async function POST(request: NextRequest) {
  if (!getVisitorIdFromHeaders(request.headers)) {
    return NextResponse.json({ error: "Start an owned lab flow first." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Unknown fixed scenario." }, { status: 400 });
  return NextResponse.json(evaluateDefensiveScenario(parsed.data.scenario), {
    headers: { "cache-control": "no-store" }
  });
}
