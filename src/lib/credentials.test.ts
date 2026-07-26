import { describe, expect, it } from "vitest";

import {
  passwordSchema,
  publicAuthError,
  signUpInputSchema
} from "@/lib/credentials";

describe("credential input", () => {
  it("enforces the 12 to 128 character password boundary", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
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
});
