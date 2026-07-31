import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  isEnterprisePublicJwk,
  registerHighAssuranceClient
} from "@/features/enterprise/server/fapi";

const schema = z.object({ publicJwk: z.record(z.string(), z.unknown()) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !isEnterprisePublicJwk(parsed.data.publicJwk)) {
    return NextResponse.json({ error: "A P-256 public key is required." }, { status: 400 });
  }
  const client = await registerHighAssuranceClient(parsed.data.publicJwk);
  return NextResponse.json(client, { status: 201 });
}
