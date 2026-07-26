import { describe, expect, it } from "vitest";

import {
  authenticationMethods,
  classificationOrder,
  comparisonMethods,
  learningTracks,
  tieredMethods,
  tierTracks
} from "@/lib/catalog";

describe("authentication method catalog", () => {
  it("has unique stable slugs and valid tracks", () => {
    const slugs = authenticationMethods.map((method) => method.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const trackNames = new Set(learningTracks.map((track) => track.name));
    expect(
      authenticationMethods.every((method) =>
        trackNames.has(method.track)
      )
    ).toBe(true);
  });

  it("exposes only the implemented interactive primary authentication method", () => {
    const interactiveAuthentication = authenticationMethods.filter(
      (method) =>
        method.category === "Authentication" && method.status === "interactive"
    );
    expect(interactiveAuthentication.map((method) => method.slug)).toEqual([
      "password"
    ]);
  });

  it("publishes OIDC as interactive and SAML as a clearly labelled simulation", () => {
    expect(
      authenticationMethods.find((method) => method.slug === "oidc")?.status
    ).toBe("interactive");
    expect(
      authenticationMethods.find((method) => method.slug === "saml")?.status
    ).toBe("simulation");
  });

  it("provides every evolution classification and complete evidence metadata", () => {
    for (const classification of classificationOrder) {
      expect(
        authenticationMethods.some(
          (method) => method.classification === classification
        )
      ).toBe(true);
    }
    expect(
      authenticationMethods.every(
        (method) =>
          method.evolution.then &&
          method.evolution.now &&
          method.evolution.next &&
          method.evidenceDate &&
          method.evidence.length > 0
      )
    ).toBe(true);
  });

  it("keeps historical simulations non-interactive", () => {
    expect(
      authenticationMethods
        .filter((method) => method.classification === "historical")
        .every((method) => method.status === "simulation")
    ).toBe(true);
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
