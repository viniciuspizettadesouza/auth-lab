import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Auth Lab — Authentication, observed",
    template: "%s · Auth Lab"
  },
  description:
    "An interactive authentication laboratory that exposes the safe mechanics behind every flow."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell header-inner">
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                <FlaskConical size={18} strokeWidth={2.5} />
              </span>
              <span>Auth Lab</span>
              <span className="brand-slash">/ explorer</span>
            </Link>
            <nav className="header-nav" aria-label="Primary navigation">
              <Link href="/#catalog">Methods</Link>
              <Link href="/#comparison">Compare</Link>
              <Link href="/methods/password">Password lab</Link>
              <span className="environment-pill">Local sandbox</span>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="shell">
            Auth Lab is an educational local environment. Ratings are contextual,
            not universal security guarantees.
          </div>
        </footer>
      </body>
    </html>
  );
}
