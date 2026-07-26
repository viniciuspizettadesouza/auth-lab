import { NextRequest, NextResponse } from "next/server";

import {
  defaultMethod,
  getMethodAdapter
} from "@/features/method-registry";
import { auth } from "@/lib/auth";
import {
  clearOwnedFlows,
  listOwnedFlows,
  startFlow
} from "@/services/recorder/service";
import {
  createVisitorId,
  getVisitorIdFromHeaders,
  setVisitorCookie
} from "@/lib/visitor";

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
  const body = await request.json() as {
    journey?: unknown;
    method?: unknown;
  };
  const method =
    typeof body.method === "string"
      ? getMethodAdapter(body.method)
      : defaultMethod.adapter;
  const journey =
    typeof body.journey === "string" &&
    method?.recorder.journeys.some(
      (candidate: string) => candidate === body.journey
    )
      ? body.journey
      : null;
  if (!method || !journey) {
    return NextResponse.json(
      { error: "Invalid authentication journey." },
      { status: 400 }
    );
  }

  const existingVisitorId = getVisitorIdFromHeaders(request.headers);
  const visitorId = existingVisitorId ?? createVisitorId();
  const flow = await startFlow(
    visitorId,
    journey,
    method.metadata.slug
  );
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
