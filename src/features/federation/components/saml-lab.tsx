"use client";

import { useState } from "react";

import { ComparisonTable } from "@/components/comparison-table";
import { samlAdapter } from "@/features/federation/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";

export function SamlLab() {
  const [result, setResult] = useState<{
    scenario: string;
    ok: boolean;
    status: number;
    checks?: string[];
    reason?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function simulate(scenario: "valid" | "wrong-audience" | "expired") {
    setBusy(true);
    const flowResponse = await fetch("/api/lab/flows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "saml", journey: "saml-simulation" })
    });
    const { flow } = await flowResponse.json() as { flow: { id: string } };
    const started = performance.now();
    const response = await fetch("/api/lab/federation/saml", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario })
    });
    const data = await response.json() as { checks?: string[]; reason?: string };
    await fetch(`/api/lab/flows/${flow.id}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "saml-simulate",
        outcome: response.ok ? "success" : "failure",
        statusCode: response.status,
        durationMs: Math.round(performance.now() - started)
      })
    });
    setResult({ scenario, ok: response.ok, status: response.status, ...data });
    setBusy(false);
  }

  const [ux, flow, network, explanation, comparison] = samlAdapter.panels;
  return (
    <div className="lab-grid">
      <PanelShell definition={ux} index={1}>
        <div className="form-stack">
          <p className="form-message neutral">
            Safe simulation only: no XML, certificate, assertion, or session is accepted or created.
          </p>
          <button className="button" disabled={busy} onClick={() => void simulate("valid")} type="button">Simulate valid assertion</button>
          <button className="button secondary" disabled={busy} onClick={() => void simulate("wrong-audience")} type="button">Try wrong audience</button>
          <button className="button secondary" disabled={busy} onClick={() => void simulate("expired")} type="button">Try expired assertion</button>
          {result ? <p className={`form-message ${result.ok ? "success" : "error"}`}>
            {result.ok ? "All modeled checks passed; the simulation still creates no session." : result.reason}
          </p> : null}
        </div>
      </PanelShell>
      <PanelShell definition={flow} index={2}>
        <div className="flow-stage">
          {["User", "Browser", "Service provider", "Identity provider", "Directory"].map((actor, index) => (
            <span key={actor} style={{ display: "contents" }}>
              <span className={`flow-node${result && result.checks && index < result.checks.length ? " active" : ""}`}>{actor}</span>
              {index < 4 ? <span className="flow-arrow">→</span> : null}
            </span>
          ))}
        </div>
        <div className="event-log">
          {result?.checks?.map((check, index) => <div className="event-row" key={check}>
            <span className="event-sequence">{String(index + 1).padStart(2, "0")}</span>
            <span className="event-actor">service provider</span><span className="event-description">Checked {check}.</span>
          </div>) ?? <div className="empty-state">Choose a modeled assertion outcome.</div>}
        </div>
      </PanelShell>
      <PanelShell definition={network} index={3}>
        {result ? <div className="request-card"><div className="request-summary">
          <span className="request-method">POST</span><span className="request-path">/api/lab/federation/saml</span>
          <span className={`request-status ${result.ok ? "success" : "failure"}`}>{result.status}</span>
        </div></div> : <div className="empty-state">The simulator accepts a scenario label, never an executable SAML document.</div>}
      </PanelShell>
      <PanelShell definition={explanation} index={4}>
        <div className="explanation-grid">
          {[
            ["Assertion", "The IdP signs an XML statement about authentication and attributes; it is not an OAuth access token."],
            ["Binding", "Browser POST or redirect bindings carry the response to the service provider's assertion consumer service."],
            ["Validation", "Signature, trusted issuer metadata, audience, destination, request correlation, time window, and replay cache all matter."],
            ["Certificates", "Signing-certificate rollover and metadata distribution are operational lifecycle concerns."],
            ["Linking", "NameID and attributes need an explicit, tenant-aware account-linking policy; email alone is fragile."],
            ["Scope", "This exhibit is deliberately non-interactive because a toy XML parser or signature validator would teach unsafe production patterns."]
          ].map(([title, copy]) => <div className="explanation-item" key={title}><h3>{title}</h3><p>{copy}</p></div>)}
        </div>
      </PanelShell>
      <PanelShell definition={comparison} index={5} wide>
        <ComparisonTable slugs={["saml", "oidc"]} />
      </PanelShell>
    </div>
  );
}
