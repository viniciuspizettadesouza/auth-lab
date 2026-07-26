import { describe, expect, it } from "vitest";

import {
  authenticationMethods,
  comparisonMethods,
  consumerWebTierList,
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

  it("assigns each human web reference method to one contextual tier", () => {
    const tieredSlugs = consumerWebTierList.flatMap(
      (tier) => tier.methodSlugs
    );
    const catalogSlugs = new Set(
      authenticationMethods.map((method) => method.slug)
    );

    expect(new Set(tieredSlugs).size).toBe(tieredSlugs.length);
    expect(tieredSlugs.every((slug) => catalogSlugs.has(slug))).toBe(true);
    expect(consumerWebTierList.map((tier) => tier.grade)).toEqual([
      "S",
      "A",
      "B",
      "C",
      "D"
    ]);
  });
});
