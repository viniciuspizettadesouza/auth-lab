export type AgentScenario = "read-calendar" | "send-email" | "wire-money" | "expired-delegation";

export function evaluateAgentAction(scenario: AgentScenario) {
  const base = {
    agent: "synthetic-scheduling-agent",
    principal: "demo-user",
    resource: "local-synthetic-resource",
    executed: false,
    status: "product-experiment" as const
  };
  if (scenario === "read-calendar") return {
    ...base, action: "calendar.read", decision: "allow" as const,
    reason: "The delegated scope and resource match this low-risk read action.",
    controls: ["agent identity", "user delegation", "calendar.read scope", "resource match", "audit"]
  };
  if (scenario === "send-email") return {
    ...base, action: "email.send", decision: "approval-required" as const,
    reason: "A consequential external side effect requires fresh human approval.",
    controls: ["agent identity", "user delegation", "recipient preview", "human approval", "audit"]
  };
  if (scenario === "wire-money") return {
    ...base, action: "payments.transfer", decision: "deny" as const,
    reason: "The delegation has no payment scope and policy forbids privilege inference.",
    controls: ["agent identity", "scope mismatch", "high-risk policy", "deny by default"]
  };
  return {
    ...base, action: "calendar.read", decision: "deny" as const,
    reason: "The user delegation expired; an agent cannot silently renew authority.",
    controls: ["agent identity", "delegation expiry", "reauthorization required"]
  };
}
