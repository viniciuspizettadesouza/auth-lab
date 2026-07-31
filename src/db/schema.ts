export * from "@/db/schema/auth";
export * from "@/db/schema/recorder";

import {
  account,
  dpopAccessGrant,
  dpopProofReplay,
  oidcAuthorizationCode,
  passkey,
  passkeyKind,
  session,
  sessionAssurance,
  twoFactor,
  user,
  verification,
  webauthnChallenge
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
  account,
  oidcAuthorizationCode,
  passkey,
  passkeyKind,
  verification,
  twoFactor,
  webauthnChallenge,
  authenticationFlow,
  authenticationEvent
};

export type {
  EventActor,
  EventOutcome,
  FlowStatus,
  SafeEventMetadata
} from "@/contracts";
