import { describe, expect, it } from "vitest";

import { passkeyAdapter } from "@/features/passkey/adapter";
import {
  WEBAUTHN_CHALLENGE_TTL_SECONDS,
  isExpectedWebAuthnOrigin,
  webauthnRelyingParty
} from "@/features/passkey/server/config";
import { getMethodAdapter } from "@/features/method-registry";
import { authenticationMethods } from "@/lib/catalog";

describe("passkey method adapter", () => {
  it("registers one interactive recommended method with all five views", () => {
    expect(getMethodAdapter("passkey")).toBe(passkeyAdapter);
    expect(passkeyAdapter.metadata.status).toBe("interactive");
    expect(passkeyAdapter.metadata.classification).toBe("recommended");
    expect(passkeyAdapter.panels.map(({ id }) => id)).toEqual([
      "user-experience",
      "flow",
      "network-inspector",
      "explanation",
      "comparison"
    ]);
    expect(authenticationMethods.filter(({ slug }) => slug === "passkey"))
      .toEqual([passkeyAdapter.metadata]);
  });

  it("covers enrollment, authentication, revocation, and high-assurance step-up", () => {
    expect(passkeyAdapter.recorder.journeys).toEqual([
      "passkey-enrollment",
      "passkey-authentication",
      "passkey-revocation",
      "security-key-step-up"
    ]);
    expect(
      passkeyAdapter.recorder.operations["security-key-step-up-verify"]
        .completesFlow
    ).toBe(true);
    expect(
      passkeyAdapter.recorder.operations["passkey-authenticate"].failure
    ).toMatch(/weaker proof/i);
  });

  it("binds ceremonies to an exact configured origin for five minutes", () => {
    const relyingParty = webauthnRelyingParty();
    expect(WEBAUTHN_CHALLENGE_TTL_SECONDS).toBe(300);
    expect(isExpectedWebAuthnOrigin(relyingParty.origin)).toBe(true);
    expect(isExpectedWebAuthnOrigin(`${relyingParty.origin}.example`)).toBe(false);
    expect(isExpectedWebAuthnOrigin(null)).toBe(false);
  });
});
