import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  deleteOwnedFlow,
  getOwnedFlowWithEvents
} from "@/services/recorder/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

type Context = { params: Promise<{ id: string }> };

async function ownership(request: NextRequest) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  return { visitorId, userId: session?.user.id ?? null };
}

export async function GET(request: NextRequest, context: Context) {
  const owner = await ownership(request);
  if (!owner) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }

  const { id } = await context.params;
  const flow = await getOwnedFlowWithEvents(
    id,
    owner.visitorId,
    owner.userId
  );
  if (!flow) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }
  return NextResponse.json({ flow });
}

export async function DELETE(request: NextRequest, context: Context) {
  const owner = await ownership(request);
  if (!owner) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }

  const { id } = await context.params;
  const deleted = await deleteOwnedFlow(id, owner.visitorId, owner.userId);
  if (!deleted) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
