import { NextRequest, NextResponse } from "next/server";

import {
  federationConfig,
  localIdentities
} from "@/features/federation/server/config";
import { issueAuthorizationCode } from "@/features/federation/server/provider";
import { getVisitorIdFromHeaders } from "@/lib/visitor";
import { appendOwnedEvent } from "@/services/recorder/service";

type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  flow: string;
  nonce: string;
  redirectUri: string;
  scope: string;
  state: string;
};

function parseAuthorizationRequest(params: URLSearchParams): AuthorizationRequest | null {
  const config = federationConfig();
  const request = {
    clientId: params.get("client_id") ?? "",
    codeChallenge: params.get("code_challenge") ?? "",
    flow: params.get("flow") ?? "",
    nonce: params.get("nonce") ?? "",
    redirectUri: params.get("redirect_uri") ?? "",
    scope: params.get("scope") ?? "",
    state: params.get("state") ?? ""
  };
  if (
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256" ||
    request.clientId !== config.clientId ||
    request.redirectUri !== config.redirectUri ||
    !request.scope.split(" ").includes("openid") ||
    !request.codeChallenge ||
    !request.nonce ||
    !request.state
  ) {
    return null;
  }
  return request;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(request: NextRequest) {
  const authorization = parseAuthorizationRequest(request.nextUrl.searchParams);
  if (!authorization) {
    return new NextResponse("Invalid OpenID Connect authorization request.", {
      status: 400
    });
  }
  const hidden = [
    ["client_id", authorization.clientId],
    ["redirect_uri", authorization.redirectUri],
    ["scope", authorization.scope],
    ["state", authorization.state],
    ["nonce", authorization.nonce],
    ["code_challenge", authorization.codeChallenge],
    ["flow", authorization.flow]
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`
    )
    .join("");
  const identities = localIdentities
    .map(
      (identity, index) => `
        <label class="identity">
          <input type="radio" name="subject" value="${escapeHtml(identity.sub)}" ${index === 0 ? "checked" : ""}>
          <span><strong>${escapeHtml(identity.name)}</strong><small>${escapeHtml(identity.email)}</small></span>
        </label>`
    )
    .join("");
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>Local identity provider</title><style>
    :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#07100e;color:#e9f2ee}
    body{min-height:100vh;display:grid;place-items:center;margin:0;padding:24px;background:radial-gradient(circle at top,#17352b,#07100e 55%)}
    main{width:min(560px,100%);border:1px solid #345c4f;border-radius:18px;background:#0b1613;padding:30px;box-shadow:0 24px 80px #0008}
    .eyebrow{color:#72f5ae;font:700 11px monospace;letter-spacing:.14em;text-transform:uppercase} h1{font-size:30px;margin:10px 0}
    p{color:#9badA6;line-height:1.6}.identity{display:flex;gap:12px;align-items:center;border:1px solid #27463c;border-radius:10px;padding:14px;margin:10px 0;cursor:pointer}
    .identity:has(input:checked){border-color:#72f5ae;background:#72f5ae10}.identity span{display:grid;gap:4px}.identity small{color:#9bada6}
    button{width:100%;border:0;border-radius:9px;background:#72f5ae;color:#07100e;font-weight:750;padding:13px;margin-top:15px;cursor:pointer}
    .notice{font:11px/1.5 monospace;color:#e8b86d;border:1px solid #e8b86d55;border-radius:8px;padding:10px}
    code{color:#7de7ef}</style></head><body><main>
    <div class="eyebrow">Local provider · consent</div><h1>Continue to Auth Lab?</h1>
    <p>The relying party requests <code>openid profile email</code>. The third identity intentionally shares the seeded demo email so you can inspect conflict handling.</p>
    <div class="notice">Simulation boundary: the provider identity chooser is local and synthetic. The Authorization Code, PKCE, state, nonce, signed ID token, linking, and session behavior are real.</div>
    <form method="post">${hidden}${identities}<button type="submit">Approve and redirect</button></form>
    </main></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
      }
    }
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const key of [
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "nonce",
    "code_challenge",
    "flow"
  ]) {
    const value = form.get(key);
    if (typeof value === "string") params.set(key, value);
  }
  params.set("response_type", "code");
  params.set("code_challenge_method", "S256");
  const authorization = parseAuthorizationRequest(params);
  const subject = form.get("subject");
  const identity =
    typeof subject === "string"
      ? localIdentities.find((candidate) => candidate.sub === subject)
      : null;
  if (!authorization || !identity) {
    return new NextResponse("Invalid authorization approval.", { status: 400 });
  }

  const code = await issueAuthorizationCode({
    ...authorization,
    subject: identity.sub,
    email: identity.email,
    name: identity.name
  });
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (visitorId && authorization.flow) {
    await appendOwnedEvent(authorization.flow, visitorId, {
      actor: "application",
      action: "oidc.provider-approved",
      description:
        "The local provider authenticated a synthetic identity, captured consent, and issued a one-minute authorization code.",
      outcome: "success",
      metadata: {
        endpoint: "/api/lab/oidc/provider/authorize",
        method: "POST",
        statusCode: 302
      }
    });
  }
  const callback = new URL(authorization.redirectUri);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", authorization.state);
  callback.searchParams.set("iss", federationConfig().issuer);
  return NextResponse.redirect(callback, 303);
}
