export const WEBAUTHN_CHALLENGE_TTL_SECONDS = 300;

export function webauthnRelyingParty() {
  const configuredUrl =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const url = new URL(configuredUrl);
  return {
    origin: url.origin,
    rpID: url.hostname,
    rpName: "Auth Lab"
  };
}

export function isExpectedWebAuthnOrigin(origin: string | null) {
  return origin === webauthnRelyingParty().origin;
}
