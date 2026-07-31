import {
  generateKeyPairSync,
  sign,
  type JsonWebKey
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  jwkThumbprint,
  sha256,
  verifyDpopProof,
  type DpopPublicJwk
} from "@/features/session-token/server/dpop";

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function fixture({
  accessToken = "local-access-token",
  htm = "GET",
  htu = "http://localhost:3000/api/lab/dpop/resource",
  iat = Math.floor(Date.now() / 1_000),
  jti = "proof-identifier-1234"
} = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256"
  });
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey as DpopPublicJwk;
  const header = encode(JSON.stringify({
    alg: "ES256",
    jwk: publicJwk,
    typ: "dpop+jwt"
  }));
  const claims = encode(JSON.stringify({
    ath: sha256(accessToken),
    htm,
    htu,
    iat,
    jti
  }));
  const input = `${header}.${claims}`;
  const signature = sign(
    "sha256",
    Buffer.from(input),
    { key: privateKey, dsaEncoding: "ieee-p1363" }
  );
  return {
    accessToken,
    expectedMethod: "GET",
    expectedThumbprint: jwkThumbprint(publicJwk),
    expectedUri: "http://localhost:3000/api/lab/dpop/resource",
    proof: `${input}.${encode(signature)}`
  };
}

describe("DPoP proof boundary", () => {
  it("accepts an ES256 proof bound to the key, token, method, URI, and current time", () => {
    expect(verifyDpopProof(fixture())).toEqual({
      ok: true,
      jti: "proof-identifier-1234"
    });
  });

  it("rejects URI, token, and time mismatches", () => {
    const valid = fixture();
    expect(
      verifyDpopProof({ ...valid, expectedUri: "http://localhost/wrong" })
    ).toEqual({ ok: false, reason: "invalid-proof" });
    expect(
      verifyDpopProof({ ...valid, accessToken: "stolen-different-token" })
    ).toEqual({ ok: false, reason: "invalid-proof" });
    const old = fixture({ iat: Math.floor(Date.now() / 1_000) - 61 });
    expect(verifyDpopProof(old)).toEqual({
      ok: false,
      reason: "invalid-proof"
    });
  });

  it("rejects signature tampering", () => {
    const valid = fixture();
    expect(
      verifyDpopProof({ ...valid, proof: `${valid.proof.slice(0, -1)}x` })
    ).toEqual({ ok: false, reason: "invalid-proof" });
  });
});
