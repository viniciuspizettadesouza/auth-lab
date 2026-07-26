import type { Metadata } from "next";
import { Suspense } from "react";

import { smsOtpAdapter } from "@/features/link-code/adapters";
import { LinkCodeLab } from "@/features/link-code/components/link-code-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = { title: "SMS OTP simulation" };

export default function SmsOtpPage() {
  return (
    <MethodPage method={smsOtpAdapter.metadata}>
      <Suspense fallback={<div className="empty-state">Loading laboratory…</div>}>
        <LinkCodeLab variant="sms-otp" />
      </Suspense>
    </MethodPage>
  );
}
