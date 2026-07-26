import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { PasswordLab } from "@/components/password-lab";

export const metadata: Metadata = {
  title: "Email and password"
};

export default function PasswordMethodPage() {
  return (
    <>
      <section className="page-intro">
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">methods</Link>
            <span>/</span>
            <span>password</span>
          </nav>
          <p className="eyebrow">Interactive method · available</p>
          <h1 className="page-title">
            Email + password <span>under the glass.</span>
          </h1>
          <div className="page-meta">
            <span className="meta-chip">shared secret</span>
            <span className="meta-chip">scrypt hash</span>
            <span className="meta-chip">verified email</span>
            <span className="meta-chip">database session</span>
            <span className="meta-chip">HttpOnly cookie</span>
          </div>
        </div>
      </section>
      <div className="shell">
        <Suspense fallback={<div className="empty-state">Loading laboratory…</div>}>
          <PasswordLab />
        </Suspense>
      </div>
    </>
  );
}
