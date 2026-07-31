"use client";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/server";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  KeyRound,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent, SessionSummary } from "@/contracts";
import {
  cookieSessionAdapter,
  dpopAdapter
} from "@/features/session-token/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

type SessionPolicy = {
  absoluteLifetimeSeconds: number;
  slidingRenewalSeconds: number;
  freshAuthenticationSeconds: number;
  cookie: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
  };
  fixationDefense: string;
};

type RiskScenario =
  | "routine-profile-view"
  | "new-device-export"
  | "change-recovery";

type RiskResult = {
  allowed?: boolean;
  assurance?: string;
  reason?: string;
  risk?: string;
};

type DpopKey = {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
};

type DpopGrant = {
  accessToken: string;
  expiresAt: string;
};

function encode(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function tokenHash(token: string) {
  return encode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

async function createDpopProof(
  key: DpopKey,
  accessToken: string,
  uri: string
) {
  const header = encode(
    JSON.stringify({ alg: "ES256", jwk: key.publicJwk, typ: "dpop+jwt" })
  );
  const claims = encode(
    JSON.stringify({
      ath: await tokenHash(accessToken),
      htm: "GET",
      htu: uri,
      iat: Math.floor(Date.now() / 1_000),
      jti: crypto.randomUUID()
    })
  );
  const signingInput = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key.privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${encode(signature)}`;
}

async function startFlow(method: string, journey: string) {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, journey })
  });
  if (!response.ok) throw new Error("Could not start recorder flow.");
  return (await response.json() as { flow: { id: string } }).flow;
}

async function recordOutcome(
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

function secondsLabel(seconds: number) {
  if (seconds % 86_400 === 0) return `${seconds / 86_400} days`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hours`;
  return `${seconds / 60} minutes`;
}

export function SessionTokenLab() {
  const { data: authSession, refetch } = authClient.useSession();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [policy, setPolicy] = useState<SessionPolicy | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "neutral";
    text: string;
  } | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const riskFlow = useRef<string | null>(null);
  const dpopKey = useRef<DpopKey | null>(null);
  const dpopGrant = useRef<DpopGrant | null>(null);
  const lastProof = useRef<string | null>(null);
  const dpopFlow = useRef<string | null>(null);
  const [dpopState, setDpopState] = useState<"idle" | "issued" | "used" | "replayed">("idle");

  const loadFlow = useCallback(async (id: string) => {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }, []);

  const loadSessions = useCallback(async (record = false) => {
    const flow = record
      ? await startFlow("cookie-session", "session-lifecycle")
      : null;
    const started = performance.now();
    const response = await fetch("/api/lab/sessions", { cache: "no-store" });
    if (flow) {
      await recordOutcome(
        flow.id,
        "session-list",
        response.ok,
        response.status,
        started
      );
      await loadFlow(flow.id);
    }
    if (!response.ok) {
      setSessions([]);
      setPolicy(null);
      return;
    }
    const data = await response.json() as {
      sessions: SessionSummary[];
      policy: SessionPolicy;
    };
    setSessions(data.sessions);
    setPolicy(data.policy);
  }, [loadFlow]);

  useEffect(() => {
    // Refresh owned, token-free summaries when the authenticated owner changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authSession?.user) void loadSessions();
    else {
      setSessions([]);
      setPolicy(null);
    }
  }, [authSession?.user, loadSessions]);

  async function revoke(id: string) {
    setBusy(true);
    const response = await fetch(`/api/lab/sessions/${id}`, { method: "DELETE" });
    await Promise.all([loadSessions(), refetch()]);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "Selected server-side session revoked."
        : "Session revocation was rejected."
    });
    setBusy(false);
  }

  async function revokeOthers() {
    setBusy(true);
    const flow = await startFlow("cookie-session", "session-lifecycle");
    const started = performance.now();
    const response = await fetch("/api/lab/sessions/others", { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as {
      error?: string;
      revoked?: number;
    };
    await recordOutcome(
      flow.id,
      "session-revoke-others",
      response.ok,
      response.status,
      started
    );
    await Promise.all([loadSessions(), loadFlow(flow.id)]);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? `${data.revoked ?? 0} other session(s) revoked; this session remains active.`
        : data.error ?? "Concurrent-session revocation failed."
    });
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    await refetch();
    setMessage({ tone: "success", text: "Logout revoked the current session and cleared its cookie." });
    setBusy(false);
  }

  async function evaluate(scenario: RiskScenario, existingFlow?: string) {
    const flowId =
      existingFlow ??
      (await startFlow("cookie-session", "risk-step-up")).id;
    riskFlow.current = flowId;
    const started = performance.now();
    const response = await fetch("/api/lab/sessions/risk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario })
    });
    const result = await response.json() as RiskResult;
    await recordOutcome(
      flowId,
      "risk-evaluate",
      response.ok,
      response.status,
      started
    );
    await loadFlow(flowId);
    setRisk(result);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: result.reason ?? "Risk policy evaluated."
    });
    return response.ok;
  }

  async function stepUp() {
    setBusy(true);
    try {
      const flowId =
        riskFlow.current ??
        (await startFlow("cookie-session", "risk-step-up")).id;
      riskFlow.current = flowId;
      let started = performance.now();
      const optionsResponse = await fetch("/api/lab/passkeys/step-up/options", {
        method: "POST"
      });
      await recordOutcome(
        flowId,
        "risk-step-up-options",
        optionsResponse.ok,
        optionsResponse.status,
        started
      );
      if (!optionsResponse.ok) throw new Error("Register a roaming security key first.");
      const data = await optionsResponse.json() as {
        challengeId: string;
        options: PublicKeyCredentialRequestOptionsJSON;
      };
      const assertion = await startAuthentication({ optionsJSON: data.options });
      started = performance.now();
      const response = await fetch("/api/lab/passkeys/step-up/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: data.challengeId,
          response: assertion satisfies AuthenticationResponseJSON
        })
      });
      await recordOutcome(
        flowId,
        "risk-step-up-verify",
        response.ok,
        response.status,
        started
      );
      if (!response.ok) throw new Error("Security-key proof was rejected.");
      await evaluate("new-device-export", flowId);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Step-up was cancelled."
      });
    } finally {
      if (riskFlow.current) await loadFlow(riskFlow.current);
      setBusy(false);
    }
  }

  async function issueDpop() {
    setBusy(true);
    try {
      const flow = await startFlow("dpop", "dpop-resource");
      dpopFlow.current = flow.id;
      const pair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign", "verify"]
      );
      const key = {
        privateKey: pair.privateKey,
        publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey)
      };
      const started = performance.now();
      const response = await fetch("/api/lab/dpop/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicJwk: key.publicJwk })
      });
      await recordOutcome(flow.id, "dpop-issue", response.ok, response.status, started);
      if (!response.ok) throw new Error("DPoP grant issuance was rejected.");
      dpopKey.current = key;
      dpopGrant.current = await response.json() as DpopGrant;
      lastProof.current = null;
      setDpopState("issued");
      await loadFlow(flow.id);
      setMessage({
        tone: "success",
        text: "Short-lived grant issued. The non-exportable private key remains only in this tab."
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create a DPoP key."
      });
    } finally {
      setBusy(false);
    }
  }

  async function callDpop(replay = false) {
    if (!dpopKey.current || !dpopGrant.current || !dpopFlow.current) return;
    setBusy(true);
    const uri = `${location.origin}/api/lab/dpop/resource`;
    const proof =
      replay && lastProof.current
        ? lastProof.current
        : await createDpopProof(
            dpopKey.current,
            dpopGrant.current.accessToken,
            uri
          );
    if (!replay) lastProof.current = proof;
    const started = performance.now();
    const response = await fetch(uri, {
      headers: {
        authorization: `DPoP ${dpopGrant.current.accessToken}`,
        dpop: proof
      }
    });
    await recordOutcome(
      dpopFlow.current,
      replay ? "dpop-replay" : "dpop-resource",
      response.ok,
      response.status,
      started
    );
    await loadFlow(dpopFlow.current);
    setDpopState(replay ? "replayed" : response.ok ? "used" : "issued");
    setMessage({
      tone: replay ? (response.ok ? "error" : "success") : response.ok ? "success" : "error",
      text: replay
        ? response.ok
          ? "Replay was unexpectedly accepted."
          : "The same signed proof was rejected as a replay."
        : response.ok
          ? "The resource validated the token binding and consumed this proof ID."
          : "The sender-constrained request was rejected."
    });
    setBusy(false);
  }

  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  const [ux, flow, network, explanation, comparison] = cookieSessionAdapter.panels;

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            {authSession?.user ? (
              <div className="form-stack">
                <p className="form-message success">Signed in as {authSession.user.email}</p>
                <div className="button-row">
                  <button className="button secondary" disabled={busy} onClick={() => void loadSessions(true)} type="button">
                    <RefreshCw size={14} /> Inspect lifecycle
                  </button>
                  <button className="button secondary" disabled={busy} onClick={() => void revokeOthers()} type="button">
                    <Trash2 size={14} /> Revoke other sessions
                  </button>
                  <button className="button danger" disabled={busy} onClick={() => void signOut()} type="button">
                    <LogOut size={14} /> Log out
                  </button>
                </div>
                {sessions.map((item) => (
                  <div className="session-card" key={item.id}>
                    <div className="session-top">
                      <span className="session-id">{item.current ? "Current session" : "Concurrent session"}</span>
                      {!item.current ? (
                        <button aria-label="Revoke session" className="button danger small" disabled={busy} onClick={() => void revoke(item.id)} type="button">
                          Revoke
                        </button>
                      ) : null}
                    </div>
                    <p>Expires {new Date(item.expiresAt).toLocaleString()} · {item.userAgent ?? "unknown client"}</p>
                  </div>
                ))}
                <hr className="panel-rule" />
                <strong>Risk-triggered authorization</strong>
                <div className="button-row">
                  <button className="button secondary" disabled={busy} onClick={() => void evaluate("routine-profile-view")} type="button">Routine read</button>
                  <button className="button secondary" disabled={busy} onClick={() => void evaluate("new-device-export")} type="button">New-device export</button>
                </div>
                {risk && !risk.allowed ? (
                  <button className="button" disabled={busy} onClick={() => void stepUp()} type="button">
                    <ShieldCheck size={14} /> Complete security-key step-up
                  </button>
                ) : null}
                <hr className="panel-rule" />
                <strong>DPoP proof of possession</strong>
                <div className="button-row">
                  <button className="button" disabled={busy} onClick={() => void issueDpop()} type="button">
                    {busy ? <LoaderCircle className="animate-spin" size={14} /> : <KeyRound size={14} />} Issue bound token
                  </button>
                  <button className="button secondary" disabled={busy || dpopState === "idle"} onClick={() => void callDpop()} type="button">Call resource</button>
                  <button className="button secondary" disabled={busy || (dpopState !== "used" && dpopState !== "replayed")} onClick={() => void callDpop(true)} type="button">Replay same proof</button>
                </div>
              </div>
            ) : (
              <div className="form-stack">
                <p className="form-message neutral">Sign in to inspect and control an owned session.</p>
                <Link className="button" href="/methods/password">Open password lab</Link>
              </div>
            )}
            {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
          </PanelShell>

          <PanelShell definition={flow} index={2}>
            <div className="flow-stage" aria-label="Session and token actors">
              {["User", "Browser", "Application", "Policy", "Database/API"].map((actor, index) => (
                <span key={actor} style={{ display: "contents" }}>
                  <span className={`flow-node${events.some((event) => event.actor === actor.toLowerCase()) ? " active" : ""}`}>{actor}</span>
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
              )) : <div className="empty-state">Run a lifecycle, risk, or DPoP operation to populate the ordered flow.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={network} index={3}>
            {networkEvents.length ? networkEvents.map((event) => (
              <div className="request-card" key={event.id}>
                <div className="request-summary">
                  <span className="request-method">{event.safeMetadata.method}</span>
                  <span className="request-path">{event.safeMetadata.endpoint}</span>
                  <span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode}</span>
                </div>
                <p className="request-note">
                  {event.safeMetadata.durationMs} ms · token, cookie, authorization, DPoP proof, and private key excluded
                </p>
              </div>
            )) : <div className="empty-state">Only endpoint shape and outcome are recorded. Bearer material and proofs are never accepted by the recorder.</div>}
          </PanelShell>

          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {[
                ["Cookie boundary", policy ? `HttpOnly ${policy.cookie.httpOnly}; Secure ${policy.cookie.secure}; SameSite ${policy.cookie.sameSite}; Path ${policy.cookie.path}.` : "The browser holds an opaque protected cookie, not account claims."],
                ["Fixation", policy?.fixationDefense ?? "Successful authentication creates a new unpredictable session identifier."],
                ["Rotation", policy ? `The server renews eligible session lifetime after ${secondsLabel(policy.slidingRenewalSeconds)} and never adopts a caller-selected ID.` : "Sliding renewal is bounded by server policy."],
                ["Expiry", policy ? `Sessions expire after ${secondsLabel(policy.absoluteLifetimeSeconds)}; fresh-sensitive operations use ${secondsLabel(policy.freshAuthenticationSeconds)}.` : "Idle/fresh and absolute lifetime serve different purposes."],
                ["Step-up", "Risk policy denies sensitive actions until a session-bound, origin-bound roaming security key supplies recent phishing-resistant assurance."],
                ["DPoP", "The browser keeps a non-exportable P-256 key. Each request signs method, URI, time, unique ID, and access-token hash; the server caches proof IDs against replay."],
                ["JWT", "A JWT is a token format, not a login method. Self-contained claims reduce lookups but make immediate revocation and lifecycle changes harder."],
                ["mTLS", "mTLS constrains tokens at the transport layer and suits managed high-assurance clients, but certificate issuance and rotation add operational cost."]
              ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}
            </div>
          </PanelShell>

          <PanelShell definition={comparison} index={5} wide>
            <ComparisonTable slugs={["cookie-session", "jwt-session", "dpop"]} />
            <div className="explanation-grid session-token-matrix">
              {[
                ["Opaque cookie session", "Browser continuity", "Server lookup", "Immediate revocation", "Cookie theft is replayable"],
                ["Access token", "Scoped API access", "Opaque or claims", "Short expiry / introspection", "Bearer theft is replayable"],
                ["Refresh token", "Obtain new access tokens", "Rotation family state", "Revoke family", "High-value bearer credential"],
                ["JWT", "Portable signed claims", "Self-contained", "Hard before expiry", "Bearer theft is replayable"],
                ["DPoP token", "Public-client API access", "Grant + public-key binding", "Revoke grant / short expiry", "Stolen token lacks client key"]
              ].map(([kind, use, state, revoke, theft]) => (
                <div className="explanation-item" key={kind}>
                  <h3>{kind}</h3><p>{use}</p><p>State: {state}</p><p>Revocation: {revoke}</p><p>Theft: {theft}</p>
                </div>
              ))}
            </div>
          </PanelShell>
        </div>
      </div>
      <aside className="lab-sidebar">
        <p className="eyebrow">Lifecycle rule</p>
        <h2>Format follows the threat model.</h2>
        <p>An S-tier authenticator does not make a bearer token sender-constrained, and a JWT does not create authentication.</p>
        <p className="sidebar-note">DPoP status: {dpopState}. Private keys, token values, cookies, and proofs stay outside the educational event store.</p>
        <Link className="text-link" href="/methods/passkey">Register a roaming security key →</Link>
        <p className="sidebar-note">{dpopAdapter.metadata.evolution.next}</p>
      </aside>
    </div>
  );
}
