"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useSearchParams } from "next/navigation";

import type { LabEvent } from "@/contracts";
import { ComparisonTable } from "@/components/comparison-table";
import { totpAdapter } from "@/features/link-code/adapters";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

async function createFlow(journey: string) {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "totp", journey })
  });
  if (!response.ok) throw new Error("Could not start TOTP flow.");
  return (await response.json() as { flow: { id: string } }).flow;
}

async function record(
  id: string,
  operation: string,
  ok: boolean,
  statusCode: number
) {
  await fetch(`/api/lab/flows/${id}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation,
      outcome: ok ? "success" : "failure",
      statusCode,
      durationMs: 0
    })
  });
}

export function TotpLab() {
  const searchParams = useSearchParams();
  const { data: session, refetch } = authClient.useSession();
  const [password, setPassword] = useState("correct horse battery staple");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [uri, setUri] = useState("");
  const [qr, setQr] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const challenge = searchParams.get("challenge") === "1";

  useEffect(() => {
    if (!uri) return;
    void QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220
    }).then(setQr);
  }, [uri]);

  async function load(id: string) {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }

  async function enable() {
    const flow = await createFlow("totp-enrollment");
    setFlowId(flow.id);
    const result = await authClient.twoFactor.enable(
      { password, issuer: "Auth Lab" },
      { headers: { "x-auth-flow-id": flow.id } }
    );
    const ok = !result.error && Boolean(result.data);
    await record(
      flow.id,
      "totp-enable",
      ok,
      result.error?.status ?? (ok ? 200 : 400)
    );
    if (result.data) {
      setUri(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setMessage(
        "Scan the QR code, store every recovery code offline, then confirm a current TOTP code."
      );
    } else {
      setMessage("Enrollment was rejected. Confirm the current password.");
    }
    await load(flow.id);
  }

  async function verifyTotp() {
    const flow =
      !challenge && flowId
        ? { id: flowId }
        : await createFlow(
            challenge ? "totp-challenge" : "totp-enrollment"
          );
    setFlowId(flow.id);
    const response = await fetch("/api/lab/totp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-flow-id": flow.id
      },
      body: JSON.stringify({ code })
    });
    const ok = response.ok;
    const replayed = response.status === 409;
    await record(
      flow.id,
      "totp-verify",
      ok,
      response.status
    );
    setMessage(
      ok
        ? challenge
          ? "Second factor accepted; the pending sign-in is now a session."
          : "TOTP enrollment confirmed. Future password sign-ins require step-up."
        : replayed
          ? "This TOTP code was already accepted and was rejected as a replay."
          : "The TOTP code was invalid, outside its time window, or locked."
    );
    if (ok) {
      setUri("");
      setQr("");
      setCode("");
    }
    await load(flow.id);
    await refetch();
  }

  async function recover() {
    const flow = await createFlow("totp-recovery");
    const response = await fetch("/api/lab/totp/recover", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-flow-id": flow.id
      },
      body: JSON.stringify({ code: recoveryCode })
    });
    const ok = response.ok;
    await record(
      flow.id,
      "backup-code-verify",
      ok,
      response.status
    );
    setMessage(
      ok
        ? "Recovery code consumed; it cannot be used again."
        : "Recovery code invalid or already consumed."
    );
    await load(flow.id);
    await refetch();
  }

  async function disable() {
    const flow = await createFlow("totp-removal");
    const result = await authClient.twoFactor.disable(
      { password },
      { headers: { "x-auth-flow-id": flow.id } }
    );
    const ok = !result.error;
    await record(
      flow.id,
      "totp-disable",
      ok,
      result.error?.status ?? (ok ? 200 : 400)
    );
    setMessage(
      ok
        ? "TOTP, encrypted secret, and remaining recovery codes were removed."
        : "Removal was rejected. Confirm the password and fresh session."
    );
    if (ok) setBackupCodes([]);
    await load(flow.id);
    await refetch();
  }

  const [ux, flowPanel, network, explanation, comparison] = totpAdapter.panels;
  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            {!session?.user && !challenge ? (
              <div className="empty-state">
                Sign in through the password lab before enrolling TOTP.
                <br />
                <a href="/methods/password">Open password lab</a>
              </div>
            ) : (
              <div className="form-stack">
                {!challenge ? (
                  <>
                    <div className="field">
                      <label htmlFor="totp-password">CURRENT PASSWORD</label>
                      <input
                        id="totp-password"
                        onChange={(event) => setPassword(event.target.value)}
                        type="password"
                        value={password}
                      />
                    </div>
                    <button className="button" onClick={() => void enable()} type="button">
                      Begin TOTP enrollment
                    </button>
                  </>
                ) : (
                  <p className="form-message neutral">
                    Password accepted. Complete the required TOTP step-up.
                  </p>
                )}
                {qr ? (
                  <div className="session-card">
                    {/* The URI remains in memory and is represented as a QR ceremony, never recorded. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="TOTP enrollment QR code" height={220} src={qr} width={220} />
                  </div>
                ) : null}
                {backupCodes.length ? (
                  <div className="session-card">
                    <strong>One-time recovery codes — shown for enrollment</strong>
                    <ul>
                      {backupCodes.map((item) => <li key={item}><code>{item}</code></li>)}
                    </ul>
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor="totp-code">AUTHENTICATOR CODE</label>
                  <input
                    autoComplete="one-time-code"
                    id="totp-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setCode(event.target.value)}
                    value={code}
                  />
                </div>
                <button className="button secondary" onClick={() => void verifyTotp()} type="button">
                  {challenge ? "Complete sign-in" : "Confirm enrollment"}
                </button>
                <div className="field">
                  <label htmlFor="recovery-code">RECOVERY CODE</label>
                  <input
                    id="recovery-code"
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    value={recoveryCode}
                  />
                </div>
                <button className="button secondary" onClick={() => void recover()} type="button">
                  Use recovery code
                </button>
                {!challenge ? (
                  <button className="button danger" onClick={() => void disable()} type="button">
                    Remove TOTP
                  </button>
                ) : null}
                {message ? <p className="form-message neutral">{message}</p> : null}
              </div>
            )}
          </PanelShell>
          <PanelShell definition={flowPanel} index={2}>
            {events.length ? (
              <div className="event-log">
                {events.map((event) => (
                  <div className="event-row" key={event.id}>
                    <span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span>
                    <span className="event-actor">{event.actor}</span>
                    <span className="event-description">{event.description}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state">Enroll or verify to populate the flow.</div>}
          </PanelShell>
          <PanelShell definition={network} index={3} wide>
            {networkEvents.map((event) => (
              <article className="request-card" key={event.id}>
                <div className="request-summary">
                  <span className="request-method">{event.safeMetadata.method}</span>
                  <span className="request-path">{event.safeMetadata.endpoint}</span>
                  <span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode ?? event.outcome}</span>
                </div>
              </article>
            ))}
          </PanelShell>
          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {[
                ["Enrollment", "A shared TOTP seed is transferred by QR and encrypted at rest."],
                ["Verification", "Both authenticator and verifier derive a six-digit code for the current 30-second window."],
                ["Step-up", "Password success does not create a usable session until the second factor succeeds."],
                ["Recovery", "Eight encrypted, one-time backup codes provide a deliberately visible recovery path."],
                ["Removal", "A fresh authenticated session and current password remove the factor and recovery material."],
                ["Phishing", "TOTP is an additional factor but is not origin-bound; real-time relay remains possible."],
                ["Factor independence", "A second memorized PIN added to a password would still be knowledge, not an independent possession factor."],
                ["Abuse control", "Five consecutive failures lock account-level second-factor verification for five minutes."]
              ].map(([title, copy]) => (
                <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>
              ))}
            </div>
          </PanelShell>
          <PanelShell definition={comparison} index={5}>
            <div style={{ overflowX: "auto" }}><ComparisonTable /></div>
          </PanelShell>
        </div>
      </div>
    </div>
  );
}
