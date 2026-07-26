import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { passwordMethodAdapter } from "@/features/password/adapter";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("recorder integration", () => {
  let recorder: typeof import("@/lib/recorder");
  let database: typeof import("@/db");
  const visitorA = randomUUID();
  const visitorB = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    recorder = await import("@/lib/recorder");
    database = await import("@/db");
  });

  afterAll(async () => {
    if (database) await database.sqlClient.end();
  });

  it("orders events atomically and enforces visitor ownership", async () => {
    const flow = await recorder.startFlow(
      visitorA,
      "sign-in",
      passwordMethodAdapter.metadata.slug
    );
    await Promise.all([
      recorder.appendOwnedEvent(flow.id, visitorA, {
        actor: "browser",
        action: "one",
        description: "First concurrent event.",
        outcome: "info"
      }),
      recorder.appendOwnedEvent(flow.id, visitorA, {
        actor: "application",
        action: "two",
        description: "Second concurrent event.",
        outcome: "success"
      })
    ]);

    const owned = await recorder.getOwnedFlowWithEvents(flow.id, visitorA);
    const foreign = await recorder.getOwnedFlowWithEvents(flow.id, visitorB);
    expect(owned?.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(foreign).toBeNull();
    await recorder.deleteOwnedFlow(flow.id, visitorA);
  });
});
