import { passwordAuthEndpointDescriptions } from "@/features/password/adapter";
import { milestone3AuthEndpointDescriptions } from "@/features/link-code/adapters";
import { createAuthRecorderPlugin } from "@/services/recorder/auth-plugin";

export function authRecorderPlugin() {
  return createAuthRecorderPlugin({
    ...passwordAuthEndpointDescriptions,
    ...milestone3AuthEndpointDescriptions
  });
}
