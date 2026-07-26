import { describe, expect, it } from "vitest";

import {
  createSignedNonce,
  sha256,
  signIdToken,
  verifyIdToken,
  verifySignedNonce
} from "@/features/federation/server/protocol";

describe("local OIDC protocol boundary", () => {
  const nonceSecret = "test-nonce-secret";
  const signingSecret = "test-signing-secret";
  const now = Date.UTC(2026, 6, 26, 12, 0, 0);

  it("creates an S256 PKCE challenge and a short-lived signed nonce", () => {
    expect(sha256("known-verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const nonce = createSignedNonce(nonceSecret, now);
    expect(verifySignedNonce(nonce, nonceSecret, now + 60_000)).toBe(true);
    expect(verifySignedNonce(nonce, "wrong-secret", now)).toBe(false);
    expect(verifySignedNonce(nonce, nonceSecret, now + 601_000)).toBe(false);
  });

  it("validates signature, issuer, audience, expiry, and nonce", () => {
    const nonce = createSignedNonce(nonceSecret, now);
    const token = signIdToken(
      {
        iss: "https://issuer.example",
        aud: "client",
        sub: "subject",
        email: "user@example.com",
        email_verified: true,
        name: "Test User",
        nonce,
        iat: now / 1000,
        exp: now / 1000 + 300
      },
      signingSecret
    );
    expect(
      verifyIdToken(token, {
        audience: "client",
        issuer: "https://issuer.example",
        nonceSecret,
        signingSecret,
        now
      })?.sub
    ).toBe("subject");
    expect(
      verifyIdToken(token, {
        audience: "another-client",
        issuer: "https://issuer.example",
        nonceSecret,
        signingSecret,
        now
      })
    ).toBeNull();
    expect(
      verifyIdToken(`${token.slice(0, -1)}x`, {
        audience: "client",
        issuer: "https://issuer.example",
        nonceSecret,
        signingSecret,
        now
      })
    ).toBeNull();
    expect(
      verifyIdToken(token, {
        audience: "client",
        issuer: "https://issuer.example",
        nonceSecret,
        signingSecret,
        now: now + 301_000
      })
    ).toBeNull();
  });
});
