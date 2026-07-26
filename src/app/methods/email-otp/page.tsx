import type { Metadata } from "next";
import { Suspense } from "react";

import { emailOtpAdapter } from "@/features/link-code/adapters";
import { LinkCodeLab } from "@/features/link-code/components/link-code-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = { title: "Email OTP" };

export default function EmailOtpPage() {
  return (
    <MethodPage method={emailOtpAdapter.metadata}>
      <Suspense fallback={<div className="empty-state">Loading laboratory…</div>}>
        <LinkCodeLab variant="email-otp" />
      </Suspense>
    </MethodPage>
  );
}
