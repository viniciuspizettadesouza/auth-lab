"use client";

import { ShieldCheck, WalletCards } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import { verifiablePresentationAdapter } from "@/features/portable/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";

type ClaimName = "given_name" | "age_over_18" | "membership_level" | "city";
type Credential = {
  credentialId: string;
  disclosures: { encoded: string; name: ClaimName }[];
  expiresAt: string;
  format: string;
  issuer: string;
  issuerJwt: string;
};
type PresentationRequest = {
  audience: string;
  clientId: string;
  dcqlQuery: { credentials: { claims: { path: string[] }[]; format: string; id: string }[] };
  expiresAt: string;
  nonce: string;
  requestId: string;
  requestedClaims: ClaimName[];
  responseMode: "direct_post";
  responseType: "vp_token";
};
type AgentResult = {
  action: string;
  controls: string[];
  decision: "allow" | "deny" | "approval-required";
  executed: false;
  reason: string;
  status: "product-experiment";
};

async function createFlow(method: string, journey: string) {
  const response = await fetch("/api/lab/flows", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, journey })
  });
  if (!response.ok) throw new Error("Could not start the portable identity flow.");
  return (await response.json() as { flow: { id: string } }).flow.id;
}

async function record(flowId: string, operation: string, response: Response, started: number) {
  await fetch(`/api/lab/flows/${flowId}/events`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      durationMs: Math.round(performance.now() - started), operation,
      outcome: response.ok ? "success" : "failure", statusCode: response.status
    })
  });
}

function encode(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  return encode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function holderProof(input: {
  audience: string;
  disclosures: string[];
  issuerJwt: string;
  nonce: string;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
  jti?: string;
}) {
  const header = encode(JSON.stringify({ alg: "ES256", jwk: input.publicJwk, typ: "kb+jwt" }));
  const claims = encode(JSON.stringify({
    aud: input.audience,
    iat: Math.floor(Date.now() / 1_000),
    jti: input.jti ?? crypto.randomUUID(),
    nonce: input.nonce,
    sd_hash: await sha256([input.issuerJwt, ...input.disclosures].join("~"))
  }));
  const signed = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, input.privateKey,
    new TextEncoder().encode(signed)
  );
  return `${signed}.${encode(signature)}`;
}

export function PortableLab() {
  const [view, setView] = useState<"wallet" | "agent">("wallet");
  const [credential, setCredential] = useState<Credential | null>(null);
  const [request, setRequest] = useState<PresentationRequest | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [presentationReady, setPresentationReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "neutral"; text: string } | null>(null);
  const privateKey = useRef<CryptoKey | null>(null);
  const publicJwk = useRef<JsonWebKey | null>(null);
  const flowId = useRef<string | null>(null);
  const lastPresentation = useRef<Record<string, unknown> | null>(null);

  const refresh = useCallback(async () => {
    if (!flowId.current) return;
    const response = await fetch(`/api/lab/flows/${flowId.current}`, { cache: "no-store" });
    if (response.ok) setEvents((await response.json() as { flow: { events: LabEvent[] } }).flow.events);
  }, []);

  async function issue() {
    setBusy(true);
    flowId.current = await createFlow("verifiable-presentation", "portable-presentation");
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    privateKey.current = keys.privateKey;
    publicJwk.current = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const started = performance.now();
    const response = await fetch("/api/lab/portable/credentials", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ holderJwk: publicJwk.current })
    });
    await record(flowId.current, "portable-issue", response, started);
    if (response.ok) {
      setCredential(await response.json() as Credential);
      setMessage({ tone: "success", text: "The synthetic wallet received a one-day holder-bound credential. The local format models selective disclosure; it is not an SD-JWT VC conformance claim." });
    } else setMessage({ tone: "error", text: "Credential issuance failed." });
    await refresh(); setBusy(false);
  }

  async function requestClaims(excessive = false) {
    if (!credential || !flowId.current) return;
    setBusy(true);
    const requestedClaims: ClaimName[] = excessive
      ? ["given_name", "age_over_18", "membership_level", "city"]
      : ["age_over_18", "membership_level"];
    const started = performance.now();
    const response = await fetch("/api/lab/portable/requests", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestedClaims })
    });
    await record(flowId.current, "portable-request", response, started);
    if (response.ok) {
      setRequest(await response.json() as PresentationRequest);
      setMessage({
        tone: excessive ? "neutral" : "success",
        text: excessive ? "The verifier asks for four claims. Review and deny this overbroad request, or consciously disclose them." : "The verifier asks only for adult status and membership. Wallet consent is still required."
      });
    } else setMessage({ tone: "error", text: "Presentation request failed." });
    await refresh(); setBusy(false);
  }

  async function deny() {
    if (!request || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/portable/requests", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: request.requestId })
    });
    await record(flowId.current, "portable-deny", response, started);
    if (response.ok) setRequest(null);
    setMessage({ tone: response.ok ? "success" : "error", text: response.ok ? "The wallet denied the request. No credential claims were sent." : "The request could not be denied." });
    await refresh(); setBusy(false);
  }

  async function present(mode: "valid" | "wrong-audience" | "replay" = "valid") {
    if (!credential || !request || !privateKey.current || !publicJwk.current || !flowId.current) return;
    setBusy(true);
    const disclosures = credential.disclosures
      .filter((item) => request.requestedClaims.includes(item.name))
      .map((item) => item.encoded);
    let body: Record<string, unknown>;
    if (mode === "replay" && lastPresentation.current) body = lastPresentation.current;
    else {
      const proof = await holderProof({
        audience: mode === "wrong-audience" ? "https://lookalike.auth-lab.local" : request.audience,
        disclosures, issuerJwt: credential.issuerJwt, nonce: request.nonce,
        privateKey: privateKey.current, publicJwk: publicJwk.current
      });
      body = {
        nonce: request.nonce,
        state: request.requestId,
        vpToken: { disclosures, holderProof: proof, issuerJwt: credential.issuerJwt }
      };
      if (mode === "valid") {
        lastPresentation.current = body;
        setPresentationReady(true);
      }
    }
    const started = performance.now();
    const response = await fetch("/api/lab/portable/presentations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const failure = response.ok ? null : await response.clone().json() as { error?: string };
    await record(flowId.current, mode === "replay" ? "portable-replay" : "portable-present", response, started);
    const expectedFailure = mode !== "valid";
    setMessage({
      tone: response.ok === !expectedFailure ? "success" : "error",
      text: response.ok ? "The verifier accepted only the consented claims, bound to its audience and one-time nonce; no Auth Lab session was created."
        : mode === "wrong-audience" ? "A presentation bound to a lookalike verifier was rejected."
          : mode === "replay" ? "The consumed request and exact holder proof were rejected on replay."
            : `Presentation failed closed: ${failure?.error ?? "verification rejected"}.`
    });
    await refresh(); setBusy(false);
  }

  async function revoke() {
    if (!credential || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/portable/credentials", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ credentialId: credential.credentialId })
    });
    await record(flowId.current, "portable-revoke", response, started);
    setMessage({ tone: response.ok ? "success" : "error", text: response.ok ? "Credential revoked. A fresh verifier request will now reject it at status validation." : "Credential revocation failed." });
    await refresh(); setBusy(false);
  }

  async function evaluateAgent(scenario: "read-calendar" | "send-email" | "wire-money" | "expired-delegation") {
    setBusy(true);
    flowId.current = await createFlow("agent-authorization", "agent-policy-exhibit");
    const started = performance.now();
    const response = await fetch("/api/lab/portable/agent", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario })
    });
    await record(flowId.current, "agent-evaluate", response, started);
    if (response.ok) {
      const result = await response.json() as AgentResult;
      setAgentResult(result);
      setMessage({ tone: result.decision === "allow" ? "success" : result.decision === "deny" ? "error" : "neutral", text: `${result.decision}: ${result.reason} No tool was executed.` });
    }
    await refresh(); setBusy(false);
  }

  const [ux, flow, network, explanation, comparison] = verifiablePresentationAdapter.panels;
  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  return <div className="lab-layout">
    <div className="lab-main"><div className="lab-grid">
      <PanelShell definition={ux} index={1}>
        <div className="auth-tabs" role="tablist" aria-label="Portable and future identity">
          <button aria-selected={view === "wallet"} className={`auth-tab${view === "wallet" ? " active" : ""}`} onClick={() => setView("wallet")} role="tab" type="button">Wallet presentation</button>
          <button aria-selected={view === "agent"} className={`auth-tab${view === "agent" ? " active" : ""}`} onClick={() => setView("agent")} role="tab" type="button">Agent exhibit</button>
        </div>
        {view === "wallet" ? <div className="form-stack">
          <p className="form-message neutral">OpenID4VP 1.0 is Final. Auth Lab&apos;s compact selectively disclosed credential is a local model because SD-JWT VC remains a draft.</p>
          <div className="defense-strip"><div><span>Publication status</span><strong>OID4VP 1.0 · Final</strong></div><p>RFC 9901 · Standard<br />SD-JWT VC · active Internet-Draft<br />Auth Lab credential format · product simulation</p></div>
          <button className="button" disabled={busy || Boolean(credential)} onClick={() => void issue()} type="button"><WalletCards size={14} /> Issue synthetic wallet credential</button>
          {credential ? <div className="session-card"><span className="session-id">{credential.credentialId}</span><p>Issuer: {credential.issuer}<br />Format: local selective-disclosure model · expires in one day<br />Wallet contains four synthetic claims; none are displayed in recorder events.</p></div> : null}
          <div className="button-row"><button className="button" disabled={busy || !credential} onClick={() => void requestClaims()} type="button">Request minimum claims</button><button className="button secondary" disabled={busy || !credential} onClick={() => void requestClaims(true)} type="button">Request excessive claims</button></div>
          {request ? <div className="session-card"><span className="session-id">Verifier consent</span><p>DCQL claims: {request.requestedClaims.join(", ")}<br />Client ID / audience: {request.clientId}<br />Response: {request.responseType} via {request.responseMode}<br />Nonce expires in two minutes.</p><div className="button-row"><button className="button" disabled={busy} onClick={() => void present()} type="button"><ShieldCheck size={14} /> Consent and present</button><button className="button secondary" disabled={busy} onClick={() => void present("wrong-audience")} type="button">Try lookalike audience</button><button className="button danger" disabled={busy} onClick={() => void deny()} type="button">Deny request</button></div></div> : null}
          <div className="button-row"><button className="button secondary" disabled={busy || !presentationReady} onClick={() => void present("replay")} type="button">Replay presentation</button><button className="button danger" disabled={busy || !credential} onClick={() => void revoke()} type="button">Revoke credential</button></div>
        </div> : <div className="form-stack">
          <p className="form-message neutral">Emerging product experiment informed by drafts. It returns a policy decision only: it never obtains an external token, connects to a tool, or performs an action.</p>
          <div className="defense-strip"><div><span>Publication status</span><strong>Emerging exhibit</strong></div><p>OAuth agent profile · Internet-Draft<br />Auth Lab evaluator · product experiment<br />Tool execution · disabled</p></div>
          <div className="button-row"><button className="button" disabled={busy} onClick={() => void evaluateAgent("read-calendar")} type="button">Read calendar</button><button className="button secondary" disabled={busy} onClick={() => void evaluateAgent("send-email")} type="button">Send email</button><button className="button secondary" disabled={busy} onClick={() => void evaluateAgent("wire-money")} type="button">Wire money</button><button className="button secondary" disabled={busy} onClick={() => void evaluateAgent("expired-delegation")} type="button">Expired delegation</button></div>
          {agentResult ? <div className="session-card"><span className="session-id">{agentResult.decision}</span><p>Action: {agentResult.action}<br />Checks: {agentResult.controls.join(" → ")}<br />Executed: no · maturity: product experiment</p></div> : null}
        </div>}
        {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
      </PanelShell>
      <PanelShell definition={flow} index={2}><div className="flow-stage">{(view === "wallet" ? ["Issuer", "Wallet + holder key", "Consent", "Verifier"] : ["User authority", "Agent identity", "Policy decision", "Tool blocked"]).map((actor, index) => <span key={actor} style={{ display: "contents" }}><span className={`flow-node${events.length > index ? " active" : ""}`}>{actor}</span>{index < 3 ? <span className="flow-arrow">→</span> : null}</span>)}</div><div className="event-log">{events.length ? events.map((event) => <div className="event-row" key={event.id}><span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span><span className="event-actor">{event.actor}</span><span className="event-description">{event.description}</span></div>) : <div className="empty-state">Run a wallet or agent-policy ceremony to populate this view.</div>}</div></PanelShell>
      <PanelShell definition={network} index={3}><div className="request-list">{networkEvents.length ? networkEvents.map((event) => <div className="request-card" key={event.id}><div className="request-summary"><span className="request-method">{event.safeMetadata.method}</span><span className="request-path">{event.safeMetadata.endpoint}</span><span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode}</span></div><p className="request-note">Credential artifacts, disclosures, holder keys, nonces, proofs, claim values, and arbitrary agent inputs are excluded.</p></div>) : <div className="empty-state">Only sanitized endpoint shapes and outcomes are recorded.</div>}</div></PanelShell>
      <PanelShell definition={explanation} index={4}><div className="explanation-grid">{[
        ["Final protocol", "OpenID4VP 1.0 is Final and format-agnostic. It defines how a verifier requests and receives presentations; it does not settle wallet or issuer trust."],
        ["Draft format", "RFC 9901 defines SD-JWT, while SD-JWT VC remains an Internet-Draft. The local compact format demonstrates digested disclosures without claiming conformance."],
        ["Local issuer", "Because issuer and verifier run in one teaching process, credential integrity uses a development-only symmetric key. Production credentials need ecosystem-approved asymmetric issuer keys and discovery."],
        ["Three roles", "The issuer signs a credential, the wallet holds it and controls consent, and the verifier validates the presentation for its own transaction."],
        ["Minimal disclosure", "Adult status can be disclosed without an exact birth date. Verifiers should request only claims justified by the purpose."],
        ["Replay defense", "The holder proof binds the issuer artifact and selected disclosures to the verifier audience, two-minute nonce, current time, and single-use proof identifier."],
        ["Trust", "A valid signature proves control of a key, not that the issuer is authoritative. Governance and metadata determine which issuers, wallets, formats, and assurance are accepted."],
        ["Correlation", "Stable identifiers, unusual claim combinations, issuer contact, and status checks can correlate presentations. Pairwise subjects and privacy-preserving status mechanisms reduce—not erase—risk."],
        ["Revocation and recovery", "Verifier status checks stop revoked credentials. Wallet loss requires issuer-defined reissuance and device recovery; portability does not remove recovery risk."],
        ["Agent drafts", "Agent-specific profiles remain drafts. The exhibit keeps user authority, agent identity, action, resource, constraints, approval, expiry, and audit explicit."],
        ["No tool execution", "Policy evaluation is not authorization enforcement unless a gateway blocks the action. This lab always reports executed: no."]
      ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}</div></PanelShell>
      <PanelShell definition={comparison} index={5} wide><ComparisonTable slugs={["oidc", "verifiable-presentation", "agent-authorization"]} /></PanelShell>
    </div></div>
    <aside className="lab-sidebar"><p className="eyebrow">Portable + future identity</p><h2>Presentation is not universal trust.</h2><p>Cryptography, consent, protocol maturity, ecosystem governance, privacy, recovery, and authorization policy remain separate decisions.</p><p className="sidebar-note">Only synthetic credentials and scenarios belong here. The agent exhibit cannot execute any action.</p></aside>
  </div>;
}
