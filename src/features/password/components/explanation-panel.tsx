import type { MethodPanelDefinition } from "@/contracts";
import { passwordExplanation } from "@/features/password/adapter";
import { PanelShell } from "@/features/password/components/panel-shell";

export function ExplanationPanel({
  definition
}: {
  definition: MethodPanelDefinition;
}) {
  return (
    <PanelShell definition={definition} index={4}>
      <div className="explanation-grid">
        {passwordExplanation.map(([title, copy]) => (
          <div className="explanation-item" key={title}>
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
