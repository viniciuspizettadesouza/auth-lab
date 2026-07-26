import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/services/auth/service";

const schema = z.object({
  code: z.string().min(1).max(64)
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid recovery code." }, { status: 400 });
  }
  return auth.api.verifyBackupCode({
    headers: request.headers,
    body: {
      code: parsed.data.code,
      disableSession: false,
      trustDevice: false
    },
    asResponse: true
  });
}
