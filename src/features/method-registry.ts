import {
  passwordClientEventSchema,
  passwordJourneySchema,
  passwordMethodAdapter
} from "@/features/password/adapter";
import { milestone3Adapters } from "@/features/link-code/adapters";
import { passkeyAdapter } from "@/features/passkey/adapter";
import { federationAdapters } from "@/features/federation/adapter";
import { sessionTokenAdapters } from "@/features/session-token/adapter";

export const interactiveMethodAdapters = [
  passwordMethodAdapter,
  ...milestone3Adapters,
  passkeyAdapter,
  ...federationAdapters,
  ...sessionTokenAdapters
] as const;

export const defaultMethod = {
  adapter: passwordMethodAdapter,
  clientEventSchema: passwordClientEventSchema,
  journeySchema: passwordJourneySchema
} as const;

export function getMethodAdapter(slug: string) {
  return interactiveMethodAdapters.find(
    (adapter) => adapter.metadata.slug === slug
  );
}
