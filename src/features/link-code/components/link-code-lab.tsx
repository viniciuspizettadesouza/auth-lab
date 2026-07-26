"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

import type { LabEvent } from "@/contracts";
import { ComparisonTable } from "@/components/comparison-table";
import {
  emailOtpAdapter,
  magicLinkAdapter,
  smsOtpAdapter
} from "@/features/link-code/adapters";
import { PanelShell } from "@/features/password/components/panel-shell";
import { authClient } from "@/lib/auth-client";

type Variant = "magic-link" | "email-otp" | "sms-otp";

const explanations = {
  "magic-link": [
    ["Proof", "A random bearer token delivered to the email inbox."],
    ["Storage", "Only a hash of the five-minute token is stored."],
    ["Single use", "The first verification attempt atomically consumes the token, including a failed or replayed attempt."],
    ["Phishing", "A captured link can be relayed before use; it is not bound to the original browser or origin."],
    ["Recovery", "Assurance inherits access to the email account."]
  ],
  "email-otp": [
    ["Proof", "A rotating six-digit code delivered to the email inbox."],
    ["Storage", "Only a hash is stored, with three attempts and a five-minute expiry."],
    ["Replay", "A successful sign-in consumes the code; requesting again rotates it."],
    ["Phishing", "Manual entry can be relayed by a real-time phishing site."],
    ["Classification", "Email is convenient but is not an approved out-of-band authenticator in current NIST guidance."]
  ],
  "sms-otp": [
    ["Simulation", "No real phone number or carrier is contacted. All identities and delivery outcomes are synthetic."],
    ["Number recycling", "A reassigned number can deliver an account proof to a new owner."],
    ["Interception", "Carrier compromise, forwarding, malware, and SIM-swap processes can redirect delivery."],
    ["Phishing", "A manually entered SMS code can be relayed in real time."],
    ["Operations", "Delivery failures, regional coverage, abuse, support, and per-message cost remain product concerns."]
  ]
} as const;

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

export function LinkCodeLab({ variant }: { variant: Variant }) {
  const searchParams = useSearchParams();
  const initialFlowId = searchParams.get("flow");
  const adapter =
    variant === "magic-link"
      ? magicLinkAdapter
      : variant === "email-otp"
        ? emailOtpAdapter
        : smsOtpAdapter;
  const [email, setEmail] = useState("ada@example.com");
  const [code, setCode] = useState("");
  const [flowId, setFlowId] = useState<string | null>(initialFlowId);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scenario, setScenario] =
    useState<"delivered" | "intercepted" | "recycled-number">("delivered");
  const [delivery, setDelivery] = useState<{
    code: string;
    expiresAt: string;
    recipient: string;
  } | null>(null);
  const { data: session, refetch } = authClient.useSession();

  const loadFlow = useCallback(async (id: string) => {
    const response = await fetch(`/api/lab/flows/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { flow: { events: LabEvent[] } };
    setEvents(data.flow.events);
  }, []);

  useEffect(() => {
    // Synchronize the callback-owned flow after the client reads its query string.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialFlowId) void loadFlow(initialFlowId);
  }, [initialFlowId, loadFlow]);

  async function run(
    journey: string,
    operation: string,
    action: (id: string) => Promise<{ ok: boolean; status: number }>
  ) {
    setBusy(true);
    setMessage("");
    try {
      const flow = await startFlow(adapter.metadata.slug, journey);
      setFlowId(flow.id);
      const started = performance.now();
      const result = await action(flow.id);
      await recordOutcome(flow.id, operation, result.ok, result.status, started);
      await loadFlow(flow.id);
      await refetch();
      return result.ok;
    } catch {
      setMessage("The local lab could not complete this journey.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (variant === "magic-link") {
      const ok = await run("magic-link", "magic-link-send", async (id) => {
        const result = await authClient.signIn.magicLink(
          {
            email,
            callbackURL: `${window.location.origin}/methods/magic-link?flow=${id}&verified=1`
          },
          { headers: { "x-auth-flow-id": id } }
        );
        return {
          ok: !result.error,
          status: result.error?.status ?? (result.error ? 400 : 200)
        };
      });
      setMessage(
        ok
          ? "If delivery is available, a five-minute single-use link is now in Mailpit."
          : "The link request could not be accepted."
      );
      return;
    }

    if (variant === "email-otp") {
      const ok = await run("email-otp", "email-otp-send", async (id) => {
        const result = await authClient.emailOtp.sendVerificationOtp(
          { email, type: "sign-in" },
          { headers: { "x-auth-flow-id": id } }
        );
        return {
          ok: !result.error,
          status: result.error?.status ?? (result.error ? 400 : 200)
        };
      });
      setMessage(ok ? "A rotating sign-in code is available in Mailpit." : "The code request was rejected.");
      return;
    }

    const ok = await run(
      "sms-otp-simulation",
      "sms-otp-send",
      async (id) => {
        const response = await fetch("/api/lab/sms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ flowId: id, scenario })
        });
        if (response.ok) {
          const data = await response.json() as { delivery: typeof delivery };
          setDelivery(data.delivery);
          setCode(data.delivery?.code ?? "");
        }
        return { ok: response.ok, status: response.status };
      }
    );
    setMessage(ok ? "Synthetic carrier outcome generated locally." : "The simulation was rejected.");
  }

  async function verify() {
    if (!flowId) return;
    setBusy(true);
    const started = performance.now();
    if (variant === "email-otp") {
      const result = await authClient.signIn.emailOtp(
        { email, otp: code },
        { headers: { "x-auth-flow-id": flowId } }
      );
      const ok = !result.error;
      await recordOutcome(
        flowId,
        "email-otp-verify",
        ok,
        result.error?.status ?? (ok ? 200 : 400),
        started
      );
      setMessage(ok ? "Email code consumed; session created." : "Invalid, expired, consumed, or rate-limited code.");
    } else {
      const response = await fetch("/api/lab/sms/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flowId, code })
      });
      await recordOutcome(
        flowId,
        "sms-otp-verify",
        response.ok,
        response.status,
        started
      );
      const data = await response.json() as { result: string };
      setMessage(
        response.ok
          ? "Synthetic code consumed. Submit it again to observe replay rejection."
          : `Simulation result: ${data.result}.`
      );
    }
    await loadFlow(flowId);
    await refetch();
    setBusy(false);
  }

  const networkEvents = events.filter((item) => item.safeMetadata.endpoint);
  const [ux, flowPanel, network, explanation, comparison] = adapter.panels;

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <PanelShell definition={ux} index={1}>
            {session?.user ? (
              <p className="form-message success">
                Session active for {session.user.email}
              </p>
            ) : null}
            <form className="form-stack" onSubmit={send}>
              {variant !== "sms-otp" ? (
                <div className="field">
                  <label htmlFor={`${variant}-email`}>EMAIL</label>
                  <input
                    id={`${variant}-email`}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="sms-scenario">SYNTHETIC DELIVERY SCENARIO</label>
                  <select
                    id="sms-scenario"
                    onChange={(event) => setScenario(event.target.value as typeof scenario)}
                    value={scenario}
                  >
                    <option value="delivered">Delivered to intended device</option>
                    <option value="intercepted">Carrier-path interception</option>
                    <option value="recycled-number">Recycled number</option>
                  </select>
                </div>
              )}
              <button className="button" disabled={busy} type="submit">
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : null}
                {variant === "magic-link"
                  ? "Send magic link"
                  : variant === "email-otp"
                    ? "Send email code"
                    : "Run SMS delivery simulation"}
              </button>
              {variant !== "magic-link" && flowId ? (
                <>
                  <div className="field">
                    <label htmlFor={`${variant}-code`}>
                      {variant === "sms-otp" ? "SYNTHETIC CODE" : "EMAIL CODE"}
                    </label>
                    <input
                      autoComplete="one-time-code"
                      id={`${variant}-code`}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setCode(event.target.value)}
                      value={code}
                    />
                  </div>
                  <button className="button secondary" onClick={() => void verify()} type="button">
                    Verify code
                  </button>
                </>
              ) : null}
              {delivery ? (
                <p className="form-message neutral">
                  Simulated inbox: {delivery.recipient} · expires{" "}
                  {new Date(delivery.expiresAt).toLocaleTimeString()}
                </p>
              ) : null}
              {message ? <p className="form-message neutral">{message}</p> : null}
              {variant !== "sms-otp" ? (
                <a className="mailpit-link" href="http://localhost:8025" target="_blank" rel="noreferrer">
                  Open local Mailpit inbox <ExternalLink size={14} />
                </a>
              ) : null}
            </form>
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
            ) : <div className="empty-state">Run a journey to populate the flow.</div>}
          </PanelShell>
          <PanelShell definition={network} index={3} wide>
            {networkEvents.map((event) => (
              <article className="request-card" key={event.id}>
                <div className="request-summary">
                  <span className="request-method">{event.safeMetadata.method ?? "EVENT"}</span>
                  <span className="request-path">{event.safeMetadata.endpoint}</span>
                  <span className={`request-status ${event.outcome}`}>
                    {event.safeMetadata.statusCode ?? event.outcome}
                  </span>
                </div>
              </article>
            ))}
            {!networkEvents.length ? <div className="empty-state">Only sanitized projections appear here.</div> : null}
          </PanelShell>
          <PanelShell definition={explanation} index={4}>
            <div className="explanation-grid">
              {explanations[variant].map(([title, copy]) => (
                <div className="explanation-item" key={title}>
                  <h3>{title}</h3><p>{copy}</p>
                </div>
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
