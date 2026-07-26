import type { Metadata } from "next";
import { Suspense } from "react";

import { oidcAdapter } from "@/features/federation/adapter";
import { OidcLab } from "@/features/federation/components/oidc-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = {
  title: "OpenID Connect federation"
};

export default function OidcPage() {
  return (
    <MethodPage method={oidcAdapter.metadata}>
      <Suspense fallback={<div className="empty-state">Loading federation lab…</div>}>
        <OidcLab />
      </Suspense>
    </MethodPage>
  );
}
