import { createSignedNonce } from "@/features/federation/server/protocol";

export const LOCAL_OIDC_PROVIDER_ID = "local-oidc";
export const LOCAL_OIDC_CLIENT_ID = "auth-lab-web";

export function federationConfig() {
  const origin =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    "development-only-auth-lab-secret-change-me";
  return {
    origin,
    issuer: `${origin}/api/lab/oidc/provider`,
    clientId: LOCAL_OIDC_CLIENT_ID,
    clientSecret:
      process.env.LOCAL_OIDC_CLIENT_SECRET ?? `${secret}:local-oidc-client`,
    signingSecret:
      process.env.LOCAL_OIDC_SIGNING_SECRET ?? `${secret}:local-oidc-signing`,
    nonceSecret: `${secret}:local-oidc-nonce`,
    redirectUri: `${origin}/api/auth/oauth2/callback/${LOCAL_OIDC_PROVIDER_ID}`,
    createNonce: () => createSignedNonce(`${secret}:local-oidc-nonce`)
  };
}

export const localIdentities = [
  {
    sub: "local-ava",
    email: "ava@federation.auth-lab.local",
    name: "Ava Federated"
  },
  {
    sub: "local-river",
    email: "river@federation.auth-lab.local",
    name: "River Federated"
  },
  {
    sub: "local-demo-conflict",
    email: "demo@auth-lab.local",
    name: "Conflicting Demo Identity"
  }
] as const;
