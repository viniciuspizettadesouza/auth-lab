import { describe, expect, it } from "vitest";

import { evaluateAgentAction } from "@/features/portable/server/agent-policy";

describe("agent authorization exhibit", () => {
  it("allows a scoped read but never executes it", () => {
    expect(evaluateAgentAction("read-calendar")).toMatchObject({ decision: "allow", executed: false, status: "product-experiment" });
  });

  it("requires approval for side effects and denies missing or expired authority", () => {
    expect(evaluateAgentAction("send-email")).toMatchObject({ decision: "approval-required", executed: false });
    expect(evaluateAgentAction("wire-money")).toMatchObject({ decision: "deny", executed: false });
    expect(evaluateAgentAction("expired-delegation")).toMatchObject({ decision: "deny", executed: false });
  });
});
