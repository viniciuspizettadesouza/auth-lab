import type {
  EvidenceClaim,
  EvidencePublisher,
  EvidenceReference,
  EvidenceStatus
} from "@/contracts";

type EvidenceSource = {
  publisher: EvidencePublisher;
  title: string;
  edition?: string;
  status: EvidenceStatus;
  url: string;
  reviewedAt: string;
};

const reviewedAt = "2026-07-26";

export const evidenceSources = {
  "fido-ctap-2.3": {
    publisher: "FIDO Alliance",
    title: "CTAP 2.3",
    edition: "26 February 2026",
    status: "proposed-standard",
    url: "https://fidoalliance.org/specs/fido-v2.3-ps-20260226/fido-client-to-authenticator-protocol-v2.3-ps-20260226.html",
    reviewedAt
  },
  "nist-sp-800-63b-4": {
    publisher: "NIST",
    title: "SP 800-63B-4",
    edition: "Revision 4",
    status: "standard",
    url: "https://pages.nist.gov/800-63-4/sp800-63b.html",
    reviewedAt
  },
  "nist-sp-800-204a": {
    publisher: "NIST",
    title: "SP 800-204A",
    status: "standard",
    url: "https://csrc.nist.gov/pubs/sp/800/204/a/final",
    reviewedAt
  },
  "oasis-saml-2.0": {
    publisher: "OASIS",
    title: "SAML 2.0",
    status: "standard",
    url: "https://docs.oasis-open.org/security/saml/v2.0/",
    reviewedAt
  },
  "oidf-oidc-core-1.0": {
    publisher: "OpenID Foundation",
    title: "OpenID Connect Core 1.0",
    edition: "Errata Set 2",
    status: "final",
    url: "https://openid.net/specs/openid-connect-core-1_0.html",
    reviewedAt
  },
  "oidf-openid4vp-1.0": {
    publisher: "OpenID Foundation",
    title: "OpenID4VP 1.0",
    status: "final",
    url: "https://openid.net/specs/openid-4-verifiable-presentations-1_0.html",
    reviewedAt
  },
  "oidf-fapi-2.0-security-profile": {
    publisher: "OpenID Foundation",
    title: "FAPI 2.0 Security Profile",
    edition: "Final, February 2025",
    status: "final",
    url: "https://openid.net/specs/fapi-security-profile-2_0-final.html",
    reviewedAt: "2026-07-31"
  },
  "owasp-forgot-password": {
    publisher: "OWASP",
    title: "Forgot Password Cheat Sheet",
    status: "guidance",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html",
    reviewedAt
  },
  "rfc-6238": {
    publisher: "IETF",
    title: "RFC 6238",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc6238",
    reviewedAt
  },
  "rfc-6749": {
    publisher: "IETF",
    title: "RFC 6749",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc6749",
    reviewedAt
  },
  "rfc-7519": {
    publisher: "IETF",
    title: "RFC 7519",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc7519",
    reviewedAt
  },
  "rfc-7523": {
    publisher: "IETF",
    title: "RFC 7523",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc7523",
    reviewedAt: "2026-07-31"
  },
  "rfc-7636": {
    publisher: "IETF",
    title: "RFC 7636",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc7636",
    reviewedAt
  },
  "rfc-8628": {
    publisher: "IETF",
    title: "RFC 8628",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc8628",
    reviewedAt
  },
  "rfc-8693": {
    publisher: "IETF",
    title: "RFC 8693",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc8693",
    reviewedAt: "2026-07-31"
  },
  "rfc-8705": {
    publisher: "IETF",
    title: "RFC 8705",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc8705",
    reviewedAt
  },
  "rfc-8725": {
    publisher: "IETF",
    title: "RFC 8725",
    status: "best-current-practice",
    url: "https://www.rfc-editor.org/rfc/rfc8725",
    reviewedAt
  },
  "rfc-9449": {
    publisher: "IETF",
    title: "RFC 9449",
    status: "standard",
    url: "https://www.rfc-editor.org/rfc/rfc9449",
    reviewedAt
  },
  "rfc-9700": {
    publisher: "IETF",
    title: "RFC 9700",
    status: "best-current-practice",
    url: "https://www.rfc-editor.org/rfc/rfc9700",
    reviewedAt
  },
  "spiffe-svid": {
    publisher: "SPIFFE",
    title: "SPIFFE Verifiable Identity Document",
    status: "standard",
    url: "https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE-ID.md",
    reviewedAt: "2026-07-31"
  },
  "w3c-webauthn-2": {
    publisher: "W3C",
    title: "WebAuthn Level 2",
    edition: "8 April 2021",
    status: "recommendation",
    url: "https://www.w3.org/TR/webauthn-2/",
    reviewedAt
  },
  "w3c-webauthn-3": {
    publisher: "W3C",
    title: "WebAuthn Level 3",
    edition: "26 May 2026",
    status: "candidate-recommendation",
    url: "https://www.w3.org/TR/webauthn-3/",
    reviewedAt
  }
} as const satisfies Record<string, EvidenceSource>;

export type EvidenceSourceId = keyof typeof evidenceSources;

export function citeEvidence(
  id: EvidenceSourceId,
  citation: {
    section?: string;
    supports: readonly EvidenceClaim[];
    url?: string;
  }
): EvidenceReference {
  return {
    id,
    ...evidenceSources[id],
    ...citation
  };
}

export const evidenceStatusLabels = {
  "best-current-practice": "Best Current Practice",
  "candidate-recommendation": "Candidate Recommendation",
  "control-framework": "Control Framework",
  final: "Final",
  guidance: "Guidance",
  "internet-draft": "Internet-Draft",
  "proposed-standard": "Proposed Standard",
  recommendation: "Recommendation",
  standard: "Standard",
  "weakness-catalog": "Weakness Catalog"
} as const satisfies Record<EvidenceStatus, string>;
