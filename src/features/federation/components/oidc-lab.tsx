"use client";

import { ExternalLink, LoaderCircle, LogIn, Unlink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import { oidcAdapter } from "@/features/federation/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

type AccountSummary = {
  id: string;
  accountId: string;
  providerId: string;
  label: string;
  createdAt: string;
};

function timerStart() {
  return performance.now();
}

async function startFlow(journey: string) {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "oidc", journey })
  });
  if (!response.ok) throw new Error("Could not start recorder flow.");
  return (await response.json() as { flow: { id: string } }).flow;
}

async function record(
  flowId: string,
  operation: string,
  ok: boolean,
  statusCode: number,
  started: number
) {
  await fetch(`/api/lab/flows/${flowId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation,
      outcome: ok ? "success" : "failure",
      statusCode,
      durationMs: Math.round(performance.now() - started)
    })
  });
}

export function OidcLab() {
  const params = useSearchParams();
  const { data: session, refetch } = authClient.useSession();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "neutral";
    text: string;
  } | null>(null);

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/lab/federation/accounts", {
      cache: "no-store"
    });
    const data = await response.json() as { accounts: AccountSummary[] };
    setAccounts(data.accounts);
  }, []);

  const loadFlow = useCallback(async (id: string) => {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }, []);

  useEffect(() => {
    // Refresh public account summaries when session ownership changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user) void loadAccounts();
    else setAccounts([]);
  }, [loadAccounts, session?.user]);

  useEffect(() => {
    const flowId = params.get("flow");
    const result = params.get("result");
    const error = params.get("error");
    if (!flowId || (!result && !error)) return;
    const marker = `oidc-callback-recorded:${flowId}`;
    if (sessionStorage.getItem(marker)) {
      // Synchronize the recorder after a redirect or browser back navigation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadFlow(flowId);
      return;
    }
    sessionStorage.setItem(marker, "1");
    const ok = !error;
    void record(flowId, "oidc-callback", ok, ok ? 302 : 401, timerStart())
      .then(() => Promise.all([loadFlow(flowId), refetch(), loadAccounts()]))
      .then(() =>
        setMessage({
          tone: ok ? "success" : "error",
          text: ok
            ? result === "linked"
              ? "Provider identity linked explicitly to the signed-in account."
              : "Provider claims validated and an opaque local session created."
            : "Federation was rejected. Existing-email conflicts require signing in locally and linking explicitly."
        })
      );
  }, [loadAccounts, loadFlow, params, refetch]);

  async function redirectToProvider(mode: "sign-in" | "link") {
    setBusy(true);
    setMessage(null);
    try {
      const flow = await startFlow(
        mode === "link" ? "oidc-linking" : "oidc-sign-in"
      );
      const callbackURL = `/methods/oidc?flow=${encodeURIComponent(flow.id)}&result=${mode === "link" ? "linked" : "signed-in"}`;
      const started = timerStart();
      const endpoint =
        mode === "link" ? "/api/auth/oauth2/link" : "/api/auth/sign-in/oauth2";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: "local-oidc",
          callbackURL,
          errorCallbackURL: `/methods/oidc?flow=${encodeURIComponent(flow.id)}`,
          disableRedirect: true,
          additionalData: { flowId: flow.id }
        })
      });
      const data = await response.json() as { url?: string };
      await record(
        flow.id,
        mode === "link" ? "oidc-link" : "oidc-authorize",
        response.ok && Boolean(data.url),
        response.status,
        started
      );
      if (!response.ok || !data.url) throw new Error("Authorization unavailable.");
      window.location.assign(data.url);
    } catch {
      setBusy(false);
      setMessage({
        tone: "error",
        text: "The relying party could not create a federation request."
      });
    }
  }

  async function unlinkAccount(item: AccountSummary) {
    setBusy(true);
    const flow = await startFlow("oidc-unlinking");
    const started = timerStart();
    const response = await fetch("/api/lab/federation/accounts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id })
    });
    await record(flow.id, "oidc-unlink", response.ok, response.status, started);
    await Promise.all([loadAccounts(), loadFlow(flow.id)]);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "Provider identity unlinked. Existing local sessions remain independently revocable."
        : "Unlinking was rejected; a federated-only account must keep at least one sign-in method."
    });
    setBusy(false);
  }

  const providerAccounts = accounts.filter(
    (item) => item.providerId === "local-oidc"
  );
  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  const [ux, flow, network, explanation, comparison] = oidcAdapter.panels;

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            <div className="form-stack">
              {session?.user ? (
                <>
                  <p className="form-message success">
                    Signed in as {session.user.email}. Linking requires this authenticated owner and matching provider email.
                  </p>
                  <button className="button" disabled={busy} onClick={() => void redirectToProvider("link")} type="button">
                    {busy ? <LoaderCircle className="animate-spin" size={15} /> : <ExternalLink size={15} />}
                    Link local OpenID identity
                  </button>
                  {providerAccounts.map((item) => (
                    <div className="session-card" key={item.id}>
                      <div className="session-top">
                        <span className="session-id">{item.label}</span>
                        <button className="button danger small" disabled={busy} onClick={() => void unlinkAccount(item)} type="button">
                          <Unlink size={13} /> Unlink
                        </button>
                      </div>
                      <p>Provider subject {item.accountId} · provider tokens encrypted at rest</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <p className="form-message neutral">
                    Redirect to a synthetic local identity provider. Auth Lab never receives that provider&apos;s authentication secret.
                  </p>
                  <button className="button" disabled={busy} onClick={() => void redirectToProvider("sign-in")} type="button">
                    {busy ? <LoaderCircle className="animate-spin" size={15} /> : <LogIn size={15} />}
                    Continue with local OpenID Provider
                  </button>
                </>
              )}
              {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
            </div>
          </PanelShell>

          <PanelShell definition={flow} index={2}>
            <div className="flow-stage" aria-label="OpenID Connect actors">
              {["User", "Browser", "Relying party", "Identity provider", "Database"].map((actor, index) => (
                <span key={actor} style={{ display: "contents" }}>
                  <span className={`flow-node${events.length > index ? " active" : ""}`}>{actor}</span>
                  {index < 4 ? <span className="flow-arrow">→</span> : null}
                </span>
              ))}
            </div>
            <div className="event-log">
              {events.length ? events.map((event) => (
                <div className="event-row" key={event.id}>
                  <span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span>
                  <span className="event-actor">{event.actor}</span>
                  <span className="event-description">{event.description}</span>
                </div>
              )) : <div className="empty-state">Run sign-in, linking, conflict, or unlinking to inspect ordered events.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={network} index={3}>
            <div className="request-list">
              {networkEvents.length ? networkEvents.map((event) => (
                <div className="request-card" key={event.id}>
                  <div className="request-summary">
                    <span className="request-method">{event.safeMetadata.method}</span>
                    <span className="request-path">{event.safeMetadata.endpoint}</span>
                    <span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode}</span>
                  </div>
                </div>
              )) : <div className="empty-state">State, nonce, verifier, code, cookies, and tokens are deliberately omitted.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {[
                ["Authentication", "OIDC tells the relying party which provider subject authenticated. OAuth alone does not define login."],
                ["Authorization", "OAuth scopes concern delegated access. The openid scope requests an identity layer; it is not an application permission model."],
                ["State", "An encrypted, browser-correlated state value binds the callback and blocks login CSRF and response mix-up."],
                ["Nonce", "A signed, expiring nonce is returned inside the ID token and checked against the authorization request."],
                ["PKCE", "The browser-bound verifier proves that the client redeeming the code started the request; only its S256 challenge crosses the front channel."],
                ["ID token", "Issuer, audience, signature, expiry, subject, verified email, and nonce are validated before local account or session creation."],
                ["Tokens", "Codes are one-minute and single-use. Provider tokens are encrypted in the database and never enter recorder metadata."],
                ["Linking", "Matching email is not silent proof. Existing identities must sign in locally and explicitly link; a provider subject cannot belong to two users."],
                ["Unlinking", "Ownership is checked and the last sign-in account cannot be removed."],
                ["Recovery", "Provider recovery and assurance become dependencies; retain an intentional local recovery and notification policy."],
                ["External adapters", "Google, GitHub, Microsoft, and Apple can implement the same boundary, but require operator credentials and provider-specific review."]
              ].map(([title, copy]) => (
                <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>
              ))}
            </div>
          </PanelShell>

          <PanelShell definition={comparison} index={5} wide>
            <ComparisonTable slugs={["saml", "oidc", "verifiable-presentation"]} />
          </PanelShell>
        </div>
      </div>
      <aside className="lab-sidebar">
        <p className="eyebrow">Protocol invariants</p>
        <p className="form-message neutral">exact redirect URI · state · issuer · nonce · PKCE S256 · signed ID token · explicit linking</p>
        <a className="method-open-link" href="/api/lab/oidc/provider/.well-known/openid-configuration" target="_blank">
          Open discovery document <ExternalLink size={12} />
        </a>
      </aside>
    </div>
  );
}
