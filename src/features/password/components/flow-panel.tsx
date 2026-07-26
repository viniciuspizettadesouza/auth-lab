import type { MethodPanelDefinition } from "@/contracts";
import type { PasswordLabController } from "@/features/password/use-password-lab-controller";
import { PanelShell } from "@/features/password/components/panel-shell";

const actors = ["browser", "application", "database", "email"] as const;

export function FlowPanel({
  controller,
  definition
}: {
  controller: PasswordLabController;
  definition: MethodPanelDefinition;
}) {
  return (
    <PanelShell definition={definition} index={2}>
      <div className="flow-stage" aria-label="Authentication actors">
        {actors.map((actor, index) => (
          <div style={{ display: "contents" }} key={actor}>
            <div
              className={`flow-node ${controller.lastActor === actor ? "active" : ""}`}
            >
              {actor}
            </div>
            {index < actors.length - 1 ? (
              <span className="flow-arrow" aria-hidden="true">→</span>
            ) : null}
          </div>
        ))}
      </div>
      {controller.activeFlow?.events.length ? (
        <div className="event-log" aria-live="polite">
          {controller.activeFlow.events.map((event) => (
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
    </PanelShell>
  );
}
