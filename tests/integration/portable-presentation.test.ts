import {
  generateKeyPairSync,
  randomUUID,
  sign,
  type JsonWebKey
} from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  presentationDigest,
  type PortablePublicJwk
} from "@/features/portable/server/protocol";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("portable presentation boundary", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let service: typeof import("@/features/portable/server/service");
  const visitorId = `portable-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey as PortablePublicJwk;
  const credentialIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    service = await import("@/features/portable/server/service");
  });

  afterAll(async () => {
    for (const credentialId of credentialIds) {
      await database.db.delete(schema.portableCredential).where(eq(schema.portableCredential.id, credentialId));
    }
    await database.db.delete(schema.portablePresentationRequest).where(eq(schema.portablePresentationRequest.visitorId, visitorId));
    await database.sqlClient.end({ timeout: 5 });
  });

  function proof(input: {
    audience: string;
    disclosures: string[];
    issuerJwt: string;
    nonce: string;
    jti?: string;
  }) {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const header = encode({ alg: "ES256", jwk: publicJwk, typ: "kb+jwt" });
    const claims = encode({
      aud: input.audience,
      iat: Math.floor(Date.now() / 1_000),
      jti: input.jti ?? `proof-${randomUUID()}`,
      nonce: input.nonce,
      sd_hash: presentationDigest(input.issuerJwt, input.disclosures)
    });
    const signed = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(signed), { key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${signed}.${signature.toString("base64url")}`;
  }

  it("selectively discloses required claims and rejects request replay", async () => {
    const credential = await service.issueCredential(visitorId, publicJwk);
    if (!credential) throw new Error("No credential.");
    credentialIds.push(credential.credentialId);
    const request = await service.createPresentationRequest({
      requestedClaims: ["age_over_18", "membership_level"], visitorId
    });
    const disclosures = credential.disclosures
      .filter((item) => request.requestedClaims.includes(item.name))
      .map((item) => item.encoded);
    const input = {
      disclosures,
      holderProof: proof({ audience: request.audience, disclosures, issuerJwt: credential.issuerJwt, nonce: request.nonce }),
      issuerJwt: credential.issuerJwt,
      nonce: request.nonce,
      requestId: request.requestId,
      visitorId
    };
    expect(await service.verifyPresentation(input)).toMatchObject({
      ok: true,
      disclosed: { age_over_18: true, membership_level: "community" }
    });
    expect(await service.verifyPresentation(input)).toEqual({ ok: false, reason: "invalid-or-consumed-request" });
    expect(await service.verifyPresentation({ ...input, visitorId: "different-owner" }))
      .toEqual({ ok: false, reason: "invalid-or-consumed-request" });
  });

  it("enforces denial, expiry, status revocation, and minimum disclosure", async () => {
    const credential = await service.issueCredential(visitorId, publicJwk);
    if (!credential) throw new Error("No credential.");
    credentialIds.push(credential.credentialId);
    const denied = await service.createPresentationRequest({ requestedClaims: ["city"], visitorId });
    expect(await service.denyPresentationRequest(visitorId, denied.requestId)).toBe(true);
    expect(await service.denyPresentationRequest("different-owner", denied.requestId)).toBe(false);

    const missing = await service.createPresentationRequest({ requestedClaims: ["age_over_18", "city"], visitorId });
    const disclosures = credential.disclosures.filter((item) => item.name === "age_over_18").map((item) => item.encoded);
    expect(await service.verifyPresentation({
      disclosures,
      holderProof: proof({ audience: missing.audience, disclosures, issuerJwt: credential.issuerJwt, nonce: missing.nonce }),
      issuerJwt: credential.issuerJwt, nonce: missing.nonce,
      requestId: missing.requestId, visitorId
    })).toEqual({ ok: false, reason: "missing-or-invalid-disclosure" });

    const expired = await service.createPresentationRequest({ requestedClaims: ["age_over_18"], visitorId });
    await database.db.update(schema.portablePresentationRequest)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(schema.portablePresentationRequest.id, expired.requestId));
    expect(await service.verifyPresentation({
      disclosures,
      holderProof: proof({ audience: expired.audience, disclosures, issuerJwt: credential.issuerJwt, nonce: expired.nonce }),
      issuerJwt: credential.issuerJwt, nonce: expired.nonce,
      requestId: expired.requestId, visitorId
    })).toEqual({ ok: false, reason: "expired-request" });

    expect(await service.revokeCredential(visitorId, credential.credentialId)).toBe(true);
    const afterRevocation = await service.createPresentationRequest({ requestedClaims: ["age_over_18"], visitorId });
    const selected = credential.disclosures.filter((item) => item.name === "age_over_18").map((item) => item.encoded);
    expect(await service.verifyPresentation({
      disclosures: selected,
      holderProof: proof({ audience: afterRevocation.audience, disclosures: selected, issuerJwt: credential.issuerJwt, nonce: afterRevocation.nonce }),
      issuerJwt: credential.issuerJwt, nonce: afterRevocation.nonce,
      requestId: afterRevocation.requestId, visitorId
    })).toEqual({ ok: false, reason: "revoked-or-unknown-credential" });
  });
});
