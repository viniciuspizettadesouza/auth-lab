"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import type { LabEvent } from "@/contracts";
import { defensiveSimulatorAdapter } from "@/features/defensive-simulator/adapter";
import {
  defensiveScenarioCatalog,
  type DefensiveFamily,
  type DefensiveResult,
  type DefensiveScenarioId
} from "@/features/defensive-simulator/server/scenarios";
import { PanelShell } from "@/features/password/components/panel-shell";

const families: DefensiveFamily[] = [
  "Credentials",
  "Links, codes & recovery",
  "Sessions & OAuth",
  "Origin & token binding"
];

async function createFlow() {
  const response = await fetch("/api/lab/flows", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "defensive-simulator", journey: "defensive-scenarios" })
  });
  if (!response.ok) throw new Error("Could not start an owned simulator flow.");
  return (await response.json() as { flow: { id: string } }).flow.id;
}

async function record(flowId: string, response: Response) {
  await fetch(`/api/lab/flows/${flowId}/events`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      durationMs: 0,
      operation: "simulator-run",
      outcome: response.ok ? "success" : "failure",
      statusCode: response.status
    })
  });
}

export function DefensiveSimulatorLab() {
  const [family, setFamily] = useState<DefensiveFamily>("Credentials");
  const [result, setResult] = useState<DefensiveResult | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const loadFlow = useCallback(async (flowId: string) => {
    const response = await fetch(`/api/lab/flows/${flowId}`, { cache: "no-store" });
    if (response.ok) setEvents((await response.json() as { flow: { events: LabEvent[] } }).flow.events);
  }, []);

  async function runScenario(scenario: DefensiveScenarioId) {
    setBusy(true);
    try {
      const flowId = await createFlow();
      const response = await fetch("/api/lab/defensive-simulator", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario })
      });
      await record(flowId, response);
      if (!response.ok) throw new Error("The bounded scenario was rejected.");
      const data = await response.json() as DefensiveResult;
      setResult(data);
      setMessage({
        tone: data.executed === false && data.synthetic ? "success" : "error",
        text: data.executed === false
          ? "Consequence model complete. No attack, request burst, credential use, redirect, token use, or external action occurred."
          : "Safety invariant failed."
      });
      await loadFlow(flowId);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Scenario failed." });
    } finally { setBusy(false); }
  }

  const [ux, flow, network, explanation, comparison] = defensiveSimulatorAdapter.panels;
  const networkEvents = events.filter((event) => event.safeMetadata.endpoint);
  const comparisonSlugs = family === "Credentials"
    ? ["password", "passkey"]
    : family === "Links, codes & recovery"
      ? ["magic-link", "email-otp", "sms-otp", "totp", "passkey"]
      : family === "Sessions & OAuth"
        ? ["cookie-session", "oidc", "dpop"]
        : ["password", "passkey", "dpop", "fapi", "mtls"];

  return <div className="lab-layout">
    <div className="lab-main"><div className="lab-grid">
      <PanelShell definition={ux} index={1}>
        <div className="form-stack">
          <p className="form-message neutral">Choose only from fixed local scenarios. There are no target, URL, credential, payload, concurrency, header, token, or free-form attack inputs.</p>
          <div className="defense-strip"><div><span>Safety invariant</span><strong>synthetic: true · executed: false</strong></div><p>The endpoint returns a consequence trace and defensive controls. It cannot make a login attempt, follow a redirect, call a resource, send a message, or execute a tool.</p></div>
          <div className="auth-tabs" role="tablist" aria-label="Defensive scenario family">
            {families.map((item) => <button aria-selected={family === item} className={`auth-tab${family === item ? " active" : ""}`} key={item} onClick={() => { setFamily(item); setResult(null); }} role="tab" type="button">{item}</button>)}
          </div>
          <div className="button-row">
            {defensiveScenarioCatalog.filter((item) => item.family === family).map((item) => <button className="button secondary" disabled={busy} key={item.id} onClick={() => void runScenario(item.id)} type="button"><ShieldAlert size={14} /> {item.title}</button>)}
          </div>
          {result ? <div className="session-card"><span className="session-id">{result.title}</span><p>{result.summary}<br /><br /><strong>Consequence:</strong> {result.consequence}</p></div> : null}
          {message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}
        </div>
      </PanelShell>

      <PanelShell definition={flow} index={2}>
        {result ? <><div className="flow-stage">{result.steps.map((step, index) => <span key={`${step.actor}-${index}`} style={{ display: "contents" }}><span className={`flow-node active`}>{step.actor}</span>{index < result.steps.length - 1 ? <span className="flow-arrow">→</span> : null}</span>)}</div><div className="event-log">{result.steps.map((step, index) => <div className="event-row" key={`${step.action}-${index}`}><span className="event-sequence">{String(index + 1).padStart(2, "0")}</span><span className="event-actor">{step.outcome}</span><span className="event-description">{step.action}</span></div>)}</div></> : <div className="empty-state">Select a fixed scenario to show its consequence and containment trace.</div>}
      </PanelShell>

      <PanelShell definition={network} index={3}>
        <div className="request-list">{networkEvents.length ? networkEvents.map((event) => <div className="request-card" key={event.id}><div className="request-summary"><span className="request-method">{event.safeMetadata.method}</span><span className="request-path">{event.safeMetadata.endpoint}</span><span className={`request-status ${event.outcome}`}>{event.safeMetadata.statusCode}</span></div><p className="request-note">Only the fixed scenario identifier crosses this local boundary. Arbitrary bodies and all security artifacts are excluded from the recorder.</p></div>) : <div className="empty-state">The simulator records only its local endpoint shape, timing, and outcome.</div>}</div>
        <hr className="panel-rule" />
        <div className="event-log">{events.map((event) => <div className="event-row" key={event.id}><span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span><span className="event-actor">{event.actor}</span><span className="event-description">{event.description}</span></div>)}</div>
      </PanelShell>

      <PanelShell definition={explanation} index={4}>
        {result ? <div className="form-stack"><div className="explanation-grid"><div className="explanation-item"><h3>Defensive controls</h3><p>{result.controls.join(" · ")}</p></div><div className="explanation-item"><h3>Simulation limit</h3><p>{result.limitation}</p></div><div className="explanation-item"><h3>Consequence</h3><p>{result.consequence}</p></div><div className="explanation-item"><h3>Invariant</h3><p>Synthetic: yes. Executed: no. No production security conclusion follows from this educational outcome.</p></div></div></div> : null}
        <div className="explanation-grid">{[
          ["No operational attack surface", "The API accepts one enum value. It has no target address, arbitrary request, credential, wordlist, traffic, timing, concurrency, redirect, or tool parameter."],
          ["Consequence first", "Each trace explains what failure would mean, which boundary blocks or contains it, and what risk remains."],
          ["Synthetic identities", "Labels refer only to invented accounts, grants, origins, and services. No account lookup or session creation occurs."],
          ["Defense in depth", "Rate limits, binding, expiry, replay caches, revocation, notification, recovery, and monitoring address different failure modes."],
          ["Not a security assessment", "Fixed examples cannot test configuration drift, proxies, provider behavior, deployment architecture, abuse economics, or incident response."],
          ["Authorized follow-up", "Production assurance requires scoped threat modeling, code review, defensive tests, observability, and explicitly authorized security assessment."]
        ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}</div>
      </PanelShell>

      <PanelShell definition={comparison} index={5} wide><ComparisonTable slugs={comparisonSlugs} /></PanelShell>
    </div></div>
    <aside className="lab-sidebar"><p className="eyebrow">Defensive simulator</p><h2>Show the failure. Keep the attack out.</h2><p>Every scenario is a bounded explanation of consequence, prevention, containment, and recovery—not a runnable offensive technique.</p><p className="sidebar-note"><ShieldCheck size={14} /> Local endpoint only · fixed enum · synthetic labels · executed false.</p></aside>
  </div>;
}
