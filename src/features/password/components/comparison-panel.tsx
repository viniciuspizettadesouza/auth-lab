import type { MethodPanelDefinition } from "@/contracts";
import { ComparisonTable } from "@/components/comparison-table";
import { PanelShell } from "@/features/password/components/panel-shell";

export function ComparisonPanel({
  definition
}: {
  definition: MethodPanelDefinition;
}) {
  return (
    <PanelShell definition={definition} index={5}>
      <div style={{ overflowX: "auto" }}>
        <ComparisonTable />
      </div>
    </PanelShell>
  );
}
