import type { Metadata } from "next";

import { DefensiveSimulatorLab } from "@/features/defensive-simulator/components/defensive-simulator-lab";
import { defensiveSimulatorAdapter } from "@/features/defensive-simulator/adapter";
import { MethodPage } from "@/features/link-code/components/method-page";

export const metadata: Metadata = { title: "Defensive attack simulator" };

export default function DefensiveSimulatorPage() {
  return <MethodPage method={defensiveSimulatorAdapter.metadata}><DefensiveSimulatorLab /></MethodPage>;
}
