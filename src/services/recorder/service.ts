import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  authenticationEvent,
  authenticationFlow
} from "@/db/schema";
import type { EventActor, EventOutcome, FlowStatus } from "@/contracts";
import { sanitizeMetadata } from "@/services/recorder/safe-metadata";

export type RecorderEventInput = {
  actor: EventActor;
  action: string;
  description: string;
  outcome: EventOutcome;
  metadata?: Record<string, unknown>;
};

export async function startFlow(
  visitorId: string,
  journey: string,
  method: string
) {
  const id = randomUUID();
  const [flow] = await db
    .insert(authenticationFlow)
    .values({ id, visitorId, journey, method })
    .returning();

  await appendEvent(id, {
    actor: "user",
    action: "flow.started",
    description: `Started the ${journey.replace("-", " ")} journey.`,
    outcome: "info",
    metadata: { entityId: id }
  });

  return flow;
}

export async function appendEvent(
  flowId: string,
  input: RecorderEventInput
) {
  const metadata = sanitizeMetadata(input.metadata);

  const [flow] = await db
    .update(authenticationFlow)
    .set({
      nextSequence: sql`${authenticationFlow.nextSequence} + 1`,
      updatedAt: new Date()
    })
    .where(eq(authenticationFlow.id, flowId))
    .returning({ sequence: authenticationFlow.nextSequence });

  if (!flow) return null;

  const [event] = await db
    .insert(authenticationEvent)
    .values({
      id: randomUUID(),
      flowId,
      sequence: flow.sequence,
      actor: input.actor,
      action: input.action.slice(0, 120),
      description: input.description.slice(0, 500),
      outcome: input.outcome,
      safeMetadata: metadata
    })
    .returning();

  return event;
}

export async function appendOwnedEvent(
  flowId: string,
  visitorId: string,
  input: RecorderEventInput
) {
  const flow = await getOwnedFlow(flowId, visitorId);
  if (!flow) return null;
  return appendEvent(flowId, input);
}

export async function attachFlowToUser(flowId: string, userId: string) {
  await db
    .update(authenticationFlow)
    .set({ userId, updatedAt: new Date() })
    .where(eq(authenticationFlow.id, flowId));
}

export async function setFlowStatus(
  flowId: string,
  status: FlowStatus
) {
  await db
    .update(authenticationFlow)
    .set({
      status,
      completedAt: status === "active" ? null : new Date(),
      updatedAt: new Date()
    })
    .where(eq(authenticationFlow.id, flowId));
}

export async function getOwnedFlow(
  flowId: string,
  visitorId: string,
  userId?: string | null
) {
  const ownership = userId
    ? or(
        eq(authenticationFlow.visitorId, visitorId),
        eq(authenticationFlow.userId, userId)
      )
    : eq(authenticationFlow.visitorId, visitorId);

  const [flow] = await db
    .select()
    .from(authenticationFlow)
    .where(and(eq(authenticationFlow.id, flowId), ownership))
    .limit(1);

  return flow ?? null;
}

export async function getOwnedFlowWithEvents(
  flowId: string,
  visitorId: string,
  userId?: string | null
) {
  const flow = await getOwnedFlow(flowId, visitorId, userId);
  if (!flow) return null;

  const events = await db
    .select()
    .from(authenticationEvent)
    .where(eq(authenticationEvent.flowId, flowId))
    .orderBy(authenticationEvent.sequence);

  return { ...flow, events };
}

export async function listOwnedFlows(
  visitorId: string,
  userId?: string | null
) {
  const ownership = userId
    ? or(
        eq(authenticationFlow.visitorId, visitorId),
        eq(authenticationFlow.userId, userId)
      )
    : eq(authenticationFlow.visitorId, visitorId);

  return db
    .select({
      id: authenticationFlow.id,
      method: authenticationFlow.method,
      journey: authenticationFlow.journey,
      status: authenticationFlow.status,
      createdAt: authenticationFlow.createdAt,
      updatedAt: authenticationFlow.updatedAt,
      eventCount: authenticationFlow.nextSequence
    })
    .from(authenticationFlow)
    .where(ownership)
    .orderBy(desc(authenticationFlow.createdAt))
    .limit(30);
}

export async function deleteOwnedFlow(
  flowId: string,
  visitorId: string,
  userId?: string | null
) {
  const flow = await getOwnedFlow(flowId, visitorId, userId);
  if (!flow) return false;
  await db
    .delete(authenticationFlow)
    .where(eq(authenticationFlow.id, flowId));
  return true;
}

export async function clearOwnedFlows(
  visitorId: string,
  userId?: string | null
) {
  const ownership = userId
    ? or(
        eq(authenticationFlow.visitorId, visitorId),
        eq(authenticationFlow.userId, userId)
      )
    : eq(authenticationFlow.visitorId, visitorId);

  await db.delete(authenticationFlow).where(ownership);
}
