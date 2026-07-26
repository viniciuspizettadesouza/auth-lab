import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getVisitorIdFromHeaders } from "@/lib/visitor";
import { verifySimulatedSms } from "@/features/link-code/server/sms-simulator";
import {
  appendOwnedEvent,
  setFlowStatus
} from "@/services/recorder/service";

const schema = z.object({
  flowId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  const parsed = schema.safeParse(await request.json());
  if (!visitorId || !parsed.success) {
    return NextResponse.json({ error: "Invalid simulation." }, { status: 400 });
  }

  const result = await verifySimulatedSms(
    visitorId,
    parsed.data.flowId,
    parsed.data.code
  );
  const status =
    result === "verified"
      ? 200
      : result === "replayed"
        ? 409
        : result === "not-found"
          ? 404
          : result === "locked"
            ? 429
            : 400;
  await appendOwnedEvent(parsed.data.flowId, visitorId, {
    actor: "application",
    action: `sms-simulation.${result}`,
    description:
      result === "verified"
        ? "The simulator consumed the correct synthetic SMS code."
        : `The simulator rejected the code with the safe result: ${result}.`,
    outcome: result === "verified" ? "success" : "failure",
    metadata: {
      endpoint: "/api/lab/sms/verify",
      method: "POST",
      statusCode: status
    }
  });
  if (result === "verified") {
    await setFlowStatus(parsed.data.flowId, "completed");
  }
  return NextResponse.json({ result }, { status });
}
