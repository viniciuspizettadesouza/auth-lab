import type { Metadata } from "next";

import { enterpriseSsoAdapter } from "@/features/enterprise/adapter";
import { EnterpriseLab } from "@/features/enterprise/components/enterprise-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = {
  title: "Enterprise and high-assurance authentication"
};

export default function EnterprisePage() {
  return (
    <MethodPage method={enterpriseSsoAdapter.metadata}>
      <EnterpriseLab />
    </MethodPage>
  );
}
