import { describe, expect, it } from "vitest";

import {
  createUserCode,
  digestDeviceValue,
  normalizeUserCode,
  randomDeviceCode
} from "@/features/device-flow/server/protocol";

describe("device authorization protocol primitives", () => {
  it("creates high-entropy device codes and stores a stable digest", () => {
    const code = randomDeviceCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digestDeviceValue(code)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digestDeviceValue(code)).not.toBe(code);
  });

  it("creates readable user codes and normalizes human input", () => {
    const code = createUserCode();
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ23456789]{4}-[BCDFGHJKLMNPQRSTVWXZ23456789]{4}$/);
    expect(normalizeUserCode(code.toLowerCase().replace("-", " "))).toBe(code);
    expect(normalizeUserCode("too-short")).toBe("");
  });
});
