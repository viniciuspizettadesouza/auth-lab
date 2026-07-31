import type { Metadata } from "next";
import { Suspense } from "react";

import { deviceFlowAdapter } from "@/features/device-flow/adapter";
import { DeviceFlowLab } from "@/features/device-flow/components/device-flow-lab";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = {
  title: "OAuth Device Authorization Grant"
};

export default function DeviceFlowPage() {
  return (
    <MethodPage method={deviceFlowAdapter.metadata}>
      <Suspense fallback={<div className="empty-state">Loading device flow…</div>}>
        <DeviceFlowLab />
      </Suspense>
    </MethodPage>
  );
}
