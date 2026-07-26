export * from "@/db/schema/auth";
export * from "@/db/schema/recorder";

import {
  account,
  session,
  twoFactor,
  user,
  verification
} from "@/db/schema/auth";
import {
  authenticationEvent,
  authenticationFlow
} from "@/db/schema/recorder";

export const schema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  authenticationFlow,
  authenticationEvent
};

export type {
  EventActor,
  EventOutcome,
  FlowStatus,
  SafeEventMetadata
} from "@/contracts";
