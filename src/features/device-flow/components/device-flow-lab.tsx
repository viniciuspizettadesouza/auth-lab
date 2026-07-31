"use client";

import { ExternalLink, LoaderCircle, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import { deviceFlowAdapter } from "@/features/device-flow/adapter";
import {
  DEVICE_CLIENT_ID,
  DEVICE_SCOPE
} from "@/features/device-flow/server/config";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

type DeviceAuthorization = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

type ApprovalSummary = {
  clientId: string;
  expiresAt: string;
  scope: string;
  status: string;
  userCode: string;
};

async function startFlow() {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      method: "device-flow",
      journey: "device-authorization"
    })
  });
  if (!response.ok) throw new Error("Could not start device flow.");
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

export function DeviceFlowLab() {
  const params = useSearchParams();
  const { data: session } = authClient.useSession();
  const [userCode, setUserCode] = useState(params.get("user_code") ?? "");
  const [authorization, setAuthorization] = useState<DeviceAuthorization | null>(null);
  const [approval, setApproval] = useState<ApprovalSummary | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "neutral";
    text: string;
  } | null>(null);
  const [flowId, setFlowId] = useState<string | null>(params.get("flow"));
  const accessToken = useRef<string | null>(null);
  const [clientState, setClientState] = useState<
    "idle" | "pending" | "approved" | "resource" | "replayed"
  >("idle");

  const loadFlow = useCallback(async (id: string) => {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }, []);

  const inspect = useCallback(async (code: string) => {
    if (!code) return;
    const response = await fetch(
      `/api/lab/device/verify?user_code=${encodeURIComponent(code)}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      setApproval(null);
      setMessage({ tone: "error", text: "User code is invalid or expired." });
      return;
    }
    const data = await response.json() as ApprovalSummary;
    setApproval(data);
    setUserCode(data.userCode);
  }, []);

  useEffect(() => {
    const code = params.get("user_code");
    if (!code) return;
    // Load the server-derived client and scope context for the approval screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void inspect(code);
  }, [inspect, params]);

  useEffect(() => {
    if (!authorization || !flowId) return;
    const url = new URL(authorization.verification_uri_complete);
    url.searchParams.set("flow", flowId);
    void QRCode.toDataURL(url.toString(), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220
    }).then(setQr);
  }, [authorization, flowId]);

  async function requestAuthorization() {
    setBusy(true);
    setMessage(null);
    try {
      const flow = await startFlow();
      setFlowId(flow.id);
      const started = performance.now();
      const body = new URLSearchParams({
        client_id: DEVICE_CLIENT_ID,
        scope: DEVICE_SCOPE
      });
      const response = await fetch("/api/lab/device/authorize", {
        method: "POST",
        body
      });
      await recordOutcome(
        flow.id,
        "device-request",
        response.ok,
        response.status,
        started
      );
      if (!response.ok) throw new Error("Device authorization unavailable.");
      const data = await response.json() as DeviceAuthorization;
      setAuthorization(data);
      setUserCode(data.user_code);
      accessToken.current = null;
      setClientState("pending");
      await loadFlow(flow.id);
      setMessage({
        tone: "neutral",
        text: "The constrained client is waiting. Open or scan the verification address on an authenticated browser."
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Device request failed."
      });
    } finally {
      setBusy(false);
    }
  }

  async function poll(replay = false) {
    if (!authorization || !flowId) return;
    setBusy(true);
    const started = performance.now();
    const body = new URLSearchParams({
      client_id: DEVICE_CLIENT_ID,
      device_code: authorization.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    });
    const response = await fetch("/api/lab/device/token", {
      method: "POST",
      body
    });
    const data = await response.json() as {
      access_token?: string;
      error?: string;
      interval?: number;
      scope?: string;
    };
    const operation = replay ? "device-replay" : "device-poll";
    await recordOutcome(
      flowId,
      operation,
      response.ok,
      response.status,
      started
    );
    if (response.ok && data.access_token) {
      accessToken.current = data.access_token;
      setClientState("approved");
      setMessage({
        tone: "success",
        text: `Approval consumed once; a five-minute ${data.scope} access token is held only in this tab.`
      });
    } else if (replay && data.error === "invalid_grant") {
      setClientState("replayed");
      setMessage({
        tone: "success",
        text: "The already-consumed device code was rejected as a replay."
      });
    } else {
      setMessage({
        tone: data.error === "authorization_pending" ? "neutral" : "error",
        text:
          data.error === "authorization_pending"
            ? "Authorization pending. The client must wait before polling again."
            : data.error === "slow_down"
              ? `Polling was too fast. The server increased the interval to ${data.interval} seconds.`
              : data.error === "access_denied"
                ? "The user denied this device request."
                : data.error === "expired_token"
                  ? "The device code expired without producing a token."
                  : "The device code is invalid or already consumed."
      });
    }
    await loadFlow(flowId);
    setBusy(false);
  }

  async function decide(decision: "approve" | "deny") {
    setBusy(true);
    let id = flowId;
    if (!id) {
      id = (await startFlow()).id;
      setFlowId(id);
    }
    const started = performance.now();
    const response = await fetch("/api/lab/device/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, userCode })
    });
    await recordOutcome(
      id,
      decision === "approve" ? "device-approve" : "device-deny",
      response.ok,
      response.status,
      started
    );
    if (response.ok) {
      setApproval((current) => current ? {
        ...current,
        status: decision === "approve" ? "approved" : "denied"
      } : current);
      setMessage({
        tone: decision === "approve" ? "success" : "neutral",
        text:
          decision === "approve"
            ? "Approved. Return to the constrained client and poll again."
            : "Denied. The constrained client can never exchange this code."
      });
    } else {
      setMessage({
        tone: "error",
        text: response.status === 401
          ? "Sign in before approving or denying this device."
          : "The code expired or was already handled."
      });
    }
    await loadFlow(id);
    setBusy(false);
  }

  async function callResource() {
    if (!accessToken.current || !flowId) return;
    setBusy(true);
    const started = performance.now();
    const response = await fetch("/api/lab/device/resource", {
      headers: { authorization: `Bearer ${accessToken.current}` }
    });
    await recordOutcome(
      flowId,
      "device-resource",
      response.ok,
      response.status,
      started
    );
    await loadFlow(flowId);
    setClientState(response.ok ? "resource" : "approved");
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "The scoped token accessed the synthetic device resource."
        : "The resource rejected the token or scope."
    });
    setBusy(false);
  }

  const verificationLink = authorization && flowId
    ? `${authorization.verification_uri_complete}&flow=${encodeURIComponent(flowId)}`
    : null;
  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  const [ux, flow, network, explanation, comparison] = deviceFlowAdapter.panels;

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            <div className="form-stack">
              <div className="defense-strip">
                <div><span>Constrained client</span><strong>No embedded browser or password input</strong></div>
                <p>The device receives a secret device code; the user sees only the short handoff code.</p>
              </div>
              <button className="button" disabled={busy} onClick={() => void requestAuthorization()} type="button">
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : <MonitorSmartphone size={15} />}
                Request device authorization
              </button>
              {authorization ? (
                <div className="device-handoff">
                  <div>
                    <span className="field-help">USER CODE</span>
                    <strong className="device-user-code">{authorization.user_code}</strong>
                    <p className="field-help">Expires in about {Math.ceil(authorization.expires_in / 60)} minutes · poll no faster than {authorization.interval} seconds</p>
                  </div>
                  {qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Device verification QR code" className="qr-code" height={160} src={qr} width={160} />
                  ) : null}
                  {verificationLink ? (
                    <a className="button secondary" href={verificationLink} rel="noreferrer" target="_blank">
                      <ExternalLink size={14} /> Open verification in another tab
                    </a>
                  ) : null}
                  <div className="button-row">
                    <button className="button secondary" disabled={busy || clientState !== "pending"} onClick={() => void poll()} type="button">Poll token endpoint</button>
                    <button className="button secondary" disabled={busy || clientState !== "approved"} onClick={() => void callResource()} type="button">Call scoped resource</button>
                    <button className="button secondary" disabled={busy || (clientState !== "approved" && clientState !== "resource")} onClick={() => void poll(true)} type="button">Replay device code</button>
                  </div>
                </div>
              ) : null}

              <hr className="panel-rule" />
              <div className="defense-strip">
                <div><span>Verification browser</span><strong>Authenticate and inspect context first</strong></div>
                <p>Never enter a code supplied by a stranger. Confirm the requesting device, client, and scopes.</p>
              </div>
              <div className="field">
                <label htmlFor="device-user-code">USER CODE</label>
                <input id="device-user-code" maxLength={12} onChange={(event) => setUserCode(event.target.value)} value={userCode} />
              </div>
              <button className="button secondary" disabled={busy || userCode.length < 8} onClick={() => void inspect(userCode)} type="button">Inspect request</button>
              {approval ? (
                <div className="session-card">
                  <div className="session-top"><span className="session-id">Auth Lab constrained client</span><span className={`request-status ${approval.status === "approved" ? "success" : ""}`}>{approval.status}</span></div>
                  <p>Client {approval.clientId} · scope {approval.scope} · expires {new Date(approval.expiresAt).toLocaleTimeString()}</p>
                </div>
              ) : null}
              {approval && approval.status === "pending" ? (
                session?.user ? (
                  <>
                    <p className="form-message success">Approving as {session.user.email}</p>
                    <div className="button-row">
                      <button className="button" disabled={busy} onClick={() => void decide("approve")} type="button"><ShieldCheck size={14} /> Approve device</button>
                      <button className="button danger" disabled={busy} onClick={() => void decide("deny")} type="button">Deny</button>
                    </div>
                  </>
                ) : (
                  <p className="form-message error">Authentication is required. Sign in in this browser, then return to this verification address.</p>
                )
              ) : null}
              {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
            </div>
          </PanelShell>

          <PanelShell definition={flow} index={2}>
            <div className="flow-stage" aria-label="Device authorization actors">
              {["User", "Constrained device", "Verification browser", "Authorization server", "Resource API"].map((actor, index) => (
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
              )) : <div className="empty-state">Request a device code, inspect consent, poll, and call the resource to populate the flow.</div>}
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
                  <p className="request-note">Device code, access token, cookie, authorization header, and arbitrary response bodies excluded.</p>
                </div>
              )) : <div className="empty-state">Only safe endpoint shapes and outcomes are recorded.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {[
                ["Device code", "A high-entropy credential known only to the constrained client and token endpoint. Auth Lab stores only its SHA-256 digest."],
                ["User code", "A short human-entered correlation code, not an authenticator. It expires and can approve or deny only one pending request."],
                ["QR assistance", "The complete verification URI reduces typing but does not remove the need to inspect the client and scopes before approval."],
                ["Polling", "The client receives a minimum interval. Early pending polls receive slow_down and increase that interval by five seconds."],
                ["Consent", "Authentication happens in the capable browser. Approval binds the pending request to that signed-in user."],
                ["Single use", "The approved device code is atomically consumed during exchange; later polls cannot mint another token."],
                ["Code phishing", "An attacker may ask a victim to enter the attacker's code. The verification screen must display recognizable device and permission context."],
                ["Scope", "The issued token is short-lived and accepted only for device.read by the synthetic resource."],
                ["Not login", "This is an OAuth authorization grant for constrained clients. Any identity claim would require an explicit OIDC layer."],
                ["Fit", "Use a normal authorization-code redirect whenever the client has a practical, secure browser interaction."]
              ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}
            </div>
          </PanelShell>

          <PanelShell definition={comparison} index={5} wide>
            <ComparisonTable slugs={["device-flow", "mtls"]} />
            <div className="explanation-grid session-token-matrix">
              {[
                ["Authorization Code + PKCE", "Browser-capable app", "Redirect callback", "Preferred when practical"],
                ["Device Authorization Grant", "TV, CLI, appliance", "User code + polling", "Code-phishing controls required"],
                ["QR-assisted device flow", "Camera-equipped constrained client", "Complete verification URI", "Still confirm device and scopes"],
                ["mTLS client", "Managed high-assurance client", "Certificate at TLS layer", "Operationally expensive"]
              ].map(([kind, fit, handoff, note]) => (
                <div className="explanation-item" key={kind}><h3>{kind}</h3><p>{fit}</p><p>Handoff: {handoff}</p><p>{note}</p></div>
              ))}
            </div>
          </PanelShell>
        </div>
      </div>
      <aside className="lab-sidebar">
        <p className="eyebrow">Special environment</p>
        <h2>Move interaction, not credentials.</h2>
        <p>The constrained client never receives the user&apos;s password, provider cookie, or authentication factor.</p>
        <p className="sidebar-note">Client state: {clientState}. Codes and access tokens remain outside the recorder.</p>
      </aside>
    </div>
  );
}
