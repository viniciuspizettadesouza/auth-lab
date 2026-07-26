import {
  tierGrades,
  tieredMethods,
  tierTracks
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
          <strong>Authentication architecture · five tracks</strong>
          <div className="tier-context-tags" aria-label="Ranking context">
            <span>web</span>
            <span>local lab</span>
            <span>2026.07</span>
          </div>
        </div>
        <div className="tier-context-note">
          <span className="tier-context-label">ranking.rule</span>
          <p>
            Every catalog method is ranked inside the track where it belongs.
            Grades compare alternatives with similar responsibilities.
          </p>
        </div>
      </div>

      <div className="tier-list">
        {tierTracks.map((track) => {
          const trackMethods = tieredMethods.filter(
            (method) => method.tier.track === track.name
          );

          return (
            <section className="tier-track" key={track.name}>
              <header className="tier-track-header">
                <h3>{track.name}</h3>
                <p>{track.context}</p>
              </header>

              <div
                role="table"
                aria-label={`${track.name} authentication method tiers`}
              >
                {tierGrades.map((grade) => {
                  const methods = trackMethods.filter(
                    (method) => method.tier.grade === grade
                  );

                  if (methods.length === 0) {
                    return null;
                  }

                  return (
                    <div
                      className={`tier-row tier-${grade.toLowerCase()}`}
                      role="row"
                      key={grade}
                    >
                      <div
                        className="tier-grade"
                        role="rowheader"
                        aria-label={`Tier ${grade}`}
                      >
                        <span>{grade}</span>
                        <small>tier</small>
                      </div>
                      <div className="tier-assessments" role="cell">
                        {methods.map((method) => (
                          <div className="tier-assessment" key={method.slug}>
                            <span className="tier-method">
                              {method.shortName}
                            </span>
                            <p>{method.tier.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="tier-exclusions">
        <span aria-hidden="true">↳</span>
        <p>
          Grades are relative within each track, not across tracks. For example,
          an A-tier session does not replace an S-tier authenticator; an
          application may need both.
        </p>
      </div>
    </div>
  );
}
