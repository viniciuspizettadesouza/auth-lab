"use client";

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import {
  emailOTPClient,
  magicLinkClient,
  twoFactorClient
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : undefined),
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient({ twoFactorPage: "/methods/totp?challenge=1" })
  ]
});
