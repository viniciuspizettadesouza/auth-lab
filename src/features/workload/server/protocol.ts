import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

export const WORKLOAD_AUDIENCE = "https://api.auth-lab.local/orders";
export const WORKLOAD_SCOPES = ["orders.read", "orders.write"] as const;

export function digestApiKey(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function createApiKey() {
  const keyId = `key_${randomUUID()}`;
  const secret = randomBytes(32).toString("base64url");
  return {
    apiKey: `ak_lab_${keyId}.${secret}`,
    hint: `ak_lab_${keyId.slice(0, 12)}…`,
    keyId
  };
}

export function parseApiKey(value: string) {
  const match = /^ak_lab_(key_[0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
  return match ? { keyId: match[1] as string } : null;
}

export function createClientSecret() {
  const secretId = `secret_${randomUUID()}`;
  const secret = randomBytes(32).toString("base64url");
  return {
    clientSecret: `cs_lab_${secretId}.${secret}`,
    hint: `cs_lab_${secretId.slice(0, 15)}…`,
    secretId
  };
}

export function parseClientSecret(value: string) {
  const match = /^cs_lab_(secret_[0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
  return match ? { secretId: match[1] as string } : null;
}

type PlatformClaims = {
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  jti?: unknown;
  sub?: unknown;
};

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function createPlatformAssertion(input: {
  audience: string;
  principalId: string;
  signingSecret: string;
  now?: number;
}) {
  const now = Math.floor((input.now ?? Date.now()) / 1_000);
  const header = encode(JSON.stringify({ alg: "HS256", kid: "auth-lab-platform", typ: "JWT" }));
  const claims = encode(JSON.stringify({
    aud: input.audience,
    exp: now + 60,
    iat: now,
    iss: "https://platform.auth-lab.local",
    jti: randomUUID(),
    sub: input.principalId
  }));
  const signed = `${header}.${claims}`;
  const signature = createHmac("sha256", input.signingSecret).update(signed).digest("base64url");
  return `${signed}.${signature}`;
}

export function verifyPlatformAssertion(input: {
  assertion: string;
  audience: string;
  signingSecret: string;
  now?: number;
}) {
  const parts = input.assertion.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "invalid-assertion" as const };
  const [header = "", claimsPart = "", signature = ""] = parts;
  let claims: PlatformClaims;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Record<string, unknown>;
    claims = JSON.parse(Buffer.from(claimsPart, "base64url").toString("utf8")) as PlatformClaims;
    if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT" || parsedHeader.kid !== "auth-lab-platform") {
      return { ok: false as const, reason: "invalid-assertion" as const };
    }
  } catch {
    return { ok: false as const, reason: "invalid-assertion" as const };
  }
  const expected = createHmac("sha256", input.signingSecret)
    .update(`${header}.${claimsPart}`)
    .digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return { ok: false as const, reason: "invalid-assertion" as const }; }
  const now = Math.floor((input.now ?? Date.now()) / 1_000);
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected) ||
    claims.iss !== "https://platform.auth-lab.local" ||
    claims.aud !== input.audience ||
    typeof claims.sub !== "string" ||
    !claims.sub.startsWith("svc_") ||
    typeof claims.jti !== "string" ||
    !/^[0-9a-f-]{36}$/.test(claims.jti) ||
    typeof claims.iat !== "number" ||
    claims.iat > now + 30 ||
    claims.iat < now - 60 ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    claims.exp > now + 90
  ) return { ok: false as const, reason: "invalid-assertion" as const };
  return {
    ok: true as const,
    expiresAt: new Date(claims.exp * 1_000),
    jti: claims.jti,
    principalId: claims.sub
  };
}
