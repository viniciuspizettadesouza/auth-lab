import {
  authenticationMethods,
  consumerWebTierList
} from "@/lib/catalog";

export function TierList() {
  return (
    <div className="tier-board">
      <div className="tier-context">
        <div className="tier-context-profile">
          <span className="tier-context-label">
            <span aria-hidden="true" />
            ranking.profile
          </span>
          <strong>New consumer web application</strong>
          <div className="tier-context-tags" aria-label="Ranking context">
            <span>consumer</span>
            <span>web</span>
            <span>2026.07</span>
          </div>
        </div>
        <div className="tier-context-note">
          <span className="tier-context-label">scope.note</span>
          <p>
            Opinionated, not universal. Recovery, enrollment, implementation,
            and threat model can move a method.
          </p>
        </div>
      </div>

      <div className="tier-list" role="table" aria-label="Authentication method tier list">
        {consumerWebTierList.map((tier) => {
          const methods = tier.methodSlugs.flatMap((slug) => {
            const method = authenticationMethods.find(
              (candidate) => candidate.slug === slug
            );
            return method ? [method] : [];
          });

          return (
            <div className="tier-row" role="row" key={tier.grade}>
              <div
                className="tier-grade"
                role="rowheader"
                aria-label={`Tier ${tier.grade}`}
              >
                <span>{tier.grade}</span>
                <small>tier</small>
              </div>
              <div className="tier-content" role="cell">
                <div className="tier-methods">
                  {methods.map((method) => (
                    <span className="tier-method" key={method.slug}>
                      {method.shortName}
                    </span>
                  ))}
                </div>
                <div className="tier-explanation">
                  <strong>{tier.label}</strong>
                  <span>{tier.rationale}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tier-exclusions">
        <span aria-hidden="true">↳</span>
        <p>
          Sessions, tokens, special-device flows, and machine credentials are
          intentionally unranked here. They belong to separate tracks.
        </p>
      </div>
    </div>
  );
}
