import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  evaluateRisk,
  type RiskScenario
} from "@/features/session-token/server/risk";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
  scenario: z.enum([
    "routine-profile-view",
    "new-device-export",
    "change-recovery"
  ])
});

export async function POST(request: NextRequest) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid risk scenario." }, { status: 400 });
  }
  const result = await evaluateRisk(
    current.session.id,
    current.user.id,
    parsed.data.scenario as RiskScenario
  );
  return NextResponse.json(result, { status: result.allowed ? 200 : 403 });
}
