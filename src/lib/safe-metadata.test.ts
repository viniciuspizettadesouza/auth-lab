import { describe, expect, it } from "vitest";

import {
  containsSensitiveData,
  redactEmail,
  sanitizeMetadata
} from "@/lib/safe-metadata";

describe("safe recorder metadata", () => {
  it("keeps allow-listed request facts and redacts email addresses", () => {
    expect(
      sanitizeMetadata({
        endpoint: "/api/auth/sign-in/email",
        method: "POST",
        statusCode: 200,
        durationMs: 24,
        fields: ["email", "password"],
        email: "developer@example.com",
        cookieFlags: { httpOnly: true, secure: false, sameSite: "lax" }
      })
    ).toEqual({
      endpoint: "/api/auth/sign-in/email",
      method: "POST",
      statusCode: 200,
      durationMs: 24,
      fields: ["email", "password"],
      email: "de*******@example.com",
      cookieFlags: { httpOnly: true, secure: false, sameSite: "lax" }
    });
  });

  it.each([
    ["password", "secret"],
    ["sessionToken", "secret"],
    ["authorization", "Bearer secret"],
    ["passwordHash", "secret"]
  ])("rejects unsafe key %s", (key, value) => {
    expect(() => sanitizeMetadata({ [key]: value })).toThrow(
      "Unsafe metadata key rejected"
    );
  });

  it("rejects unknown nested data rather than attempting generic redaction", () => {
    expect(() =>
      sanitizeMetadata({ arbitraryRequestBody: { email: "a@b.com" } })
    ).toThrow();
  });

  it("detects common sensitive response shapes", () => {
    expect(containsSensitiveData({ token: "raw" })).toBe(true);
    expect(containsSensitiveData({ endpoint: "/safe", fields: ["password"] })).toBe(
      false
    );
  });

  it("handles malformed email input safely", () => {
    expect(redactEmail("not-an-email")).toBe("[redacted email]");
  });

  it("accepts opaque entity IDs but rejects dangerous formatting", () => {
    expect(sanitizeMetadata({ entityId: "better_auth-id_123" })).toEqual({
      entityId: "better_auth-id_123"
    });
    expect(() => sanitizeMetadata({ entityId: "<script>" })).toThrow();
  });
});
