import { describe, expect, it } from "vitest";

import {
  createApiKey,
  createClientSecret,
  createPlatformAssertion,
  digestApiKey,
  parseApiKey,
  parseClientSecret,
  verifyPlatformAssertion
} from "@/features/workload/server/protocol";

describe("workload API key primitives", () => {
  it("creates opaque high-entropy keys with a routable non-secret id", () => {
    const generated = createApiKey();
    expect(generated.apiKey).toMatch(/^ak_lab_key_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(parseApiKey(generated.apiKey)).toEqual({ keyId: generated.keyId });
    expect(generated.hint).not.toContain(generated.apiKey.split(".")[1]);
  });

  it("creates routable client secrets and rejects malformed values", () => {
    const generated = createClientSecret();
    expect(generated.clientSecret).toMatch(/^cs_lab_secret_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(parseClientSecret(generated.clientSecret)).toEqual({ secretId: generated.secretId });
    expect(parseClientSecret(`${generated.clientSecret}x`)).toBeNull();
  });

  it("signs short-lived audience-bound platform assertions", () => {
    const assertion = createPlatformAssertion({
      audience: "https://issuer.example/token",
      principalId: "svc_12345678-1234-1234-1234-123456789abc",
      signingSecret: "test-platform-secret",
      now: 1_000_000
    });
    expect(verifyPlatformAssertion({
      assertion,
      audience: "https://issuer.example/token",
      signingSecret: "test-platform-secret",
      now: 1_000_000
    })).toMatchObject({ ok: true, principalId: "svc_12345678-1234-1234-1234-123456789abc" });
    expect(verifyPlatformAssertion({
      assertion,
      audience: "https://issuer.example/wrong",
      signingSecret: "test-platform-secret",
      now: 1_000_000
    })).toEqual({ ok: false, reason: "invalid-assertion" });
    expect(verifyPlatformAssertion({
      assertion,
      audience: "https://issuer.example/token",
      signingSecret: "wrong-secret",
      now: 1_000_000
    })).toEqual({ ok: false, reason: "invalid-assertion" });
  });

  it("rejects malformed keys and hashes secrets deterministically", () => {
    const generated = createApiKey();
    expect(parseApiKey(`${generated.apiKey}x`)).toBeNull();
    expect(parseApiKey("production-secret")).toBeNull();
    expect(digestApiKey(generated.apiKey)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digestApiKey(generated.apiKey)).not.toBe(generated.apiKey);
  });
});
