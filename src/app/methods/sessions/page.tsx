import type { Metadata } from "next";

import { MethodPage } from "@/features/link-code/components/method-page";
import { cookieSessionAdapter } from "@/features/session-token/adapter";
import { SessionTokenLab } from "@/features/session-token/components/session-token-lab";

export const metadata: Metadata = {
  title: "Sessions, tokens, and step-up"
};

export default function SessionsPage() {
  return (
    <MethodPage method={cookieSessionAdapter.metadata}>
      <SessionTokenLab />
    </MethodPage>
  );
}
