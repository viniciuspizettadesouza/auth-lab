import { Suspense } from "react";
import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password"
};

export default function ResetPasswordPage() {
  return (
    <section className="reset-page">
      <Suspense fallback={<div className="reset-card">Loading reset proof…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </section>
  );
}
