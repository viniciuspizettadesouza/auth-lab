import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeUserCode,
  inspectUserCode
} from "@/features/device-flow/server/service";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
  userCode: z.string().min(8).max(16)
});

export async function GET(request: NextRequest) {
  const userCode = request.nextUrl.searchParams.get("user_code") ?? "";
  const authorization = await inspectUserCode(userCode);
  if (!authorization) {
    return NextResponse.json(
      { error: "Invalid or expired user code." },
      { status: 404 }
    );
  }
  return NextResponse.json({
    clientId: authorization.clientId,
    expiresAt: authorization.expiresAt,
    scope: authorization.scope,
    status: authorization.status,
    userCode: authorization.userCode
  });
}

export async function POST(request: NextRequest) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }
  const result = await authorizeUserCode({
    ...parsed.data,
    userId: current.user.id
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Code invalid, expired, or already handled." },
      { status: 409 }
    );
  }
  return NextResponse.json({
    decision: parsed.data.decision,
    clientId: result.clientId,
    scope: result.scope
  });
}
