export * from "@/db/schema/auth";
export * from "@/db/schema/recorder";

import {
  account,
  dpopAccessGrant,
  dpopProofReplay,
  clientAssertionReplay,
  deviceAccessGrant,
  enterpriseMembership,
  enterpriseTenant,
  highAssuranceAccessGrant,
  highAssuranceClient,
  oauthDeviceAuthorization,
  oidcAuthorizationCode,
  passkey,
  passkeyKind,
  portableCredential,
  portablePresentationReplay,
  portablePresentationRequest,
  session,
  sessionAssurance,
  twoFactor,
  user,
  verification,
  webauthnChallenge,
  workloadAccessGrant,
  workloadApiKey,
  workloadAssertionReplay,
  workloadAuditEvent,
  workloadClientSecret,
  workloadProofReplay,
  workloadPrincipal
} from "@/db/schema/auth";
import {
  authenticationEvent,
  authenticationFlow
} from "@/db/schema/recorder";

export const schema = {
  user,
  session,
  sessionAssurance,
  dpopAccessGrant,
  dpopProofReplay,
  enterpriseTenant,
  enterpriseMembership,
  highAssuranceClient,
  clientAssertionReplay,
  highAssuranceAccessGrant,
  oauthDeviceAuthorization,
  deviceAccessGrant,
  account,
  oidcAuthorizationCode,
  passkey,
  passkeyKind,
  verification,
  twoFactor,
  webauthnChallenge,
  authenticationFlow,
  authenticationEvent,
  workloadPrincipal,
  workloadApiKey,
  workloadAuditEvent,
  workloadClientSecret,
  workloadAccessGrant,
  workloadAssertionReplay,
  workloadProofReplay,
  portableCredential,
  portablePresentationRequest,
  portablePresentationReplay
};

export type {
  EventActor,
  EventOutcome,
  FlowStatus,
  SafeEventMetadata
} from "@/contracts";
