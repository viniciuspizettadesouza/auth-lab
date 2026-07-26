import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export type LocalIdentity = {
  sub: string;
  email: string;
  name: string;
};

export type IdTokenClaims = LocalIdentity & {
  iss: string;
  aud: string;
  nonce: string;
  email_verified: true;
  iat: number;
  exp: number;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function equalStrings(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function randomOpaque(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function createSignedNonce(secret: string, now = Date.now()) {
  const payload = base64Url(
    JSON.stringify({ random: randomOpaque(18), issuedAt: Math.floor(now / 1000) })
  );
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySignedNonce(
  nonce: string,
  secret: string,
  now = Date.now()
) {
  const [payload, received, extra] = nonce.split(".");
  if (!payload || !received || extra || !equalStrings(received, signature(payload, secret))) {
    return false;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { issuedAt?: unknown };
    return (
      typeof parsed.issuedAt === "number" &&
      parsed.issuedAt <= Math.floor(now / 1000) + 30 &&
      parsed.issuedAt >= Math.floor(now / 1000) - 600
    );
  } catch {
    return false;
  }
}

export function signIdToken(claims: IdTokenClaims, secret: string) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "local-hs256" }));
  const payload = base64Url(JSON.stringify(claims));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signature(unsigned, secret)}`;
}

export function verifyIdToken(
  compact: string,
  {
    audience,
    issuer,
    nonceSecret,
    signingSecret,
    now = Date.now()
  }: {
    audience: string;
    issuer: string;
    nonceSecret: string;
    signingSecret: string;
    now?: number;
  }
): IdTokenClaims | null {
  const [header, payload, received, extra] = compact.split(".");
  if (!header || !payload || !received || extra) return null;
  const unsigned = `${header}.${payload}`;
  if (!equalStrings(received, signature(unsigned, signingSecret))) return null;
  try {
    const parsedHeader = JSON.parse(
      Buffer.from(header, "base64url").toString("utf8")
    ) as { alg?: unknown };
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as IdTokenClaims;
    const seconds = Math.floor(now / 1000);
    if (
      parsedHeader.alg !== "HS256" ||
      claims.iss !== issuer ||
      claims.aud !== audience ||
      claims.exp <= seconds ||
      claims.iat > seconds + 30 ||
      claims.email_verified !== true ||
      !claims.sub ||
      !claims.email ||
      !claims.name ||
      !verifySignedNonce(claims.nonce, nonceSecret, now)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
