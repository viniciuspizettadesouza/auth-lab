import { NextRequest } from "next/server";
import { z } from "zod";

import { verifyTotpWithReplayDefense } from "@/features/link-code/server/totp-verifier";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid TOTP code." }, { status: 400 });
  }
  return verifyTotpWithReplayDefense(request, parsed.data.code);
}
