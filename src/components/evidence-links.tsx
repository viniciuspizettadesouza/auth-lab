import { ExternalLink } from "lucide-react";

import type { EvidenceReference } from "@/contracts";
import { evidenceStatusLabels } from "@/lib/evidence";

export function EvidenceLinks({
  className = "method-evidence",
  evidence,
  reviewedAt
}: {
  className?: string;
  evidence: readonly EvidenceReference[];
  reviewedAt: string;
}) {
  return (
    <div className={className}>
      <span className="evidence-review-date">Evidence reviewed {reviewedAt}</span>
      {evidence.map((item) => (
        <a
          data-evidence-status={item.status}
          href={item.url}
          key={`${item.id}:${item.section ?? "document"}`}
          rel="noreferrer"
          target="_blank"
          title={`Supports: ${item.supports.join(", ")}`}
        >
          <span className="evidence-citation">
            {item.title}
            {item.section ? ` · ${item.section}` : ""}
          </span>
          <span className="evidence-source-meta">
            {item.publisher}
            {item.edition ? ` · ${item.edition}` : ""} ·{" "}
            {evidenceStatusLabels[item.status]}
          </span>
          <ExternalLink aria-hidden="true" size={11} />
        </a>
      ))}
    </div>
  );
}
