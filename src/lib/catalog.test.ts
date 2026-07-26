import { describe, expect, it } from "vitest";

import {
  authenticationMethods,
  comparisonMethods,
  methodCategories
} from "@/lib/catalog";

describe("authentication method catalog", () => {
  it("has unique stable slugs and valid categories", () => {
    const slugs = authenticationMethods.map((method) => method.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(
      authenticationMethods.every((method) =>
        methodCategories.includes(method.category)
      )
    ).toBe(true);
  });

  it("exposes only the implemented interactive authentication method", () => {
    const interactiveAuthentication = authenticationMethods.filter(
      (method) =>
        method.category === "Authentication" && method.status === "available"
    );
    expect(interactiveAuthentication.map((method) => method.slug)).toEqual([
      "password"
    ]);
  });

  it("keeps the comparison focused on the planned reference methods", () => {
    expect(comparisonMethods.map((method) => method.slug)).toEqual([
      "password",
      "magic-link",
      "totp",
      "passkey",
      "oidc"
    ]);
  });
});
