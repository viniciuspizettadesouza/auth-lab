import { Trash2 } from "lucide-react";

import type { PasswordLabController } from "@/features/password/use-password-lab-controller";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

export function FlowHistory({
  controller
}: {
  controller: PasswordLabController;
}) {
  const {
    activeFlow,
    clearHistory,
    deleteCurrentFlow,
    flows,
    selectFlow
  } = controller;

  return (
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
              onClick={() => selectFlow(flow.id)}
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
  );
}
