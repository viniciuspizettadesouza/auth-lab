import { NextResponse } from "next/server";

import { federationConfig } from "@/features/federation/server/config";

export async function GET() {
  const config = federationConfig();
  return NextResponse.json({
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/authorize`,
    token_endpoint: `${config.issuer}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    scopes_supported: ["openid", "profile", "email"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["HS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    claims_supported: [
      "iss",
      "aud",
      "sub",
      "exp",
      "iat",
      "nonce",
      "name",
      "email",
      "email_verified"
    ]
  });
}
