import { NextRequest, NextResponse } from "next/server";

import { exchangeAuthorizationCode } from "@/features/federation/server/provider";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  if (form.get("grant_type") !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }
  try {
    const tokens = await exchangeAuthorizationCode({
      clientId: String(form.get("client_id") ?? ""),
      clientSecret: String(form.get("client_secret") ?? ""),
      code: String(form.get("code") ?? ""),
      codeVerifier: String(form.get("code_verifier") ?? ""),
      redirectUri: String(form.get("redirect_uri") ?? "")
    });
    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: 300,
        id_token: tokens.idToken,
        scope: tokens.scopes.join(" ")
      },
      { headers: { "cache-control": "no-store", pragma: "no-cache" } }
    );
  } catch (error) {
    const code =
      error instanceof Error && error.message === "invalid_client"
        ? "invalid_client"
        : "invalid_grant";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
