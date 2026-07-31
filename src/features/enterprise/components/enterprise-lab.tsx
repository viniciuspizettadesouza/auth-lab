"use client";

import { KeyRound, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import {
  enterpriseSsoAdapter
} from "@/features/enterprise/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

type View = "sso" | "fapi" | "smartcard";
type EnterpriseTenant = {
  name: string;
  protocol: "oidc" | "saml";
  slug: string;
  ssoRequired: boolean;
};
type FapiClient = {
  clientId: string;
  certificateThumbprint: string;
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

async function createFlow(method: string, journey: string) {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, journey })
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

async function signClientAssertion(
  privateKey: CryptoKey,
  clientId: string,
  audience: string,
  jti = crypto.randomUUID()
) {
  const now = Math.floor(Date.now() / 1_000);
  const header = encode(JSON.stringify({
    alg: "ES256",
    kid: clientId,
    typ: "JWT"
  }));
  const claims = encode(JSON.stringify({
    aud: audience,
    exp: now + 60,
    iat: now,
    iss: clientId,
    jti,
    sub: clientId
  }));
  const input = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(input)
  );
  return `${input}.${encode(signature)}`;
}

export function EnterpriseLab() {
  const { data: session } = authClient.useSession();
  const [view, setView] = useState<View>("sso");
  const [email, setEmail] = useState("engineer@northstar.auth-lab.local");
  const [tenant, setTenant] = useState<EnterpriseTenant | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "neutral";
    text: string;
  } | null>(null);
  const [client, setClient] = useState<FapiClient | null>(null);
  const [fapiState, setFapiState] = useState("not initialized");
  const [hasAssertion, setHasAssertion] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const privateKey = useRef<CryptoKey | null>(null);
  const accessToken = useRef<string | null>(null);
  const tokenCertificate = useRef<string | null>(null);
  const lastAssertion = useRef<string | null>(null);
  const fapiFlow = useRef<string | null>(null);

  const loadFlow = useCallback(async (id: string) => {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }, []);

  async function discover() {
    setBusy(true);
    const flow = await createFlow("enterprise-sso", "enterprise-sso-policy");
    const started = performance.now();
    const response = await fetch(
      `/api/lab/enterprise/sso?email=${encodeURIComponent(email)}`,
      { cache: "no-store" }
    );
    await record(flow.id, "enterprise-discover", response.ok, response.status, started);
    if (response.ok) {
      const data = await response.json() as EnterpriseTenant;
      setTenant(data);
      setMessage({
        tone: "success",
        text: `${data.name} requires ${data.protocol.toUpperCase()} SSO for this domain.`
      });
    } else {
      setTenant(null);
      setMessage({ tone: "error", text: "No enterprise tenant owns this domain." });
    }
    await loadFlow(flow.id);
    setBusy(false);
  }

  async function evaluateSso(
    scenario:
      | "valid"
      | "wrong-issuer"
      | "wrong-tenant"
      | "expired"
      | "unsigned"
      | "unmanaged-group"
  ) {
    if (!tenant) return;
    setBusy(true);
    const flow = await createFlow("enterprise-sso", "enterprise-sso-policy");
    const started = performance.now();
    const response = await fetch("/api/lab/enterprise/sso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario, tenantSlug: tenant.slug })
    });
    const data = await response.json() as {
      checks?: string[];
      membership?: { role: string; tenant: string };
      reason?: string;
    };
    await record(flow.id, "enterprise-evaluate", response.ok, response.status, started);
    setChecks(data.checks ?? []);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? `Tenant membership mapped as ${data.membership?.role}; the existing provider-authenticated session remains independently revocable.`
        : data.reason ?? "Enterprise policy rejected the response."
    });
    await loadFlow(flow.id);
    setBusy(false);
  }

  async function registerClient() {
    setBusy(true);
    const flow = await createFlow("fapi", "fapi-client");
    fapiFlow.current = flow.id;
    const keys = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const started = performance.now();
    const response = await fetch("/api/lab/enterprise/fapi/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicJwk })
    });
    await record(flow.id, "fapi-register", response.ok, response.status, started);
    if (response.ok) {
      const data = await response.json() as FapiClient;
      privateKey.current = keys.privateKey;
      lastAssertion.current = null;
      accessToken.current = null;
      tokenCertificate.current = null;
      setHasAssertion(false);
      setHasToken(false);
      setClient(data);
      setFapiState("client public key and synthetic certificate registered");
      setMessage({
        tone: "success",
        text: "Confidential client registered. Its non-exportable private key remains in this tab."
      });
    } else {
      setMessage({ tone: "error", text: "Client registration failed." });
    }
    await loadFlow(flow.id);
    setBusy(false);
  }

  async function requestFapiToken(replay = false) {
    if (!client || !privateKey.current) return;
    setBusy(true);
    const flowId =
      fapiFlow.current ?? (await createFlow("fapi", "fapi-client")).id;
    fapiFlow.current = flowId;
    const audience = `${location.origin}/api/lab/enterprise/fapi/token`;
    const assertion =
      replay && lastAssertion.current
        ? lastAssertion.current
        : await signClientAssertion(privateKey.current, client.clientId, audience);
    if (!replay) {
      lastAssertion.current = assertion;
      setHasAssertion(true);
    }
    const started = performance.now();
    const response = await fetch("/api/lab/enterprise/fapi/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        certificateThumbprint: client.certificateThumbprint,
        clientAssertion: assertion,
        clientAssertionType:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        clientId: client.clientId,
        grantType: "client_credentials",
        scope: "regulated.read"
      })
    });
    const data = await response.json() as {
      access_token?: string;
      certificate_thumbprint?: string;
      error?: string;
    };
    await record(
      flowId,
      replay ? "fapi-replay" : "fapi-token",
      response.ok,
      response.status,
      started
    );
    if (response.ok && data.access_token && data.certificate_thumbprint) {
      accessToken.current = data.access_token;
      tokenCertificate.current = data.certificate_thumbprint;
      setHasToken(true);
      setFapiState("private-key JWT accepted; certificate-bound token active");
      setMessage({
        tone: "success",
        text: "Client assertion accepted once and a five-minute certificate-bound token was issued."
      });
    } else {
      setMessage({
        tone: replay && data.error?.includes("replayed") ? "success" : "error",
        text: replay
          ? "The reused client assertion identifier was rejected as a replay."
          : `Client authentication rejected: ${data.error ?? "invalid request"}.`
      });
    }
    await loadFlow(flowId);
    setBusy(false);
  }

  async function callFapiResource(mismatch = false) {
    if (!accessToken.current || !tokenCertificate.current || !fapiFlow.current) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/enterprise/fapi/resource", {
      headers: {
        authorization: `Bearer ${accessToken.current}`,
        "x-auth-lab-client-certificate": mismatch
          ? "synthetic-wrong-certificate-thumbprint"
          : tokenCertificate.current
      }
    });
    await record(
      fapiFlow.current,
      "fapi-resource",
      response.ok,
      response.status,
      started
    );
    setMessage({
      tone: mismatch ? (response.ok ? "error" : "success") : response.ok ? "success" : "error",
      text: mismatch
        ? response.ok
          ? "Certificate mismatch was unexpectedly accepted."
          : "A stolen token presented without its bound certificate was rejected."
        : response.ok
          ? "The regulated resource accepted the matching token and certificate binding."
          : "Certificate-bound resource access was rejected."
    });
    await loadFlow(fapiFlow.current);
    setBusy(false);
  }

  async function certificateAction(action: "rotate" | "revoke") {
    if (!client || !privateKey.current) return;
    setBusy(true);
    const flow = await createFlow("mtls", "certificate-lifecycle");
    const started = performance.now();
    const audience = `${location.origin}/api/lab/enterprise/fapi/certificate`;
    const clientAssertion = await signClientAssertion(
      privateKey.current,
      client.clientId,
      audience
    );
    const response = await fetch("/api/lab/enterprise/fapi/certificate", {
      method: action === "rotate" ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        certificateThumbprint: client.certificateThumbprint,
        clientAssertion,
        clientId: client.clientId
      })
    });
    await record(
      flow.id,
      action === "rotate" ? "certificate-rotate" : "certificate-revoke",
      response.ok,
      response.status,
      started
    );
    if (response.ok && action === "rotate") {
      const data = await response.json() as {
        activeCertificateThumbprint: string;
      };
      setClient({ ...client, certificateThumbprint: data.activeCertificateThumbprint });
      setFapiState("certificate rotated; previous certificate has five-minute overlap");
    } else if (response.ok) {
      setFapiState("certificate and bound grants revoked");
    }
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? action === "rotate"
          ? "Certificate rotated with a bounded overlap window; request a new token for the new certificate."
          : "Certificate revoked; all of this client's bound grants are unusable."
        : "Certificate lifecycle operation failed."
    });
    await loadFlow(flow.id);
    setBusy(false);
  }

  async function simulateSmartcard(
    scenario:
      | "valid"
      | "revoked-card"
      | "expired-certificate"
      | "removed-directory-user"
      | "stale-group"
  ) {
    setBusy(true);
    const flow = await createFlow("smartcard-directory", "smartcard-directory");
    const started = performance.now();
    const response = await fetch("/api/lab/enterprise/smartcard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario })
    });
    const data = await response.json() as {
      checks?: string[];
      reason?: string;
      result?: string;
    };
    await record(flow.id, "smartcard-simulate", response.ok, response.status, started);
    setChecks(data.checks ?? []);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: data.result ?? data.reason ?? "Smartcard policy evaluated."
    });
    await loadFlow(flow.id);
    setBusy(false);
  }

  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  const [ux, flow, network, explanation, comparison] = enterpriseSsoAdapter.panels;

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            <div className="auth-tabs" role="tablist" aria-label="Enterprise lab">
              {[
                ["sso", "Enterprise SSO"],
                ["fapi", "FAPI + mTLS"],
                ["smartcard", "Smartcard"]
              ].map(([id, label]) => (
                <button aria-selected={view === id} className={`auth-tab${view === id ? " active" : ""}`} key={id} onClick={() => setView(id as View)} role="tab" type="button">{label}</button>
              ))}
            </div>

            {view === "sso" ? (
              <div className="form-stack">
                <p className="form-message neutral">Policy simulation layered on the real local OIDC session. It never accepts an executable SAML document.</p>
                <div className="field"><label htmlFor="enterprise-email">WORK EMAIL</label><input id="enterprise-email" onChange={(event) => setEmail(event.target.value)} value={email} /></div>
                <button className="button" disabled={busy} onClick={() => void discover()} type="button">Discover enterprise tenant</button>
                {tenant ? (
                  <>
                    <div className="session-card"><span className="session-id">{tenant.name}</span><p>{tenant.protocol.toUpperCase()} · SSO {tenant.ssoRequired ? "required" : "optional"} · tenant {tenant.slug}</p></div>
                    {!session?.user ? <Link className="button secondary" href="/methods/oidc">Authenticate with local OIDC first</Link> : <p className="form-message success">Provider-authenticated as {session.user.email}</p>}
                    <div className="button-row">
                      <button className="button" disabled={busy || !session?.user} onClick={() => void evaluateSso("valid")} type="button">Apply valid tenant response</button>
                      <button className="button secondary" disabled={busy} onClick={() => void evaluateSso("wrong-issuer")} type="button">Try wrong issuer</button>
                      <button className="button secondary" disabled={busy} onClick={() => void evaluateSso("unmanaged-group")} type="button">Try unmanaged group</button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {view === "fapi" ? (
              <div className="form-stack">
                <p className="form-message neutral">Private-key JWT is real. Client-certificate metadata is explicitly simulated because TLS terminates outside this Next.js process. This is a control-focused lab, not a FAPI conformance implementation.</p>
                <p className="field-help">State: {fapiState}</p>
                <div className="button-row">
                  <button className="button" disabled={busy} onClick={() => void registerClient()} type="button">{busy ? <LoaderCircle className="animate-spin" size={14} /> : <KeyRound size={14} />} Initialize confidential client</button>
                  <button className="button secondary" disabled={busy || !client} onClick={() => void requestFapiToken()} type="button">Sign assertion and request token</button>
                  <button className="button secondary" disabled={busy || !hasAssertion} onClick={() => void requestFapiToken(true)} type="button">Replay assertion</button>
                </div>
                <div className="button-row">
                  <button className="button secondary" disabled={busy || !hasToken} onClick={() => void callFapiResource()} type="button"><ShieldCheck size={14} /> Call bound resource</button>
                  <button className="button secondary" disabled={busy || !hasToken} onClick={() => void callFapiResource(true)} type="button">Try stolen token</button>
                </div>
                <div className="button-row">
                  <button className="button secondary" disabled={busy || !client} onClick={() => void certificateAction("rotate")} type="button"><RefreshCw size={14} /> Rotate certificate</button>
                  <button className="button danger" disabled={busy || !client} onClick={() => void certificateAction("revoke")} type="button">Revoke certificate</button>
                </div>
              </div>
            ) : null}

            {view === "smartcard" ? (
              <div className="form-stack">
                <p className="form-message neutral">Safe simulation: local PIN entry, certificate private keys, card data, and directory credentials never enter Auth Lab.</p>
                <div className="button-row">
                  <button className="button" disabled={busy} onClick={() => void simulateSmartcard("valid")} type="button">Simulate valid card</button>
                  <button className="button secondary" disabled={busy} onClick={() => void simulateSmartcard("revoked-card")} type="button">Try revoked card</button>
                  <button className="button secondary" disabled={busy} onClick={() => void simulateSmartcard("removed-directory-user")} type="button">Try removed user</button>
                  <button className="button secondary" disabled={busy} onClick={() => void simulateSmartcard("stale-group")} type="button">Try stale group</button>
                </div>
              </div>
            ) : null}
            {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
          </PanelShell>

          <PanelShell definition={flow} index={2}>
            <div className="flow-stage">
              {["Principal", "Client / browser", "Tenant policy", "Authorization server / PKI", "Directory / resource"].map((actor, index) => (
                <span key={actor} style={{ display: "contents" }}><span className={`flow-node${events.length > index ? " active" : ""}`}>{actor}</span>{index < 4 ? <span className="flow-arrow">→</span> : null}</span>
              ))}
            </div>
            <div className="event-log">
              {events.length ? events.map((event) => <div className="event-row" key={event.id}><span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span><span className="event-actor">{event.actor}</span><span className="event-description">{event.description}</span></div>) : <div className="empty-state">Run an enterprise ceremony to populate the ordered flow.</div>}
              {checks.map((check, index) => <div className="event-row" key={check}><span className="event-sequence">{String(index + 1).padStart(2, "0")}</span><span className="event-actor">policy</span><span className="event-description">{check}</span></div>)}
            </div>
          </PanelShell>

          <PanelShell definition={network} index={3}>
            <div className="request-list">
              {networkEvents.length ? networkEvents.map((event) => <div className="request-card" key={event.id}><div className="request-summary"><span className="request-method">{event.safeMetadata.method}</span><span className="request-path">{event.safeMetadata.endpoint}</span><span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode}</span></div><p className="request-note">Assertions, access tokens, cookies, certificates, private keys, PINs, and directory credentials excluded.</p></div>) : <div className="empty-state">Only sanitized endpoint shapes and outcomes are recorded.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {[
                ["Tenant ownership", "Domain discovery selects a tenant, but issuer plus tenant-scoped subject—not email alone—owns the enterprise identity."],
                ["OIDC and SAML", "OIDC is the greenfield default; SAML remains common. Both need request correlation, signature, audience, time, and tenant mapping."],
                ["SSO enforcement", "Organization policy may require SSO while retaining tightly controlled break-glass recovery and notification."],
                ["Provisioning", "Authentication membership mapping is shown; SCIM-style provisioning and organization administration remain deliberately outside this milestone."],
                ["FAPI 2.0", "The Final profile requires confidential clients, asymmetric client authentication, and sender-constrained access tokens."],
                ["private_key_jwt", "The client signs iss, sub, aud, iat, exp, and unique jti with ES256. The server validates its registered public key and caches jti against replay."],
                ["mTLS boundary", "Real mTLS proves certificate possession in the TLS handshake. This local simulation trusts only a synthetic proxy-derived thumbprint and never claims to perform TLS."],
                ["Certificate lifecycle", "Rotation has a bounded overlap; new tokens bind to the new certificate. Revocation invalidates active grants."],
                ["Smartcard", "The PIN activates a key locally. Server checks concern certificate trust/revocation and directory ownership, never the PIN."],
                ["Directory", "Disabled users and stale groups must fail closed even when a card certificate remains cryptographically valid."]
              ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}
            </div>
          </PanelShell>

          <PanelShell definition={comparison} index={5} wide>
            <ComparisonTable slugs={["enterprise-sso", "oidc", "saml", "fapi", "mtls", "smartcard-directory"]} />
          </PanelShell>
        </div>
      </div>
      <aside className="lab-sidebar"><p className="eyebrow">High assurance</p><h2>Trust is a lifecycle.</h2><p>Issuer configuration, client keys, certificates, directory status, recovery, and revocation are all part of authentication.</p><p className="sidebar-note">No production certificate, private key, assertion, directory credential, or smartcard PIN belongs in this lab.</p></aside>
    </div>
  );
}
