import type { Metadata } from "next";
import { Suspense } from "react";

import { magicLinkAdapter } from "@/features/link-code/adapters";
import { LinkCodeLab } from "@/features/link-code/components/link-code-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = { title: "Magic link" };

export default function MagicLinkPage() {
  return (
    <MethodPage method={magicLinkAdapter.metadata}>
      <Suspense fallback={<div className="empty-state">Loading laboratory…</div>}>
        <LinkCodeLab variant="magic-link" />
      </Suspense>
    </MethodPage>
  );
}
