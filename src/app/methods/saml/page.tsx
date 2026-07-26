import type { Metadata } from "next";

import { samlAdapter } from "@/features/federation/adapter";
import { SamlLab } from "@/features/federation/components/saml-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = {
  title: "SAML enterprise SSO simulation"
};

export default function SamlPage() {
  return (
    <MethodPage method={samlAdapter.metadata}>
      <SamlLab />
    </MethodPage>
  );
}
