import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { clearOwnedFlows, listOwnedFlows, startFlow } from "@/lib/recorder";
import {
  createVisitorId,
  getVisitorIdFromHeaders,
  setVisitorCookie
} from "@/lib/visitor";

const startFlowSchema = z.object({
  journey: z.enum(["sign-up", "sign-in", "password-reset", "session"])
});

async function currentUserId(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}

export async function GET(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) return NextResponse.json({ flows: [] });

  const flows = await listOwnedFlows(
    visitorId,
    await currentUserId(request.headers)
  );
  return NextResponse.json({ flows });
}

export async function POST(request: NextRequest) {
  const parsed = startFlowSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid authentication journey." },
      { status: 400 }
    );
  }

  const existingVisitorId = getVisitorIdFromHeaders(request.headers);
  const visitorId = existingVisitorId ?? createVisitorId();
  const flow = await startFlow(visitorId, parsed.data.journey);
  const response = NextResponse.json({ flow }, { status: 201 });
  if (!existingVisitorId) setVisitorCookie(response, visitorId);
  return response;
}

export async function DELETE(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) return new NextResponse(null, { status: 204 });

  await clearOwnedFlows(visitorId, await currentUserId(request.headers));
  return new NextResponse(null, { status: 204 });
}
