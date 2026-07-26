"use client";

import {
  type FormEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useSearchParams } from "next/navigation";

import type { FlowSummary, LabEvent, SessionSummary } from "@/contracts";
import { authClient } from "@/lib/auth-client";
import { publicAuthError } from "@/features/password/server/credentials";
import type {
  PasswordJourney,
  PasswordOperation
} from "@/features/password/adapter";

export type AuthMode = "sign-up" | "sign-in" | "forgot";
export type PasswordFlowSummary = FlowSummary<PasswordJourney>;
export type PasswordFlowDetail = PasswordFlowSummary & { events: LabEvent[] };

async function createFlow(
  journey: PasswordJourney
): Promise<PasswordFlowSummary> {
  const response = await fetch("/api/lab/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ journey })
  });
  if (!response.ok) throw new Error("Could not start the educational recorder.");
  const data = (await response.json()) as { flow: PasswordFlowSummary };
  return data.flow;
}

async function recordClientOutcome(
  flowId: string,
  operation: PasswordOperation,
  outcome: "success" | "failure",
  statusCode: number,
  durationMs: number
) {
  await fetch(`/api/lab/flows/${flowId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation, outcome, statusCode, durationMs })
  });
}

export function usePasswordLabController() {
  const searchParams = useSearchParams();
  const initialFlowId = searchParams.get("flow");
  const verified = searchParams.get("verified") === "1";
  const { data: session, isPending: sessionPending, refetch } =
    authClient.useSession();

  const [mode, setModeState] = useState<AuthMode>("sign-up");
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
  const [flows, setFlows] = useState<PasswordFlowSummary[]>([]);
  const [activeFlow, setActiveFlow] = useState<PasswordFlowDetail | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const mailpitUrl =
    process.env.NEXT_PUBLIC_MAILPIT_URL ?? "http://localhost:8025";

  const loadFlows = useCallback(async () => {
    const response = await fetch("/api/lab/flows", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { flows: PasswordFlowSummary[] };
    setFlows(data.flows);
    return data.flows;
  }, []);

  const loadFlow = useCallback(async (flowId: string) => {
    const response = await fetch(`/api/lab/flows/${flowId}`, {
      cache: "no-store"
    });
    if (!response.ok) return;
    const data = (await response.json()) as { flow: PasswordFlowDetail };
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
    else setSessions([]);
  }, [session?.user, loadSessions]);

  async function runAction(
    journey: PasswordJourney,
    operation: PasswordOperation,
    action: (
      flowId: string
    ) => Promise<{ error?: { code?: string; status?: number } | null }>,
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
        text: failed
          ? publicAuthError(result.error?.code, result.error?.status)
          : successMessage
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
    const response = await fetch(`/api/lab/sessions/${id}`, { method: "DELETE" });
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

  function setMode(nextMode: AuthMode) {
    setModeState(nextMode);
    setMessage(null);
  }

  const lastActor =
    activeFlow?.events.at(-1)?.actor === "user"
      ? "browser"
      : activeFlow?.events.at(-1)?.actor;
  const networkEvents = useMemo(
    () => activeFlow?.events.filter((event) => event.safeMetadata.endpoint) ?? [],
    [activeFlow]
  );

  return {
    activeFlow,
    busy,
    clearHistory,
    deleteCurrentFlow,
    email,
    flows,
    handleSubmit,
    lastActor,
    loadFlow,
    loadSessions,
    mailpitUrl,
    message,
    mode,
    name,
    networkEvents,
    password,
    revokeSession,
    session,
    sessionPending,
    sessions,
    setEmail,
    setMode,
    setName,
    setPassword,
    signOut,
    selectFlow: (id: string) =>
      startTransition(() => {
        void loadFlow(id);
      })
  };
}

export type PasswordLabController = ReturnType<
  typeof usePasswordLabController
>;
