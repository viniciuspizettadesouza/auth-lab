import type { ReactNode } from "react";

import type { MethodPanelDefinition } from "@/contracts";

export function PanelShell({
  children,
  definition,
  index,
  wide = false
}: {
  children: ReactNode;
  definition: MethodPanelDefinition;
  index: number;
  wide?: boolean;
}) {
  return (
    <section className={`lab-panel${wide ? " wide" : ""}`}>
      <header className="panel-header">
        <span className="panel-index">{String(index).padStart(2, "0")}</span>
        <h2>{definition.title}</h2>
        <span className="panel-header-note">{definition.note}</span>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
