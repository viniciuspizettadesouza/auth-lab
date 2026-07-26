import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { EvidenceLinks } from "@/components/evidence-links";
import { PasswordLab } from "@/components/password-lab";
import { authenticationMethods, classificationDetails } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Email and password"
};

export default function PasswordMethodPage() {
  const method = authenticationMethods.find((item) => item.slug === "password");
  if (!method) return null;

  return (
    <>
      <section className="page-intro">
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">methods</Link>
            <span>/</span>
            <span>password</span>
          </nav>
          <p className="eyebrow">
            Interactive · {classificationDetails[method.classification].label}
          </p>
          <h1 className="page-title">
            Email + password <span>under the glass.</span>
          </h1>
          <div className="page-meta">
            <span className="meta-chip">shared secret</span>
            <span className="meta-chip">scrypt hash</span>
            <span className="meta-chip">verified email</span>
            <span className="meta-chip">database session</span>
            <span className="meta-chip">HttpOnly cookie</span>
            <span className="meta-chip">15–128 characters</span>
            <span className="meta-chip">blocklist</span>
            <span className="meta-chip">rate limited</span>
          </div>
        </div>
      </section>
      <section className="method-evolution shell" aria-labelledby="password-evolution">
        <div className="method-evolution-heading">
          <p className="eyebrow">Then / Now / Next</p>
          <h2 id="password-evolution">A compatible baseline, not the destination.</h2>
        </div>
        <dl>
          <div>
            <dt>Then</dt>
            <dd>{method.evolution.then}</dd>
          </div>
          <div>
            <dt>Now</dt>
            <dd>{method.evolution.now}</dd>
          </div>
          <div>
            <dt>Next</dt>
            <dd>{method.evolution.next}</dd>
          </div>
        </dl>
        <EvidenceLinks
          evidence={method.evidence}
          reviewedAt={method.evidenceDate}
        />
      </section>
      <div className="shell">
        <Suspense fallback={<div className="empty-state">Loading laboratory…</div>}>
          <PasswordLab />
        </Suspense>
      </div>
    </>
  );
}
