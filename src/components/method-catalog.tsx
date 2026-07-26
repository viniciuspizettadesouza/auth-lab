"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import {
  authenticationMethods,
  classificationDetails,
  classificationOrder,
  learningTracks,
  methodStatusLabels,
  type LearningTrack
} from "@/lib/catalog";

type TrackFilter = "all" | LearningTrack;

export function MethodCatalog() {
  const [track, setTrack] = useState<TrackFilter>("all");
  const visibleMethods =
    track === "all"
      ? authenticationMethods
      : authenticationMethods.filter((method) => method.track === track);

  return (
    <div className="evolution-map">
      <div className="classification-legend" aria-label="Classification legend">
        {classificationOrder.map((classification) => (
          <div className={`legend-item ${classification}`} key={classification}>
            <span aria-hidden="true" />
            <div>
              <strong>{classificationDetails[classification].label}</strong>
              <p>{classificationDetails[classification].description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="track-filter" aria-label="Filter methods by learning track">
        <span className="track-filter-label">Learning track</span>
        <button
          aria-pressed={track === "all"}
          className={track === "all" ? "active" : ""}
          onClick={() => setTrack("all")}
          type="button"
        >
          All tracks
        </button>
        {learningTracks.map((item) => (
          <button
            aria-pressed={track === item.name}
            className={track === item.name ? "active" : ""}
            key={item.name}
            onClick={() => setTrack(item.name)}
            title={item.context}
            type="button"
          >
            {item.shortName}
          </button>
        ))}
      </div>

      <div className="evolution-path" aria-label="Authentication evolution">
        {classificationOrder.map((classification, index) => {
          const methods = visibleMethods.filter(
            (method) => method.classification === classification
          );

          return (
            <section
              className={`evolution-stage ${classification}`}
              data-classification={classification}
              key={classification}
            >
              <header className="evolution-stage-header">
                <span className="evolution-step">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{classificationDetails[classification].label}</h3>
                  <p>{classificationDetails[classification].description}</p>
                </div>
                {index < classificationOrder.length - 1 ? (
                  <ArrowRight aria-hidden="true" className="evolution-arrow" />
                ) : null}
              </header>

              {methods.length ? (
                <div className="evolution-methods">
                  {methods.map((method) => {
                    const href =
                      method.slug === "password" ||
                      method.slug === "cookie-session"
                        ? "/methods/password"
                        : null;
                    const content = (
                      <>
                        <div className="method-card-top">
                          <span className="method-protocol">
                            {method.protocol}
                          </span>
                          <span className={`status ${method.status}`}>
                            {methodStatusLabels[method.status]}
                          </span>
                        </div>
                        <h4>{method.name}</h4>
                        <p>{method.summary}</p>
                        <span className="method-track">{method.track}</span>
                        <details className="evolution-narrative">
                          <summary>Then / Now / Next</summary>
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
                          <div className="evidence-links">
                            <span>Evidence · {method.evidenceDate}</span>
                            {method.evidence.map((evidence) => (
                              <a
                                href={evidence.url}
                                key={evidence.url}
                                onClick={(event) => event.stopPropagation()}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {evidence.label}
                                <ExternalLink aria-hidden="true" size={11} />
                              </a>
                            ))}
                          </div>
                        </details>
                      </>
                    );

                    return href ? (
                      <article className="evolution-method" key={method.slug}>
                        {content}
                        <Link
                          className="method-open-link"
                          href={href}
                          aria-label={`Open ${method.name} lab`}
                        >
                          Open lab <ArrowRight aria-hidden="true" size={14} />
                        </Link>
                      </article>
                    ) : (
                      <article
                        className="evolution-method"
                        data-exhibit={
                          method.status === "simulation" ? "non-interactive" : undefined
                        }
                        key={method.slug}
                      >
                        {content}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="evolution-empty">
                  No methods in this classification for the selected track.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
