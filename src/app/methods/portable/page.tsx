import type { Metadata } from "next";

import { MethodPage } from "@/features/link-code/components/method-page";
import { verifiablePresentationAdapter } from "@/features/portable/adapter";
import { PortableLab } from "@/features/portable/components/portable-lab";

export const metadata: Metadata = { title: "Portable and future identity" };

export default function PortablePage() {
  return <MethodPage method={verifiablePresentationAdapter.metadata}><PortableLab /></MethodPage>;
}
