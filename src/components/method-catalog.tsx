import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  authenticationMethods,
  methodCategories
} from "@/lib/catalog";

export function MethodCatalog() {
  return (
    <div>
      {methodCategories.map((category) => {
        const methods = authenticationMethods.filter(
          (method) => method.category === category
        );
        return (
          <section className="catalog-section" key={category}>
            <h3 className="catalog-title">{category}</h3>
            <div className="method-grid">
              {methods.map((method) => {
                const content = (
                  <>
                    <div className="method-card-top">
                      <span className="method-protocol">{method.protocol}</span>
                      <span className={`status ${method.status}`}>
                        {method.status === "available" ? "Interactive" : "Coming later"}
                      </span>
                    </div>
                    <h3>{method.name}</h3>
                    <p>{method.summary}</p>
                    {method.slug === "password" ? (
                      <ArrowUpRight
                        aria-hidden="true"
                        size={18}
                        style={{
                          position: "absolute",
                          right: 20,
                          bottom: 20,
                          color: "var(--accent)"
                        }}
                      />
                    ) : null}
                  </>
                );

                return method.slug === "password" ? (
                  <Link
                    className="method-card available"
                    href="/methods/password"
                    key={method.slug}
                  >
                    {content}
                  </Link>
                ) : (
                  <article className="method-card" key={method.slug}>
                    {content}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
