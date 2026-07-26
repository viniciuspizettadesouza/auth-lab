import { describe, expect, it } from "vitest";

import {
  authenticationMethods,
  classificationOrder,
  comparisonMethods,
  learningTracks,
  tieredMethods,
  tierTracks
} from "@/lib/catalog";
import { evidenceSources } from "@/lib/evidence";

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

    const sourceIds = new Set(Object.keys(evidenceSources));
    expect(
      authenticationMethods.every((method) =>
        method.evidence.every(
          (evidence) =>
            sourceIds.has(evidence.id) &&
            evidence.publisher &&
            evidence.title &&
            evidence.status &&
            evidence.reviewedAt &&
            evidence.supports.length > 0
        )
      )
    ).toBe(true);
  });

  it("labels evolving WebAuthn and FIDO specifications without presenting them as final", () => {
    expect(evidenceSources["w3c-webauthn-2"].status).toBe("recommendation");
    expect(evidenceSources["w3c-webauthn-3"].status).toBe(
      "candidate-recommendation"
    );
    expect(evidenceSources["fido-ctap-2.3"].status).toBe("proposed-standard");
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
