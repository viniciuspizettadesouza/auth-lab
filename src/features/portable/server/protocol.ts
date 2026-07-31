import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  verify
} from "node:crypto";

export const PORTABLE_ISSUER = "https://issuer.auth-lab.local";
export const PORTABLE_VERIFIER = "https://verifier.auth-lab.local";
export const PORTABLE_CLAIMS = {
  given_name: "Avery",
  age_over_18: true,
  membership_level: "community",
  city: "London"
} as const;

export type PortableClaimName = keyof typeof PORTABLE_CLAIMS;
export type PortablePublicJwk = {
  crv: "P-256";
  kty: "EC";
  x: string;
  y: string;
};

type CredentialClaims = {
  _sd?: unknown;
  cnf?: { jkt?: unknown };
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  jti?: unknown;
  sub?: unknown;
  vct?: unknown;
};

type HolderClaims = {
  aud?: unknown;
  iat?: unknown;
  jti?: unknown;
  nonce?: unknown;
  sd_hash?: unknown;
};

export function portableDigest(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function isPortablePublicJwk(value: unknown): value is PortablePublicJwk {
  if (!value || typeof value !== "object") return false;
  const jwk = value as Record<string, unknown>;
  return jwk.kty === "EC" && jwk.crv === "P-256" &&
    typeof jwk.x === "string" && /^[A-Za-z0-9_-]{43}$/.test(jwk.x) &&
    typeof jwk.y === "string" && /^[A-Za-z0-9_-]{43}$/.test(jwk.y);
}

export function portableJwkThumbprint(jwk: PortablePublicJwk) {
  return portableDigest(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
}

function encode(value: unknown) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

function parse<T>(value: string): T | null {
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T; }
  catch { return null; }
}

export function issuePortableCredential(input: {
  holderJwk: PortablePublicJwk;
  signingSecret: string;
  now?: number;
}) {
  const now = Math.floor((input.now ?? Date.now()) / 1_000);
  const disclosures = Object.entries(PORTABLE_CLAIMS).map(([name, value]) => {
    const encoded = encode([randomBytes(16).toString("base64url"), name, value]);
    return { encoded, name: name as PortableClaimName };
  });
  const credentialId = randomUUID();
  const header = encode({ alg: "HS256", kid: "auth-lab-portable-issuer", typ: "vc+sd-jwt" });
  const claims = encode({
    _sd: disclosures.map((item) => portableDigest(item.encoded)),
    cnf: { jkt: portableJwkThumbprint(input.holderJwk) },
    exp: now + 24 * 60 * 60,
    iat: now,
    iss: PORTABLE_ISSUER,
    jti: credentialId,
    sub: `urn:auth-lab:pairwise:${randomUUID()}`,
    vct: "https://credentials.auth-lab.local/community-card"
  });
  const signed = `${header}.${claims}`;
  const signature = createHmac("sha256", input.signingSecret).update(signed).digest("base64url");
  return {
    credentialId,
    disclosures,
    expiresAt: new Date((now + 24 * 60 * 60) * 1_000),
    issuerJwt: `${signed}.${signature}`,
    holderThumbprint: portableJwkThumbprint(input.holderJwk)
  };
}

export function verifyPortableCredential(input: {
  issuerJwt: string;
  signingSecret: string;
  now?: number;
}) {
  const parts = input.issuerJwt.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "invalid-credential" as const };
  const [headerPart = "", claimsPart = "", signaturePart = ""] = parts;
  const header = parse<Record<string, unknown>>(headerPart);
  const claims = parse<CredentialClaims>(claimsPart);
  const expected = createHmac("sha256", input.signingSecret).update(`${headerPart}.${claimsPart}`).digest();
  const actual = Buffer.from(signaturePart, "base64url");
  const now = Math.floor((input.now ?? Date.now()) / 1_000);
  if (!header || header.alg !== "HS256" || header.typ !== "vc+sd-jwt" || header.kid !== "auth-lab-portable-issuer" ||
    !claims || claims.iss !== PORTABLE_ISSUER || claims.vct !== "https://credentials.auth-lab.local/community-card" ||
    typeof claims.jti !== "string" || typeof claims.sub !== "string" || !Array.isArray(claims._sd) ||
    !claims._sd.every((item) => typeof item === "string") || typeof claims.cnf?.jkt !== "string" ||
    typeof claims.iat !== "number" || claims.iat > now + 30 || typeof claims.exp !== "number" || claims.exp <= now ||
    actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false as const, reason: "invalid-credential" as const };
  }
  return { ok: true as const, claims: claims as Required<CredentialClaims> };
}

export function decodeDisclosures(encodedDisclosures: string[], allowedDigests: unknown[]) {
  const result: Partial<Record<PortableClaimName, string | boolean>> = {};
  for (const encoded of encodedDisclosures) {
    if (!allowedDigests.includes(portableDigest(encoded))) return null;
    const disclosure = parse<unknown[]>(encoded);
    if (!disclosure || disclosure.length !== 3 || typeof disclosure[1] !== "string" ||
      !(disclosure[1] in PORTABLE_CLAIMS) || disclosure[1] in result) return null;
    result[disclosure[1] as PortableClaimName] = disclosure[2] as string | boolean;
  }
  return result;
}

export function presentationDigest(issuerJwt: string, disclosures: string[]) {
  return portableDigest([issuerJwt, ...disclosures].join("~"));
}

export function verifyHolderProof(input: {
  audience: string;
  expectedThumbprint: string;
  holderProof: string;
  nonce: string;
  presentationHash: string;
  now?: number;
}) {
  const parts = input.holderProof.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "invalid-holder-proof" as const };
  const [headerPart = "", claimsPart = "", signaturePart = ""] = parts;
  const header = parse<Record<string, unknown>>(headerPart);
  const claims = parse<HolderClaims>(claimsPart);
  const now = Math.floor((input.now ?? Date.now()) / 1_000);
  if (!header || header.alg !== "ES256" || header.typ !== "kb+jwt" || !isPortablePublicJwk(header.jwk) ||
    portableJwkThumbprint(header.jwk) !== input.expectedThumbprint || !claims || claims.aud !== input.audience ||
    claims.nonce !== input.nonce || claims.sd_hash !== input.presentationHash ||
    typeof claims.jti !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(claims.jti) ||
    typeof claims.iat !== "number" || Math.abs(now - claims.iat) > 60) {
    return { ok: false as const, reason: "invalid-holder-proof" as const };
  }
  try {
    const valid = verify("sha256", Buffer.from(`${headerPart}.${claimsPart}`), {
      key: createPublicKey({ key: header.jwk, format: "jwk" }), dsaEncoding: "ieee-p1363"
    }, Buffer.from(signaturePart, "base64url"));
    return valid ? { ok: true as const, jti: claims.jti } : { ok: false as const, reason: "invalid-holder-proof" as const };
  } catch { return { ok: false as const, reason: "invalid-holder-proof" as const }; }
}
