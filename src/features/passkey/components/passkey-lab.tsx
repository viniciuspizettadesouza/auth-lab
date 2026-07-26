"use client";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/server";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import { passkeyAdapter } from "@/features/passkey/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

type PasskeySummary = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  kind: "passkey" | "security-key" | null;
};

function timerStart() {
  return performance.now();
}

async function startFlow(journey: string) {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "passkey", journey })
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

export function PasskeyLab() {
  const { data: session, refetch } = authClient.useSession();
  const [name, setName] = useState("My passkey");
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "neutral";
    text: string;
  } | null>(null);

  const loadPasskeys = useCallback(async () => {
    const response = await fetch("/api/lab/passkeys", { cache: "no-store" });
    if (!response.ok) {
      setPasskeys([]);
      return;
    }
    const data = await response.json() as { passkeys: PasskeySummary[] };
    setPasskeys(data.passkeys);
  }, []);

  const loadFlow = useCallback(async (id: string) => {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }, []);

  useEffect(() => {
    // Refresh public credential summaries when session ownership changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user) void loadPasskeys();
    else setPasskeys([]);
  }, [loadPasskeys, session?.user]);

  async function enroll(kind: "passkey" | "security-key") {
    setBusy(true);
    setMessage(null);
    try {
      const flow = await startFlow("passkey-enrollment");
      const started = performance.now();
      const result = await authClient.passkey.addPasskey({
        name,
        authenticatorAttachment:
          kind === "security-key" ? "cross-platform" : "platform",
        context: kind,
        fetchOptions: { headers: { "x-auth-flow-id": flow.id } }
      });
      const ok = !result.error;
      await recordOutcome(
        flow.id,
        "passkey-register",
        ok,
        result.error?.status ?? (ok ? 200 : 400),
        started
      );
      await Promise.all([loadPasskeys(), loadFlow(flow.id)]);
      setMessage({
        tone: ok ? "success" : "error",
        text: ok
          ? kind === "security-key"
            ? "Roaming security key linked and eligible for high-assurance step-up."
            : "Discoverable passkey linked to this account."
          : "Registration was cancelled or rejected. No weaker fallback was selected."
      });
    } catch {
      setMessage({
        tone: "error",
        text: "WebAuthn is unavailable, was cancelled, or rejected this origin."
      });
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setBusy(true);
    setMessage(null);
    try {
      const flow = await startFlow("passkey-authentication");
      const started = performance.now();
      const result = await authClient.signIn.passkey({
        fetchOptions: { headers: { "x-auth-flow-id": flow.id } }
      });
      const ok = !result.error;
      await recordOutcome(
        flow.id,
        "passkey-authenticate",
        ok,
        result.error?.status ?? (ok ? 200 : 401),
        started
      );
      await Promise.all([loadFlow(flow.id), refetch()]);
      setMessage({
        tone: ok ? "success" : "error",
        text: ok
          ? "Origin-bound assertion accepted; an opaque session is active."
          : "Passkey authentication failed without downgrading to a password or OTP."
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Authentication was cancelled, expired, replayed, or rejected for this origin."
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: PasskeySummary) {
    setBusy(true);
    const flow = await startFlow("passkey-revocation");
    const started = timerStart();
    const response = await fetch("/api/lab/passkeys", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id })
    });
    await recordOutcome(
      flow.id,
      "passkey-delete",
      response.ok,
      response.status,
      started
    );
    await Promise.all([loadPasskeys(), loadFlow(flow.id)]);
    setMessage({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "Credential revoked. It can no longer authenticate or perform step-up."
        : "The credential could not be revoked."
    });
    setBusy(false);
  }

  async function stepUp() {
    setBusy(true);
    setMessage(null);
    try {
      const flow = await startFlow("security-key-step-up");
      let started = performance.now();
      const optionsResponse = await fetch(
        "/api/lab/passkeys/step-up/options",
        { method: "POST" }
      );
      await recordOutcome(
        flow.id,
        "security-key-step-up-options",
        optionsResponse.ok,
        optionsResponse.status,
        started
      );
      if (!optionsResponse.ok) {
        throw new Error("No roaming security key is registered.");
      }
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
        flow.id,
        "security-key-step-up-verify",
        response.ok,
        response.status,
        started
      );
      await loadFlow(flow.id);
      setMessage({
        tone: response.ok ? "success" : "error",
        text: response.ok
          ? "Security-key step-up verified for this operation; no new session was created."
          : "Step-up rejected: challenges expire, are single-use, and cannot use a lower-assurance credential."
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error && error.message.includes("No roaming")
            ? error.message
            : "Security-key step-up was cancelled or rejected."
      });
    } finally {
      setBusy(false);
    }
  }

  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  const [ux, flow, network, explanation, comparison] = passkeyAdapter.panels;

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            {session?.user ? (
              <div className="form-stack">
                <p className="form-message success">
                  Signed in as {session.user.email}. Add another authenticator to link it to this account.
                </p>
                <div className="field">
                  <label htmlFor="passkey-name">AUTHENTICATOR LABEL</label>
                  <input
                    id="passkey-name"
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </div>
                <button className="button" disabled={busy} onClick={() => void enroll("passkey")} type="button">
                  {busy ? <LoaderCircle className="animate-spin" size={15} /> : <KeyRound size={15} />}
                  Add platform passkey
                </button>
                <button className="button secondary" disabled={busy} onClick={() => void enroll("security-key")} type="button">
                  Add roaming security key
                </button>
                <button className="button secondary" disabled={busy} onClick={() => void stepUp()} type="button">
                  <ShieldCheck size={15} /> Verify security-key step-up
                </button>
                {passkeys.map((item) => (
                  <div className="session-card" key={item.id}>
                    <div className="session-top">
                      <span className="session-id">{item.name || "Unnamed authenticator"}</span>
                      <button aria-label={`Revoke ${item.name || "passkey"}`} className="button danger small" disabled={busy} onClick={() => void remove(item)} type="button">
                        <Trash2 size={13} /> Revoke
                      </button>
                    </div>
                    <p>
                      {item.kind === "security-key" ? "Roaming security key" : item.backedUp ? "Synced/multi-device passkey" : "Device-bound passkey"} · user verification required
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="form-stack">
                <p className="form-message neutral">
                  Select a discoverable credential. No username, password, or manually entered code is sent.
                </p>
                <button className="button" disabled={busy} onClick={() => void signIn()} type="button">
                  {busy ? <LoaderCircle className="animate-spin" size={15} /> : <KeyRound size={15} />}
                  Sign in with a passkey
                </button>
                <p className="field-help">
                  Bootstrap first through the password lab or an existing passwordless session, then link a passkey while authenticated.
                </p>
                <Link className="button secondary" href="/methods/password">
                  Bootstrap or recover account
                </Link>
              </div>
            )}
            {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
          </PanelShell>

          <PanelShell definition={flow} index={2}>
            <div className="flow-stage" aria-label="WebAuthn actors">
              {["User", "Authenticator", "Browser", "Relying party", "Database"].map((actor, index) => (
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
              )) : <div className="empty-state">Run a ceremony to inspect its ordered, sanitized events.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={network} index={3}>
            <div className="request-list">
              {networkEvents.length ? networkEvents.map((event) => (
                <div className="request-card" key={event.id}>
                  <div className="request-summary">
                    <span className="request-method">{event.safeMetadata.method}</span>
                    <span className="request-path">{event.safeMetadata.endpoint}</span>
                    <span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode ?? "…"}</span>
                  </div>
                </div>
              )) : <div className="empty-state">Challenges and credential IDs are deliberately omitted from the recorder.</div>}
            </div>
          </PanelShell>

          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {[
                ["Stored", "Credential ID, public key, signature counter, transports, backup state, and a non-secret label. The private key stays with the authenticator."],
                ["Origin binding", "The signed client data and relying-party ID prevent a credential for Auth Lab from authenticating a lookalike origin."],
                ["Replay & expiry", "Challenges expire after five minutes and are atomically single-use; signature counters add authenticator replay evidence."],
                ["User verification", "Registration, sign-in, and step-up require a local PIN, biometric, or equivalent authenticator check."],
                ["Synced passkeys", "Improve availability across a provider ecosystem, while assurance and recovery inherit provider account controls."],
                ["Device-bound keys", "Reduce sync dependency but increase device-loss and multi-device enrollment risk."],
                ["Security-key label", "The lab requires a cross-platform ceremony and records that enrollment intent. Without an attestation policy, a public consumer service cannot treat the label alone as proof of a particular hardware model."],
                ["Shared devices", "Use separate OS profiles and avoid leaving credentials available to another device user."],
                ["Recovery", "Keep an independently protected bootstrap/recovery path and notify users about credential linking and revocation."],
                ["Downgrade", "A failed passkey or security-key ceremony never silently changes into password, email, SMS, or TOTP."],
                ["Scope", "Recommended when the ecosystem supports it and recovery is safe—not a universal mandate."]
              ].map(([title, copy]) => (
                <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>
              ))}
            </div>
          </PanelShell>

          <PanelShell definition={comparison} index={5} wide>
            <ComparisonTable slugs={["password", "magic-link", "email-otp", "totp", "sms-otp", "passkey"]} />
          </PanelShell>
        </div>
      </div>
      <aside className="lab-sidebar">
        <p className="eyebrow">Ceremony invariants</p>
        <p className="form-message neutral">HTTPS or localhost · exact origin · RP ID · fresh challenge · user verification · no private-key export</p>
      </aside>
    </div>
  );
}
