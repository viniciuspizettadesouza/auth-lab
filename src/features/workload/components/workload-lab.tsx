"use client";

import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import { apiKeyAdapter } from "@/features/workload/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";

type Principal = {
  apiKey: string;
  audience: string;
  expiresAt: string;
  keyId: string;
  keyHint: string;
  name: string;
  principalId: string;
  scopes: string[];
};
type AuditEvent = {
  action: string;
  createdAt: string;
  detail: string;
  keyId: string | null;
  outcome: "success" | "failure";
};
type View = "api-key" | "client-credentials" | "federation";

async function createFlow(method = "api-key", journey = "api-key-lifecycle") {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, journey })
  });
  if (!response.ok) throw new Error("Could not start the workload flow.");
  return (await response.json() as { flow: { id: string } }).flow.id;
}

function encode(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function signDpopProof(privateKey: CryptoKey, publicJwk: JsonWebKey, accessToken: string, uri: string, jti = crypto.randomUUID()) {
  const header = encode(JSON.stringify({ alg: "ES256", jwk: publicJwk, typ: "dpop+jwt" }));
  const tokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
  const claims = encode(JSON.stringify({ ath: encode(tokenHash), htm: "GET", htu: uri, iat: Math.floor(Date.now() / 1_000), jti }));
  const input = `${header}.${claims}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(input));
  return `${input}.${encode(signature)}`;
}

async function record(flowId: string, operation: string, response: Response, started: number) {
  await fetch(`/api/lab/flows/${flowId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      durationMs: Math.round(performance.now() - started),
      operation,
      outcome: response.ok ? "success" : "failure",
      statusCode: response.status
    })
  });
}

export function WorkloadLab() {
  const [view, setView] = useState<View>("api-key");
  const [name, setName] = useState("order-sync-worker");
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "neutral"; text: string } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [clientTokenReady, setClientTokenReady] = useState(false);
  const [assertionReady, setAssertionReady] = useState(false);
  const [federatedTokenReady, setFederatedTokenReady] = useState(false);
  const [proofReady, setProofReady] = useState(false);
  const flowId = useRef<string | null>(null);
  const clientAccessToken = useRef<string | null>(null);
  const platformAssertion = useRef<string | null>(null);
  const federatedAccessToken = useRef<string | null>(null);
  const workloadPrivateKey = useRef<CryptoKey | null>(null);
  const workloadPublicJwk = useRef<JsonWebKey | null>(null);
  const lastProof = useRef<string | null>(null);

  const refresh = useCallback(async (principalId?: string) => {
    if (flowId.current) {
      const response = await fetch(`/api/lab/flows/${flowId.current}`, { cache: "no-store" });
      if (response.ok) setEvents((await response.json() as { flow: { events: LabEvent[] } }).flow.events);
    }
    if (principalId) {
      const response = await fetch(`/api/lab/workloads?principalId=${encodeURIComponent(principalId)}`, { cache: "no-store" });
      if (response.ok) setAuditEvents((await response.json() as { events: AuditEvent[] }).events);
    }
  }, []);

  async function createPrincipal() {
    setBusy(true);
    try {
      flowId.current = await createFlow();
      const started = performance.now();
      const response = await fetch("/api/lab/workloads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name })
      });
      await record(flowId.current, "workload-create", response, started);
      if (!response.ok) throw new Error("The service principal could not be created.");
      const data = await response.json() as Principal;
      setPrincipal(data);
      setMessage({ tone: "success", text: "Machine principal created. Copy the key now: the server will never return this secret again." });
      await refresh(data.principalId);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Creation failed." });
    } finally {
      setBusy(false);
    }
  }

  async function callResource(mode: "valid" | "audience" | "scope" | "replay" = "valid") {
    if (!principal || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch(`/api/lab/workloads/resource?scope=${mode === "scope" ? "billing.admin" : "orders.read"}`, {
      headers: {
        "x-api-key": principal.apiKey,
        "x-auth-lab-audience": mode === "audience" ? "https://api.auth-lab.local/billing" : principal.audience
      }
    });
    await record(flowId.current, mode === "replay" ? "workload-replay" : "workload-resource", response, started);
    const expectedFailure = mode !== "valid";
    setMessage({
      tone: response.ok === !expectedFailure ? "success" : "error",
      text: response.ok
        ? "The resource authorized this machine principal for orders.read."
        : mode === "audience"
          ? "The same key was rejected for a different audience."
          : mode === "scope"
            ? "The key was rejected for a scope the principal does not own."
            : "The revoked key was rejected immediately."
    });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function rotate() {
    if (!principal || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: principal.apiKey })
    });
    await record(flowId.current, "workload-rotate", response, started);
    if (response.ok) {
      const replacement = await response.json() as Pick<Principal, "apiKey" | "expiresAt" | "keyId" | "keyHint" | "principalId">;
      setPrincipal({ ...principal, ...replacement });
      setMessage({ tone: "success", text: "Replacement shown once. The previous key has a 60-second deployment overlap." });
    } else setMessage({ tone: "error", text: "Key rotation failed." });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function revoke() {
    if (!principal || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/key", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: principal.apiKey })
    });
    await record(flowId.current, "workload-revoke", response, started);
    setMessage({ tone: response.ok ? "success" : "error", text: response.ok ? "Key revoked. Replay it to verify enforcement." : "Key revocation failed." });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function prepareClient(rotateSecret = false) {
    if (!principal) return;
    setBusy(true);
    flowId.current = rotateSecret && flowId.current
      ? flowId.current
      : await createFlow("client-credentials", "client-credentials-lifecycle");
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/oauth/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: principal.principalId, currentSecret: rotateSecret ? clientSecret : undefined })
    });
    await record(flowId.current, rotateSecret ? "client-rotate" : "client-register", response, started);
    if (response.ok) {
      const data = await response.json() as { clientSecret: string };
      setClientSecret(data.clientSecret);
      clientAccessToken.current = null;
      setClientTokenReady(false);
      setMessage({ tone: "success", text: rotateSecret ? "Client secret rotated with a 60-second overlap." : "Confidential client credential returned once. It is never sent to the resource API." });
    } else setMessage({ tone: "error", text: "Client credential operation failed." });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function requestClientToken() {
    if (!principal || !clientSecret || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audience: principal.audience, clientId: principal.principalId, clientSecret, grantType: "client_credentials", scope: "orders.read" })
    });
    await record(flowId.current, "client-token", response, started);
    if (response.ok) {
      clientAccessToken.current = (await response.json() as { access_token: string }).access_token;
      setClientTokenReady(true);
      setMessage({ tone: "success", text: "Client authenticated once; a five-minute scoped bearer token was issued." });
    } else setMessage({ tone: "error", text: "Client authentication or token policy failed." });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function callTokenResource(kind: "client" | "federation", replayProof = false) {
    if (!principal || !flowId.current) return;
    const token = kind === "client" ? clientAccessToken.current : federatedAccessToken.current;
    if (!token) return;
    setBusy(true);
    const uri = `${location.origin}/api/lab/workloads/access/resource`;
    let proof: string | undefined;
    if (kind === "federation" && workloadPrivateKey.current && workloadPublicJwk.current) {
      proof = replayProof && lastProof.current
        ? lastProof.current
        : await signDpopProof(workloadPrivateKey.current, workloadPublicJwk.current, token, uri);
      if (!replayProof) lastProof.current = proof;
      if (!replayProof) setProofReady(true);
    }
    const started = performance.now();
    const response = await fetch(uri, {
      headers: {
        authorization: `${kind === "federation" ? "DPoP" : "Bearer"} ${token}`,
        ...(proof ? { dpop: proof } : {})
      }
    });
    await record(flowId.current, kind === "client" ? "client-resource" : replayProof ? "proof-replay" : "federation-resource", response, started);
    setMessage({
      tone: replayProof ? (response.ok ? "error" : "success") : response.ok ? "success" : "error",
      text: replayProof
        ? response.ok ? "A reused DPoP proof was unexpectedly accepted." : "The exact DPoP proof was rejected on replay."
        : response.ok ? `${kind === "client" ? "Bearer" : "Sender-constrained"} workload access succeeded.` : "The workload token or proof was rejected."
    });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function attest() {
    if (!principal) return;
    setBusy(true);
    flowId.current = await createFlow("workload-federation", "workload-federation");
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    workloadPrivateKey.current = keys.privateKey;
    workloadPublicJwk.current = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/federation/attestation", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ principalId: principal.principalId })
    });
    await record(flowId.current, "federation-attest", response, started);
    if (response.ok) {
      platformAssertion.current = (await response.json() as { assertion: string }).assertion;
      setAssertionReady(true);
      setMessage({ tone: "success", text: "The synthetic platform attested this runtime and signed a 60-second assertion. No API key or client secret was used." });
    } else setMessage({ tone: "error", text: "Platform attestation failed." });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function exchangeAssertion(replay = false) {
    if (!principal || !platformAssertion.current || !workloadPublicJwk.current || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/federation/token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audience: principal.audience,
        grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
        publicJwk: workloadPublicJwk.current,
        scope: "orders.read",
        subjectToken: platformAssertion.current,
        subjectTokenType: "urn:ietf:params:oauth:token-type:jwt"
      })
    });
    await record(flowId.current, replay ? "federation-replay" : "federation-exchange", response, started);
    if (response.ok && !replay) {
      federatedAccessToken.current = (await response.json() as { access_token: string }).access_token;
      setFederatedTokenReady(true);
    }
    setMessage({
      tone: replay ? (response.ok ? "error" : "success") : response.ok ? "success" : "error",
      text: replay ? response.ok ? "Assertion replay was unexpectedly accepted." : "The consumed platform assertion was rejected on replay." : response.ok ? "A two-minute DPoP-bound access token replaced the 60-second platform assertion." : "Token exchange failed."
    });
    await refresh(principal.principalId);
    setBusy(false);
  }

  async function revokeGrants() {
    if (!principal || !flowId.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/workloads/grants", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ principalId: principal.principalId })
    });
    await record(flowId.current, "grant-revoke", response, started);
    setMessage({ tone: response.ok ? "success" : "error", text: response.ok ? "All active grants for this machine principal were revoked." : "Grant revocation failed." });
    await refresh(principal.principalId);
    setBusy(false);
  }

  const [ux, flow, network, explanation, comparison] = apiKeyAdapter.panels;
  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  return (
    <div className="lab-layout">
      <div className="lab-main"><div className="lab-grid">
        <PanelShell definition={ux} index={1}>
          <div className="form-stack">
            <p className="form-message neutral">This lab creates a non-human principal. It does not sign in a person or create a browser session.</p>
            <div className="field"><label htmlFor="workload-name">SERVICE NAME</label><input id="workload-name" disabled={Boolean(principal)} maxLength={60} onChange={(event) => setName(event.target.value)} value={name} /></div>
            <button className="button" disabled={busy || Boolean(principal)} onClick={() => void createPrincipal()} type="button"><KeyRound size={14} /> Create principal and API key</button>
            {principal ? <div className="session-card"><span className="session-id">{principal.principalId}</span><p>{principal.audience}<br />scopes: {principal.scopes.join(", ")}</p></div> : null}
            <div className="auth-tabs" role="tablist" aria-label="Workload identity evolution">
              {[["api-key", "API key"], ["client-credentials", "OAuth token"], ["federation", "Federation"]].map(([id, label]) => <button aria-selected={view === id} className={`auth-tab${view === id ? " active" : ""}`} key={id} onClick={() => setView(id as View)} role="tab" type="button">{label}</button>)}
            </div>
            {view === "api-key" ? <>
              {principal ? <div className="field"><label htmlFor="issued-key">ONE-TIME API KEY RESPONSE</label><input id="issued-key" readOnly value={principal.apiKey} /></div> : null}
              <div className="button-row"><button className="button" disabled={busy || !principal} onClick={() => void callResource()} type="button"><ShieldCheck size={14} /> Call orders API</button><button className="button secondary" disabled={busy || !principal} onClick={() => void rotate()} type="button"><RefreshCw size={14} /> Rotate key</button><button className="button danger" disabled={busy || !principal} onClick={() => void revoke()} type="button">Revoke key</button></div>
              <div className="button-row"><button className="button secondary" disabled={busy || !principal} onClick={() => void callResource("audience")} type="button">Wrong audience</button><button className="button secondary" disabled={busy || !principal} onClick={() => void callResource("scope")} type="button">Excess scope</button><button className="button secondary" disabled={busy || !principal} onClick={() => void callResource("replay")} type="button">Replay revoked key</button></div>
            </> : null}
            {view === "client-credentials" ? <>
              <p className="form-message neutral">The client secret authenticates only to the authorization server; resources receive a scoped five-minute token.</p>
              {clientSecret ? <div className="field"><label htmlFor="client-secret">ONE-TIME CLIENT SECRET RESPONSE</label><input id="client-secret" readOnly value={clientSecret} /></div> : null}
              <div className="button-row"><button className="button" disabled={busy || !principal || Boolean(clientSecret)} onClick={() => void prepareClient()} type="button">Issue client secret</button><button className="button secondary" disabled={busy || !clientSecret} onClick={() => void requestClientToken()} type="button">Exchange for token</button><button className="button secondary" disabled={busy || !clientSecret} onClick={() => void prepareClient(true)} type="button">Rotate secret</button></div>
              <div className="button-row"><button className="button secondary" disabled={busy || !clientTokenReady} onClick={() => void callTokenResource("client")} type="button">Call with 5-minute token</button><button className="button danger" disabled={busy || !clientTokenReady} onClick={() => void revokeGrants()} type="button">Revoke grants</button></div>
            </> : null}
            {view === "federation" ? <>
              <p className="form-message neutral">Synthetic local platform boundary: a signed 60-second assertion is exchanged once for a two-minute DPoP-bound token. No static application secret participates.</p>
              <div className="button-row"><button className="button" disabled={busy || !principal} onClick={() => void attest()} type="button">Attest runtime</button><button className="button secondary" disabled={busy || !assertionReady} onClick={() => void exchangeAssertion()} type="button">Exchange assertion</button><button className="button secondary" disabled={busy || !assertionReady} onClick={() => void exchangeAssertion(true)} type="button">Replay assertion</button></div>
              <div className="button-row"><button className="button secondary" disabled={busy || !federatedTokenReady} onClick={() => void callTokenResource("federation")} type="button">Call with DPoP proof</button><button className="button secondary" disabled={busy || !proofReady} onClick={() => void callTokenResource("federation", true)} type="button">Replay exact proof</button></div>
            </> : null}
            {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
          </div>
        </PanelShell>
        <PanelShell definition={flow} index={2}>
          <div className="flow-stage">{["Runtime / operator", "Machine principal", "Authorization server", "Orders API"].map((actor, index) => <span key={actor} style={{ display: "contents" }}><span className={`flow-node${events.length > index ? " active" : ""}`}>{actor}</span>{index < 3 ? <span className="flow-arrow">→</span> : null}</span>)}</div>
          <div className="event-log">{events.length ? events.map((event) => <div className="event-row" key={event.id}><span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span><span className="event-actor">{event.actor}</span><span className="event-description">{event.description}</span></div>) : <div className="empty-state">Create a service principal to start the ordered flow.</div>}</div>
        </PanelShell>
        <PanelShell definition={network} index={3}>
          <div className="request-list">{networkEvents.length ? networkEvents.map((event) => <div className="request-card" key={event.id}><div className="request-summary"><span className="request-method">{event.safeMetadata.method}</span><span className="request-path">{event.safeMetadata.endpoint}</span><span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode}</span></div><p className="request-note">Raw API keys, request headers, and bodies are excluded.</p></div>) : <div className="empty-state">Only sanitized endpoint shapes and outcomes appear here.</div>}</div>
          <hr className="panel-rule" />
          <div className="event-log">{auditEvents.map((event, index) => <div className="event-row" key={`${event.createdAt}-${index}`}><span className="event-sequence">{event.outcome === "success" ? "OK" : "NO"}</span><span className="event-actor">{event.action}</span><span className="event-description">{event.detail}</span></div>)}</div>
        </PanelShell>
        <PanelShell definition={explanation} index={4}>
          <div className="explanation-grid">{[
            ["Principal", "The service account has its own identifier, audience, scopes, status, and audit history. It is never represented as a user session."],
            ["Storage", "The 256-bit bearer secret is returned only in the create or rotate response. PostgreSQL stores a SHA-256 digest and a non-secret hint."],
            ["Least privilege", "The resource checks both its exact audience and the requested scope; possession alone does not grant every API action."],
            ["Rotation", "A bounded overlap lets operators deploy the replacement before the old credential expires. The replacement is independently revocable."],
            ["Limitation", "A stolen bearer key can be replayed. Digest storage limits database breach impact but cannot protect a key copied from its workload."],
            ["Client Credentials", "A managed secret authenticates the confidential client only at the token endpoint; five-minute access tokens carry the resource audience and scope."],
            ["Signed assertions", "The local platform signs issuer, subject, audience, time, and unique identifier claims. Exchange validates them and consumes each identifier once."],
            ["Federation", "Runtime attestation removes an application-stored secret. Trust moves to platform identity, issuer configuration, metadata access, and subject mapping."],
            ["Sender constraint", "Federated tokens bind to an ephemeral P-256 key. Each resource call proves that key, token hash, method, URI, time, and a single-use proof identifier."],
            ["Certificates", "Managed mTLS and certificate-bound tokens remain appropriate for controlled infrastructure; the enterprise lab demonstrates their rotation and revocation boundary."]
          ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}</div>
        </PanelShell>
        <PanelShell definition={comparison} index={5} wide><ComparisonTable slugs={["api-key", "personal-access-token", "client-credentials", "workload-federation", "fapi", "mtls"]} /></PanelShell>
      </div></div>
      <aside className="lab-sidebar"><p className="eyebrow">Workload identity</p><h2>Machines are principals too.</h2><p>Identity, audience, scopes, expiry, rotation, audit, and revocation should be explicit—and separate from people and their sessions.</p><p className="sidebar-note">Use only the synthetic key generated here. Never paste a production credential into Auth Lab.</p></aside>
    </div>
  );
}
