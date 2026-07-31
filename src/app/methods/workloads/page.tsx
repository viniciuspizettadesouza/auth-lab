import type { Metadata } from "next";

import { MethodPage } from "@/features/link-code/components/method-page";
import { apiKeyAdapter } from "@/features/workload/adapter";
import { WorkloadLab } from "@/features/workload/components/workload-lab";

export const metadata: Metadata = { title: "Machine and workload identity" };

export default function WorkloadsPage() {
  return <MethodPage method={apiKeyAdapter.metadata}><WorkloadLab /></MethodPage>;
}
