export const DEVICE_CLIENT_ID = "auth-lab-constrained-client";
export const DEVICE_SCOPE = "device.read";
export const DEVICE_CODE_TTL_SECONDS = 5 * 60;
export const DEVICE_POLL_INTERVAL_SECONDS = 3;
export const DEVICE_ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

export function deviceFlowConfig() {
  const origin =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return {
    clientId: DEVICE_CLIENT_ID,
    scope: DEVICE_SCOPE,
    verificationUri: `${origin}/methods/device`
  };
}
