import { passwordAuthEndpointDescriptions } from "@/features/password/adapter";
import { createAuthRecorderPlugin } from "@/services/recorder/auth-plugin";

export function authRecorderPlugin() {
  return createAuthRecorderPlugin(passwordAuthEndpointDescriptions);
}
