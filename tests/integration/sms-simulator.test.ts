import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("SMS OTP simulator", () => {
  let recorder: typeof import("@/services/recorder/service");
  let simulator: typeof import("@/features/link-code/server/sms-simulator");
  let database: typeof import("@/db");
  let authSchema: typeof import("@/db/schema/auth");
  let operators: typeof import("drizzle-orm");

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    recorder = await import("@/services/recorder/service");
    simulator = await import("@/features/link-code/server/sms-simulator");
    database = await import("@/db");
    authSchema = await import("@/db/schema/auth");
    operators = await import("drizzle-orm");
  });

  afterAll(async () => {
    if (database) await database.sqlClient.end();
  });

  it("enforces ownership, attempt handling, consumption, and replay rejection", async () => {
    const owner = randomUUID();
    const foreignVisitor = randomUUID();
    const flow = await recorder.startFlow(
      owner,
      "sms-otp-simulation",
      "sms-otp"
    );

    expect(
      await simulator.issueSimulatedSms(
        foreignVisitor,
        flow.id,
        "delivered"
      )
    ).toBeNull();

    const delivery = await simulator.issueSimulatedSms(
      owner,
      flow.id,
      "intercepted"
    );
    expect(delivery?.code).toMatch(/^\d{6}$/);
    const wrongCode = String(
      (Number(delivery!.code) + 1) % 1_000_000
    ).padStart(6, "0");
    expect(
      await simulator.verifySimulatedSms(owner, flow.id, wrongCode)
    ).toBe("invalid");
    expect(
      await simulator.verifySimulatedSms(owner, flow.id, delivery!.code)
    ).toBe("verified");
    expect(
      await simulator.verifySimulatedSms(owner, flow.id, delivery!.code)
    ).toBe("replayed");
    expect(
      await simulator.verifySimulatedSms(
        foreignVisitor,
        flow.id,
        delivery!.code
      )
    ).toBe("not-found");

    await recorder.deleteOwnedFlow(flow.id, owner);
  });

  it("expires challenges and locks verification after three failures", async () => {
    const owner = randomUUID();
    const expiredFlow = await recorder.startFlow(
      owner,
      "sms-otp-simulation",
      "sms-otp"
    );
    const expired = await simulator.issueSimulatedSms(
      owner,
      expiredFlow.id,
      "delivered"
    );
    await database.db
      .update(authSchema.verification)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(
        operators.eq(
          authSchema.verification.identifier,
          `sms-sim:${owner}:${expiredFlow.id}`
        )
      );
    expect(
      await simulator.verifySimulatedSms(
        owner,
        expiredFlow.id,
        expired!.code
      )
    ).toBe("expired");

    const lockedFlow = await recorder.startFlow(
      owner,
      "sms-otp-simulation",
      "sms-otp"
    );
    const locked = await simulator.issueSimulatedSms(
      owner,
      lockedFlow.id,
      "delivered"
    );
    const wrongCode = String(
      (Number(locked!.code) + 1) % 1_000_000
    ).padStart(6, "0");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(
        await simulator.verifySimulatedSms(
          owner,
          lockedFlow.id,
          wrongCode
        )
      ).toBe("invalid");
    }
    expect(
      await simulator.verifySimulatedSms(
        owner,
        lockedFlow.id,
        wrongCode
      )
    ).toBe("locked");

    await recorder.deleteOwnedFlow(expiredFlow.id, owner);
    await recorder.deleteOwnedFlow(lockedFlow.id, owner);
  });
});
