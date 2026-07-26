# Evidence and References

Auth Lab uses external standards and security guidance to support specific
educational claims. A reference is not an endorsement of a universal ranking:
classification, ratings, and tier placement remain contextual assessments made
by the project.

## Source roles

| Source | Role |
| --- | --- |
| NIST SP 800-63 | Authenticator requirements, assurance, phishing resistance, recovery, and sessions |
| IETF RFCs and BCPs | Protocol definitions, interoperability, and current protocol security practice |
| W3C and FIDO Alliance | WebAuthn, passkeys, authenticators, and client-to-authenticator protocols |
| OpenID Foundation | OpenID Connect, FAPI, and portable identity specifications |
| OASIS | SAML and enterprise federation standards |
| OWASP | Implementation and verification guidance |
| MITRE CWE | Weakness taxonomy used by future defensive attack simulations |

The typed source registry lives in
[`src/lib/evidence.ts`](../src/lib/evidence.ts). Method-specific citations live
beside method metadata and identify the relevant section and the claims that
the source supports.

## Evidence rules

Every catalog method must:

1. Include at least one external reference.
2. Record the publisher, document title, publication status, URL, review date,
   relevant section where possible, and supported claims.
3. Distinguish final standards and recommendations from candidate
   recommendations, proposed standards, drafts, and implementation guidance.
4. Cite a security BCP or implementation guide in addition to a protocol
   definition when the protocol definition alone does not justify a security
   assessment.
5. Treat recommendation classifications and tier grades as declared Auth Lab
   judgments. A citation may inform that judgment without transferring the
   publisher's authority to the grade.
6. Review time-sensitive evidence when a method or its assessment changes.

Links should point to canonical publisher pages. Published RFCs use RFC Editor
URLs; active Internet-Drafts use IETF Datatracker URLs and must be labelled as
work in progress.

## Stable and evolving specifications

WebAuthn Level 2 is the stable W3C Recommendation used as the normative
passkey baseline. WebAuthn Level 3 is separately identified as a Candidate
Recommendation. CTAP 2.3 is identified as a FIDO Alliance Proposed Standard.
This lets the lab discuss current evolution without presenting unfinished
publication stages as final standards.

OAuth 2.0 examples use the published RFC 6749, PKCE in RFC 7636, and the OAuth
security Best Current Practice in RFC 9700. OAuth 2.1 remains work in progress
and should not replace those published references until its status changes.

## Internal documents

External references are evidence, not design records:

- `docs/references.md` defines the evidence policy.
- `docs/adr/` is appropriate for accepted architectural decisions.
- `docs/rfcs/` is appropriate for substantial internal proposals that still
  need discussion.

An internal RFC must not be presented as an IETF standard.
