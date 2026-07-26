import type { MethodPanelDefinition } from "@/contracts";
import type { PasswordLabController } from "@/features/password/use-password-lab-controller";
import { PanelShell } from "@/features/password/components/panel-shell";

export function NetworkInspectorPanel({
  controller,
  definition
}: {
  controller: PasswordLabController;
  definition: MethodPanelDefinition;
}) {
  return (
    <PanelShell definition={definition} index={3} wide>
      {controller.networkEvents.length ? (
        <div className="request-list">
          {controller.networkEvents.map((event) => {
            const meta = event.safeMetadata;
            return (
              <article className="request-card" key={event.id}>
                <div className="request-summary">
                  <span className="request-method">{meta.method ?? "EVENT"}</span>
                  <span className="request-path">{meta.endpoint}</span>
                  <span className="request-duration">
                    {meta.durationMs === undefined ? "—" : `${meta.durationMs}ms`}
                  </span>
                  <span className={`request-status ${event.outcome}`}>
                    {meta.statusCode ?? event.outcome}
                  </span>
                </div>
                <div className="request-details">
                  {meta.fields?.map((field) => (
                    <span className="detail-chip" key={field}>
                      field:{field}
                    </span>
                  ))}
                  {meta.email ? (
                    <span className="detail-chip">email:{meta.email}</span>
                  ) : null}
                  {meta.cookieFlags ? (
                    <>
                      <span className="detail-chip">
                        httpOnly:{String(meta.cookieFlags.httpOnly)}
                      </span>
                      <span className="detail-chip">
                        secure:{String(meta.cookieFlags.secure)}
                      </span>
                      <span className="detail-chip">
                        sameSite:{meta.cookieFlags.sameSite}
                      </span>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          Raw requests are never retained. Safe projections appear here.
        </div>
      )}
    </PanelShell>
  );
}
