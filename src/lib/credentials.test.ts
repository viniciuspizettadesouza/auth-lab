import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordSchema,
  passwordRejectionReason,
  publicAuthError,
  signUpInputSchema
} from "@/lib/credentials";

describe("credential input", () => {
  it("enforces the 15 to 128 character password boundary", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(MAX_PASSWORD_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(MAX_PASSWORD_LENGTH + 1)).success).toBe(false);
  });

  it("blocks full common and context-specific passwords without composition rules", () => {
    expect(passwordRejectionReason("passwordpassword")).toBe("blocked");
    expect(
      passwordRejectionReason("Auth Lab is my password")
    ).toBe("context-specific");
    expect(
      passwordSchema.safeParse("all lowercase with spaces is accepted").success
    ).toBe(true);
  });

  it("validates the complete sign-up shape", () => {
    expect(
      signUpInputSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "correct horse battery staple"
      }).success
    ).toBe(true);
  });

  it("uses a generic public error for unknown authentication failures", () => {
    expect(publicAuthError("INVALID_EMAIL_OR_PASSWORD")).not.toContain("email");
    expect(publicAuthError("INVALID_EMAIL_OR_PASSWORD")).not.toContain("password");
  });

  it("explains blocklist and throttling rejections safely", () => {
    expect(publicAuthError("PASSWORD_BLOCKLISTED")).toMatch(/commonly used/i);
    expect(publicAuthError(undefined, 429)).toMatch(/too many attempts/i);
  });
});
