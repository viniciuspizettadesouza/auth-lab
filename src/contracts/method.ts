import type {
  LearningTrack,
  MethodCategory,
  MethodStatus,
  RecommendationClassification,
  SecurityRating,
  TierGrade
} from "@/contracts/classification";
import type {
  EvidenceReference,
  EvolutionNarrative
} from "@/contracts/evidence";

export type AuthenticationMethod = {
  slug: string;
  name: string;
  shortName: string;
  category: MethodCategory;
  track: LearningTrack;
  classification: RecommendationClassification;
  status: MethodStatus;
  summary: string;
  protocol: string;
  evolution: EvolutionNarrative;
  evidenceDate: string;
  evidence: readonly EvidenceReference[];
  tier: {
    track: LearningTrack;
    grade: TierGrade;
    rationale: string;
  };
  ratings: {
    setup: SecurityRating;
    phishingResistance: SecurityRating;
    replayResistance: SecurityRating;
    recovery: SecurityRating;
  };
};

export type MethodPanelId =
  | "user-experience"
  | "flow"
  | "network-inspector"
  | "explanation"
  | "comparison";

export type MethodPanelDefinition = {
  id: MethodPanelId;
  title: string;
  note: string;
};

export type MethodAdapter<
  TJourney extends string = string,
  TOperation extends string = string
> = {
  metadata: AuthenticationMethod;
  route: string;
  panels: readonly MethodPanelDefinition[];
  recorder: {
    journeys: readonly TJourney[];
    operations: Readonly<
      Record<
        TOperation,
        {
          endpoint: string;
          method: "GET" | "POST" | "DELETE";
          success: string;
          failure: string;
          completesFlow?: boolean;
        }
      >
    >;
  };
};
