"use client";

import { passwordMethodAdapter } from "@/features/password/adapter";
import { ComparisonPanel } from "@/features/password/components/comparison-panel";
import { ExplanationPanel } from "@/features/password/components/explanation-panel";
import { FlowHistory } from "@/features/password/components/flow-history";
import { FlowPanel } from "@/features/password/components/flow-panel";
import { NetworkInspectorPanel } from "@/features/password/components/network-inspector-panel";
import { UserExperiencePanel } from "@/features/password/components/user-experience-panel";
import { usePasswordLabController } from "@/features/password/use-password-lab-controller";

const [userExperience, flow, networkInspector, explanation, comparison] =
  passwordMethodAdapter.panels;

export function PasswordLab() {
  const controller = usePasswordLabController();

  return (
    <div className="lab-layout">
      <div className="lab-main">
        <div className="lab-grid">
          <UserExperiencePanel
            controller={controller}
            definition={userExperience}
          />
          <FlowPanel controller={controller} definition={flow} />
          <NetworkInspectorPanel
            controller={controller}
            definition={networkInspector}
          />
          <ExplanationPanel definition={explanation} />
          <ComparisonPanel definition={comparison} />
        </div>
      </div>
      <FlowHistory controller={controller} />
    </div>
  );
}
