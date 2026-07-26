import type { Metadata } from "next";
import { Suspense } from "react";

import { totpAdapter } from "@/features/link-code/adapters";
import { MethodPage } from "@/features/link-code/components/method-page";
import { TotpLab } from "@/features/link-code/components/totp-lab";

export const metadata: Metadata = { title: "Authenticator app TOTP" };

export default function TotpPage() {
  return (
    <MethodPage method={totpAdapter.metadata}>
      <Suspense fallback={<div className="empty-state">Loading laboratory…</div>}>
        <TotpLab />
      </Suspense>
    </MethodPage>
  );
}
