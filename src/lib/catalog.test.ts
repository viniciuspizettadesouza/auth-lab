import { describe, expect, it } from "vitest";

import {
  authenticationMethods,
  comparisonMethods,
  methodCategories,
  tieredMethods,
  tierTracks
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

  it("keeps the catalog, comparison, and tier list in exact sync", () => {
    const catalogSlugs = authenticationMethods.map((method) => method.slug);

    expect(comparisonMethods.map((method) => method.slug)).toEqual(catalogSlugs);
    expect(tieredMethods.map((method) => method.slug)).toEqual(catalogSlugs);
  });

  it("assigns every method to a documented, non-empty tier track", () => {
    const trackNames = new Set(tierTracks.map((track) => track.name));

    expect(
      authenticationMethods.every((method) =>
        trackNames.has(method.tier.track)
      )
    ).toBe(true);
    expect(
      tierTracks.every((track) =>
        authenticationMethods.some((method) => method.tier.track === track.name)
      )
    ).toBe(true);
  });
});
