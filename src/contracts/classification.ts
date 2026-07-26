export type RecommendationClassification =
  | "historical"
  | "transitional"
  | "recommended"
  | "high-assurance"
  | "emerging";

export type MethodStatus = "interactive" | "simulation" | "coming-later";

export type LearningTrack =
  | "Human authentication & MFA"
  | "Federation & delegated authorization"
  | "Sessions & tokens"
  | "Special environments"
  | "Machine & workload identity";

export type MethodCategory =
  | "Authentication"
  | "Passwordless"
  | "MFA"
  | "Federation"
  | "Sessions"
  | "Special environments"
  | "Machine authentication";

export type SecurityRating =
  | "low"
  | "medium"
  | "high"
  | "depends"
  | "not-applicable";

export type TierGrade = "S" | "A" | "B" | "C" | "D";
