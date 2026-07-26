import { Braces, Database, Eye, ShieldCheck } from "lucide-react";

import { ComparisonTable } from "@/components/comparison-table";
import { MethodCatalog } from "@/components/method-catalog";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow">Authentication, observed</p>
            <h1>
              See what happens <span>after sign in.</span>
            </h1>
            <p className="hero-copy">
              Run real authentication flows, follow each actor, and inspect
              sanitized protocol events without turning secrets into teaching
              props.
            </p>
          </div>
          <div className="hero-console" aria-label="Example authentication event">
            <div className="console-top" aria-hidden="true">
              <span className="console-dot" />
              <span className="console-dot" />
              <span className="console-dot" />
            </div>
            <div className="console-body">
              <div><strong>POST</strong> /api/auth/sign-in/email</div>
              <div className="indent">fields → [email, password]</div>
              <div className="indent">password → [never recorded]</div>
              <div><strong>200</strong> session.created</div>
              <div className="indent">httpOnly → true</div>
              <div className="indent">sameSite → lax</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="catalog">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Method catalog</p>
              <h2>One identity. Different proofs.</h2>
            </div>
            <p>
              Authentication, additional factors, federation, and sessions solve
              different problems. The catalog keeps those boundaries explicit.
            </p>
          </div>
          <MethodCatalog />
        </div>
      </section>

      <section className="section" id="comparison">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contextual comparison</p>
              <h2>Trade-offs, not scores.</h2>
            </div>
            <p>
              These ratings are prompts for architectural analysis. Deployment,
              recovery policy, and provider behavior can change every result.
            </p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="method-grid">
            {[
              [Eye, "Visible mechanics", "Every meaningful transition becomes an ordered, replayable event."],
              [ShieldCheck, "Sanitized by design", "Tokens, passwords, hashes, cookies, and authorization headers are rejected."],
              [Database, "Real persistence", "Users, accounts, sessions, flows, and events live in PostgreSQL."],
              [Braces, "Built for developers", "Endpoints, actors, field names, cookie flags, and failure boundaries stay visible."]
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof Eye;
              return (
                <article className="method-card" key={String(title)}>
                  <FeatureIcon size={20} color="var(--accent)" />
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
