"use client";

import {
  FormEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ExternalLink,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Trash2
} from "lucide-react";

import { ComparisonTable } from "@/components/comparison-table";
import { authClient } from "@/lib/auth-client";
import { publicAuthError } from "@/lib/credentials";

type Journey = "sign-up" | "sign-in" | "password-reset" | "session";
type AuthMode = "sign-up" | "sign-in" | "forgot";

type FlowSummary = {
  id: string;
  journey: Journey;
  status: "active" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  eventCount: number;
};

type LabEvent = {
  id: string;
  sequence: number;
  actor: "user" | "browser" | "application" | "database" | "email";
  action: string;
  description: string;
  outcome: "pending" | "success" | "failure" | "info";
  safeMetadata: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    durationMs?: number;
    fields?: string[];
    entityId?: string;
    email?: string;
    cookieFlags?: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: string;
    };
  };
  createdAt: string;
};

type FlowDetail = FlowSummary & { events: LabEvent[] };

type SessionSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
};

type Operation =
  | "sign-up"
  | "sign-in"
  | "sign-out"
  | "request-reset"
  | "reset-password"
  | "list-sessions"
  | "revoke-session";

const actors = ["browser", "application", "database", "email"] as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

async function createFlow(journey: Journey): Promise<FlowSummary> {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ journey })
  });
  if (!response.ok) throw new Error("Could not start the educational recorder.");
  const data = (await response.json()) as { flow: FlowSummary };
  return data.flow;
}

async function recordClientOutcome(
  flowId: string,
  operation: Operation,
  outcome: "success" | "failure",
  statusCode: number,
  durationMs: number
) {
  await fetch(`/api/lab/flows/${flowId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation,
      outcome,
      statusCode,
      durationMs
    })
  });
}

export function PasswordLab() {
  const searchParams = useSearchParams();
  const initialFlowId = searchParams.get("flow");
  const verified = searchParams.get("verified") === "1";
  const { data: session, isPending: sessionPending, refetch } = authClient.useSession();

  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [name, setName] = useState("Ada Developer");
  const [email, setEmail] = useState("ada@example.com");
  const [password, setPassword] = useState("correct horse battery staple");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "neutral";
    text: string;
  } | null>(
    verified
      ? {
          tone: "success",
          text: "Email verified. Sign in explicitly to observe session creation."
        }
      : null
  );
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [activeFlow, setActiveFlow] = useState<FlowDetail | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const mailpitUrl =
    process.env.NEXT_PUBLIC_MAILPIT_URL ?? "http://localhost:8025";

  const loadFlows = useCallback(async () => {
    const response = await fetch("/api/lab/flows", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { flows: FlowSummary[] };
    setFlows(data.flows);
    return data.flows;
  }, []);

  const loadFlow = useCallback(async (flowId: string) => {
    const response = await fetch(`/api/lab/flows/${flowId}`, {
      cache: "no-store"
    });
    if (!response.ok) return;
    const data = (await response.json()) as { flow: FlowDetail };
    setActiveFlow(data.flow);
  }, []);

  const refreshRecorder = useCallback(
    async (preferredId?: string) => {
      const latest = await loadFlows();
      const id = preferredId ?? activeFlow?.id ?? latest?.[0]?.id;
      if (id) await loadFlow(id);
    },
    [activeFlow?.id, loadFlow, loadFlows]
  );

  const loadSessions = useCallback(
    async (flowId?: string) => {
      const started = performance.now();
      const response = await fetch("/api/lab/sessions", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { sessions: SessionSummary[] };
        setSessions(data.sessions);
      } else {
        setSessions([]);
      }
      if (flowId) {
        await recordClientOutcome(
          flowId,
          "list-sessions",
          response.ok ? "success" : "failure",
          response.status,
          Math.round(performance.now() - started)
        );
        await refreshRecorder(flowId);
      }
    },
    [refreshRecorder]
  );

  useEffect(() => {
    // Initial remote-state synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFlows().then((items) => {
      const id = initialFlowId ?? items?.[0]?.id;
      if (id) void loadFlow(id);
    });
  }, [initialFlowId, loadFlow, loadFlows]);

  useEffect(() => {
    // Session changes invalidate the token-free session summaries.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user) void loadSessions();
    else {
      setSessions([]);
    }
  }, [session?.user, loadSessions]);

  async function runAction(
    journey: Journey,
    operation: Operation,
    action: (flowId: string) => Promise<{ error?: { code?: string; status?: number } | null }>,
    successMessage: string
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const flow = await createFlow(journey);
      setActiveFlow({ ...flow, events: [] });
      const started = performance.now();
      const result = await action(flow.id);
      const failed = Boolean(result.error);
      await recordClientOutcome(
        flow.id,
        operation,
        failed ? "failure" : "success",
        result.error?.status ?? (failed ? 400 : 200),
        Math.round(performance.now() - started)
      );
      setMessage({
        tone: failed ? "error" : "success",
        text: failed ? publicAuthError(result.error?.code) : successMessage
      });
      await refreshRecorder(flow.id);
      await refetch();
    } catch {
      setMessage({
        tone: "error",
        text: "The local lab could not reach its application or database service."
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const appUrl = window.location.origin;
    if (mode === "sign-up") {
      await runAction(
        "sign-up",
        "sign-up",
        (flowId) =>
          authClient.signUp.email(
            {
              name,
              email,
              password,
              callbackURL: `${appUrl}/methods/password?verified=1&flow=${flowId}`
            },
            { headers: { "x-auth-flow-id": flowId } }
          ),
        "Registration accepted. Open Mailpit and verify the address before signing in."
      );
      return;
    }

    if (mode === "forgot") {
      await runAction(
        "password-reset",
        "request-reset",
        (flowId) =>
          authClient.requestPasswordReset(
            {
              email,
              redirectTo: `${appUrl}/reset-password?flow=${flowId}`
            },
            { headers: { "x-auth-flow-id": flowId } }
          ),
        "If the account exists, a reset link is now available in Mailpit."
      );
      return;
    }

    await runAction(
      "sign-in",
      "sign-in",
      (flowId) =>
        authClient.signIn.email(
          { email, password, rememberMe: true },
          { headers: { "x-auth-flow-id": flowId } }
        ),
      "Authentication completed. An opaque database session is active."
    );
  }

  async function signOut() {
    await runAction(
      "session",
      "sign-out",
      (flowId) =>
        authClient.signOut({
          fetchOptions: { headers: { "x-auth-flow-id": flowId } }
        }),
      "The current session was revoked and its browser cookie was cleared."
    );
    setSessions([]);
  }

  async function revokeSession(id: string) {
    const flow = await createFlow("session");
    const response = await fetch(`/api/lab/sessions/${id}`, {
      method: "DELETE"
    });
    await recordClientOutcome(
      flow.id,
      "revoke-session",
      response.ok ? "success" : "failure",
      response.status,
      0
    );
    await loadSessions();
    await refreshRecorder(flow.id);
    await refetch();
  }

  async function deleteCurrentFlow() {
    if (!activeFlow) return;
    await fetch(`/api/lab/flows/${activeFlow.id}`, { method: "DELETE" });
    setActiveFlow(null);
    const remaining = await loadFlows();
    if (remaining?.[0]) await loadFlow(remaining[0].id);
  }

  async function clearHistory() {
    await fetch("/api/lab/flows", { method: "DELETE" });
    setFlows([]);
    setActiveFlow(null);
  }

  const lastActor =
    activeFlow?.events.at(-1)?.actor === "user"
      ? "browser"
      : activeFlow?.events.at(-1)?.actor;
  const networkEvents = useMemo(
    () => activeFlow?.events.filter((event) => event.safeMetadata.endpoint) ?? [],
    [activeFlow]
  );

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <section className="lab-panel">
            <header className="panel-header">
              <span className="panel-index">01</span>
              <h2>User experience</h2>
              <span className="panel-header-note">Real flow</span>
            </header>
            <div className="panel-body">
              {session?.user ? (
                <div className="form-stack">
                  <p className="form-message success">
                    <Check size={14} style={{ display: "inline", marginRight: 7 }} />
                    Signed in as {session.user.email}
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void signOut()}
                    type="button"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => void loadSessions(activeFlow?.id)}
                    type="button"
                  >
                    <RefreshCw size={14} /> Inspect sessions
                  </button>
                  <div>
                    {sessions.map((item) => (
                      <div className="session-card" key={item.id}>
                        <div className="session-top">
                          <span className="session-id">
                            {item.id.slice(0, 8)}… {item.current ? "· current" : ""}
                          </span>
                          <button
                            className="button danger small"
                            onClick={() => void revokeSession(item.id)}
                            type="button"
                          >
                            Revoke
                          </button>
                        </div>
                        <p>
                          Expires {new Date(item.expiresAt).toLocaleString()}
                          <br />
                          {item.userAgent?.slice(0, 80) ?? "Unknown user agent"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="auth-tabs" role="tablist" aria-label="Password journeys">
                    {[
                      ["sign-up", "Sign up"],
                      ["sign-in", "Sign in"],
                      ["forgot", "Reset"]
                    ].map(([value, label]) => (
                      <button
                        aria-selected={mode === value}
                        className={`auth-tab ${mode === value ? "active" : ""}`}
                        key={value}
                        onClick={() => {
                          setMode(value as AuthMode);
                          setMessage(null);
                        }}
                        role="tab"
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <form className="form-stack" onSubmit={handleSubmit}>
                    {mode === "sign-up" ? (
                      <div className="field">
                        <label htmlFor="name">NAME</label>
                        <input
                          autoComplete="name"
                          id="name"
                          onChange={(event) => setName(event.target.value)}
                          required
                          value={name}
                        />
                      </div>
                    ) : null}
                    <div className="field">
                      <label htmlFor="email">EMAIL</label>
                      <input
                        autoComplete="email"
                        id="email"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        type="email"
                        value={email}
                      />
                    </div>
                    {mode !== "forgot" ? (
                      <div className="field">
                        <label htmlFor="password">PASSWORD</label>
                        <input
                          autoComplete={
                            mode === "sign-up" ? "new-password" : "current-password"
                          }
                          id="password"
                          minLength={12}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          type="password"
                          value={password}
                        />
                        <span className="field-help">
                          12–128 characters. The recorder stores only the field name.
                        </span>
                      </div>
                    ) : null}
                    <button className="button" disabled={busy} type="submit">
                      {busy ? <LoaderCircle className="animate-spin" size={15} /> : null}
                      {mode === "sign-up"
                        ? "Create account"
                        : mode === "sign-in"
                          ? "Create session"
                          : "Send reset link"}
                    </button>
                    {message ? (
                      <p className={`form-message ${message.tone}`}>{message.text}</p>
                    ) : null}
                    {(mode === "sign-up" || mode === "forgot" || message?.text.includes("Mailpit")) ? (
                      <a
                        className="mailpit-link"
                        href={mailpitUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open local Mailpit inbox <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </form>
                </>
              )}
              {sessionPending ? (
                <p className="field-help" style={{ marginTop: 12 }}>
                  Checking the database-backed session…
                </p>
              ) : null}
            </div>
          </section>

          <section className="lab-panel">
            <header className="panel-header">
              <span className="panel-index">02</span>
              <h2>Flow</h2>
              <span className="panel-header-note">Ordered events</span>
            </header>
            <div className="panel-body">
              <div className="flow-stage" aria-label="Authentication actors">
                {actors.map((actor, index) => (
                  <div style={{ display: "contents" }} key={actor}>
                    <div className={`flow-node ${lastActor === actor ? "active" : ""}`}>
                      {actor}
                    </div>
                    {index < actors.length - 1 ? (
                      <span className="flow-arrow" aria-hidden="true">→</span>
                    ) : null}
                  </div>
                ))}
              </div>
              {activeFlow?.events.length ? (
                <div className="event-log" aria-live="polite">
                  {activeFlow.events.map((event) => (
                    <div className="event-row" key={event.id}>
                      <span className="event-sequence">
                        {String(event.sequence).padStart(2, "0")}
                      </span>
                      <span className="event-actor">{event.actor}</span>
                      <span className="event-description">{event.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  Run a journey to populate the actor timeline.
                </div>
              )}
            </div>
          </section>

          <section className="lab-panel wide">
            <header className="panel-header">
              <span className="panel-index">03</span>
              <h2>Network inspector</h2>
              <span className="panel-header-note">Sanitized projection</span>
            </header>
            <div className="panel-body">
              {networkEvents.length ? (
                <div className="request-list">
                  {networkEvents.map((event) => {
                    const meta = event.safeMetadata;
                    return (
                      <article className="request-card" key={event.id}>
                        <div className="request-summary">
                          <span className="request-method">{meta.method ?? "EVENT"}</span>
                          <span className="request-path">{meta.endpoint}</span>
                          <span className="request-duration">
                            {meta.durationMs === undefined ? "—" : `${meta.durationMs}ms`}
                          </span>
                          <span className={`request-status ${event.outcome}`}>
                            {meta.statusCode ?? event.outcome}
                          </span>
                        </div>
                        <div className="request-details">
                          {meta.fields?.map((field) => (
                            <span className="detail-chip" key={field}>
                              field:{field}
                            </span>
                          ))}
                          {meta.email ? (
                            <span className="detail-chip">email:{meta.email}</span>
                          ) : null}
                          {meta.cookieFlags ? (
                            <>
                              <span className="detail-chip">
                                httpOnly:{String(meta.cookieFlags.httpOnly)}
                              </span>
                              <span className="detail-chip">
                                secure:{String(meta.cookieFlags.secure)}
                              </span>
                              <span className="detail-chip">
                                sameSite:{meta.cookieFlags.sameSite}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  Raw requests are never retained. Safe projections appear here.
                </div>
              )}
            </div>
          </section>

          <section className="lab-panel">
            <header className="panel-header">
              <span className="panel-index">04</span>
              <h2>Explanation</h2>
              <span className="panel-header-note">Threat model</span>
            </header>
            <div className="panel-body">
              <div className="explanation-grid">
                {[
                  ["User provides", "An email identifier and a reusable shared secret."],
                  ["Server stores", "A one-way password hash in the credential account, never the original password."],
                  ["Identity verifier", "The application compares the submitted password against that hash."],
                  ["Phishing resistance", "Low. A convincing origin can capture and relay both fields."],
                  ["Replay resistance", "Session cookies reduce repeated password use, but stolen credentials remain reusable."],
                  ["Recovery", "A short-lived, single-use proof delivered to the verified email inbox."],
                  ["Session", "An opaque HttpOnly cookie references a revocable PostgreSQL record."],
                  ["Operational cost", "Password policy, abuse controls, email delivery, reset flows, and breach response."]
                ].map(([title, copy]) => (
                  <div className="explanation-item" key={title}>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="lab-panel">
            <header className="panel-header">
              <span className="panel-index">05</span>
              <h2>Comparison</h2>
              <span className="panel-header-note">Contextual</span>
            </header>
            <div className="panel-body" style={{ overflowX: "auto" }}>
              <ComparisonTable />
            </div>
          </section>
        </div>
      </div>

      <aside className="history-sidebar" aria-label="Authentication flow history">
        <div className="history-header">
          <h2>Flow history</h2>
          <div style={{ display: "flex", gap: 5 }}>
            {activeFlow ? (
              <button
                aria-label="Delete selected flow"
                className="button danger small"
                onClick={() => void deleteCurrentFlow()}
                title="Delete selected flow"
                type="button"
              >
                <Trash2 size={12} />
              </button>
            ) : null}
            <button
              className="button secondary small"
              disabled={!flows.length}
              onClick={() => void clearHistory()}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="history-list">
          {flows.length ? (
            flows.map((flow) => (
              <button
                className={`history-item ${activeFlow?.id === flow.id ? "active" : ""}`}
                key={flow.id}
                onClick={() =>
                  startTransition(() => {
                    void loadFlow(flow.id);
                  })
                }
                type="button"
              >
                <span className="history-item-top">
                  <span>{flow.journey.replace("-", " ")}</span>
                  <span className={`flow-status ${flow.status}`} />
                </span>
                <p>
                  {formatTimestamp(flow.createdAt)} · {flow.eventCount} events
                </p>
              </button>
            ))
          ) : (
            <div className="empty-state">
              Persisted, visitor-owned flows will appear here.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
