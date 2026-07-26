import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { AuthenticationMethod } from "@/contracts";
import { classificationDetails } from "@/lib/catalog";

export function MethodPage({
  children,
  method
}: {
  children: ReactNode;
  method: AuthenticationMethod;
}) {
  return (
    <>
      <section className="page-intro">
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">methods</Link><span>/</span><span>{method.slug}</span>
          </nav>
          <p className="eyebrow">
            {method.status === "simulation" ? "Local simulation" : "Interactive"} ·{" "}
            {classificationDetails[method.classification].label}
          </p>
          <h1 className="page-title">{method.name} <span>under the glass.</span></h1>
          <div className="page-meta">
            <span className="meta-chip">{method.protocol}</span>
            <span className="meta-chip">{method.track}</span>
            <span className="meta-chip">{method.classification}</span>
          </div>
        </div>
      </section>
      <section className="method-evolution shell" aria-labelledby={`${method.slug}-evolution`}>
        <div className="method-evolution-heading">
          <p className="eyebrow">Then / Now / Next</p>
          <h2 id={`${method.slug}-evolution`}>{method.summary}</h2>
        </div>
        <dl>
          <div><dt>Then</dt><dd>{method.evolution.then}</dd></div>
          <div><dt>Now</dt><dd>{method.evolution.now}</dd></div>
          <div><dt>Next</dt><dd>{method.evolution.next}</dd></div>
        </dl>
        <div className="method-evidence">
          <span>Evidence reviewed {method.evidenceDate}</span>
          {method.evidence.map((item) => (
            <a href={item.url} key={item.url} rel="noreferrer" target="_blank">
              {item.label} <ExternalLink aria-hidden="true" size={12} />
            </a>
          ))}
        </div>
      </section>
      <div className="shell">{children}</div>
    </>
  );
}
