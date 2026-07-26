import type { Metadata } from "next";

import { MethodPage } from "@/features/link-code/components/method-page";
import { passkeyAdapter } from "@/features/passkey/adapter";
import { PasskeyLab } from "@/features/passkey/components/passkey-lab";

export const metadata: Metadata = {
  title: "Passkeys and phishing-resistant authentication"
};

export default function PasskeyPage() {
  return (
    <MethodPage method={passkeyAdapter.metadata}>
      <PasskeyLab />
    </MethodPage>
  );
}
