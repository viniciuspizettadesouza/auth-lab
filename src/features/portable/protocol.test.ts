import {
  generateKeyPairSync,
  sign,
  type JsonWebKey
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decodeDisclosures,
  issuePortableCredential,
  portableJwkThumbprint,
  presentationDigest,
  verifyHolderProof,
  verifyPortableCredential,
  type PortablePublicJwk
} from "@/features/portable/server/protocol";

function holderFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey as PortablePublicJwk;
  return { privateKey, publicJwk };
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("portable presentation primitives", () => {
  it("issues a holder-bound credential with independently disclosable claims", () => {
    const holder = holderFixture();
    const issued = issuePortableCredential({
      holderJwk: holder.publicJwk,
      signingSecret: "issuer-test-secret",
      now: 1_000_000
    });
    const verified = verifyPortableCredential({
      issuerJwt: issued.issuerJwt,
      signingSecret: "issuer-test-secret",
      now: 1_000_000
    });
    expect(verified.ok).toBe(true);
    expect(issued.holderThumbprint).toBe(portableJwkThumbprint(holder.publicJwk));
    if (!verified.ok) throw new Error("Credential failed.");
    const selected = issued.disclosures.filter((item) => item.name === "age_over_18");
    expect(decodeDisclosures(selected.map((item) => item.encoded), verified.claims._sd as string[]))
      .toEqual({ age_over_18: true });
    expect(decodeDisclosures([encode(["salt", "unknown", "value"])], verified.claims._sd as string[])).toBeNull();
  });

  it("rejects issuer tampering and wrong issuer keys", () => {
    const holder = holderFixture();
    const issued = issuePortableCredential({ holderJwk: holder.publicJwk, signingSecret: "right-secret" });
    expect(verifyPortableCredential({ issuerJwt: issued.issuerJwt, signingSecret: "wrong-secret" }))
      .toEqual({ ok: false, reason: "invalid-credential" });
    const parts = issued.issuerJwt.split(".");
    expect(verifyPortableCredential({ issuerJwt: `${parts[0]}.${parts[1]}.AAAA`, signingSecret: "right-secret" }))
      .toEqual({ ok: false, reason: "invalid-credential" });
  });

  it("binds holder proof to the key, verifier, nonce, and disclosed presentation", () => {
    const holder = holderFixture();
    const issued = issuePortableCredential({ holderJwk: holder.publicJwk, signingSecret: "issuer-secret" });
    const disclosures = issued.disclosures.slice(0, 2).map((item) => item.encoded);
    const header = encode({ alg: "ES256", jwk: holder.publicJwk, typ: "kb+jwt" });
    const claims = encode({
      aud: "https://verifier.example",
      iat: Math.floor(Date.now() / 1_000),
      jti: "holder-proof-id-1234",
      nonce: "nonce-value",
      sd_hash: presentationDigest(issued.issuerJwt, disclosures)
    });
    const input = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(input), { key: holder.privateKey, dsaEncoding: "ieee-p1363" });
    const fixture = {
      audience: "https://verifier.example",
      expectedThumbprint: issued.holderThumbprint,
      holderProof: `${input}.${signature.toString("base64url")}`,
      nonce: "nonce-value",
      presentationHash: presentationDigest(issued.issuerJwt, disclosures)
    };
    expect(verifyHolderProof(fixture)).toEqual({ ok: true, jti: "holder-proof-id-1234" });
    expect(verifyHolderProof({ ...fixture, audience: "https://lookalike.example" }))
      .toEqual({ ok: false, reason: "invalid-holder-proof" });
    expect(verifyHolderProof({ ...fixture, nonce: "replayed-nonce" }))
      .toEqual({ ok: false, reason: "invalid-holder-proof" });
  });
});
