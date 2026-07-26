export type EvidencePublisher =
  | "CIS"
  | "CISA"
  | "FIDO Alliance"
  | "IETF"
  | "MITRE"
  | "NCSC"
  | "NIST"
  | "OASIS"
  | "OpenID Foundation"
  | "OWASP"
  | "SPIFFE"
  | "W3C";

export type EvidenceStatus =
  | "best-current-practice"
  | "candidate-recommendation"
  | "control-framework"
  | "final"
  | "guidance"
  | "internet-draft"
  | "proposed-standard"
  | "recommendation"
  | "standard"
  | "weakness-catalog";

export type EvidenceClaim =
  | "assessment-context"
  | "authenticator-requirements"
  | "federation-security"
  | "implementation-guidance"
  | "out-of-band-limitations"
  | "password-policy"
  | "phishing-resistance"
  | "protocol-definition"
  | "recovery"
  | "replay-resistance"
  | "session-management"
  | "threat-model"
  | "token-security"
  | "workload-identity";

export type EvidenceReference = {
  id: string;
  publisher: EvidencePublisher;
  title: string;
  edition?: string;
  status: EvidenceStatus;
  section?: string;
  url: string;
  supports: readonly EvidenceClaim[];
  reviewedAt: string;
};

export type EvolutionNarrative = {
  then: string;
  now: string;
  next: string;
};
