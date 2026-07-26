import "server-only";

import { betterAuth } from "better-auth";
import { passkey } from "@better-auth/passkey";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { authSchema, passkeyKind, user } from "@/db/schema";
import { authRecorderPlugin } from "@/features/password/server/auth-recorder-plugin";
import {
  EMAIL_OTP_ALLOWED_ATTEMPTS,
  EMAIL_OTP_EXPIRES_IN_SECONDS,
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_REQUESTS_PER_MINUTE,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  MAGIC_LINK_REQUESTS_PER_MINUTE,
  TOTP_ACCOUNT_FAILURE_LIMIT,
  TOTP_DIGITS,
  TOTP_LOCK_SECONDS,
  TOTP_PERIOD_SECONDS
} from "@/features/link-code/config";
import { sendAuthCodeEmail, sendAuthEmail } from "@/lib/email";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordRejectionReason
} from "@/features/password/server/credentials";
import { webauthnRelyingParty } from "@/features/passkey/server/config";
import {
  appendOwnedEvent,
  attachFlowToUser,
  setFlowStatus
} from "@/services/recorder/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

function requestContext(request?: Request | null) {
  const flowId = request?.headers.get("x-auth-flow-id") ?? null;
  const visitorId = request
    ? getVisitorIdFromHeaders(request.headers)
    : null;
  return { flowId, visitorId };
}

const relyingParty = webauthnRelyingParty();

const prospectivePasswordPaths = new Set([
  "/sign-up/email",
  "/reset-password",
  "/change-password",
  "/set-password"
]);

export const auth = betterAuth({
  appName: "Auth Lab",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-auth-lab-secret-change-me",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    usePlural: true
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }, request) {
      const { flowId, visitorId } = requestContext(request);
      if (flowId && visitorId) {
        await appendOwnedEvent(flowId, visitorId, {
          actor: "email",
          action: "reset.email-queued",
          description: "The application queued a single-use password reset link in Mailpit.",
          outcome: "success",
          metadata: { email: user.email, endpoint: "/reset-password" }
        });
      }
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your Auth Lab password",
        heading: "Reset your password",
        message:
          "This link carries a short-lived, single-use proof. Auth Lab never displays it in the recorder.",
        actionLabel: "Open reset form",
        url
      });
    },
    async onPasswordReset({ user }, request) {
      const { flowId, visitorId } = requestContext(request);
      if (!flowId || !visitorId) return;
      await attachFlowToUser(flowId, user.id);
      await appendOwnedEvent(flowId, visitorId, {
        actor: "database",
        action: "password.updated",
        description:
          "The account's password hash was replaced and existing sessions were revoked.",
        outcome: "success",
        metadata: { email: user.email }
      });
      await setFlowStatus(flowId, "completed");
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    async sendVerificationEmail({ user, url }, request) {
      const { flowId, visitorId } = requestContext(request);
      if (flowId && visitorId) {
        await appendOwnedEvent(flowId, visitorId, {
          actor: "email",
          action: "verification.email-queued",
          description: "The application queued a single-use verification link in Mailpit.",
          outcome: "success",
          metadata: { email: user.email, endpoint: "/verify-email" }
        });
      }
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your Auth Lab email",
        heading: "Verify your email",
        message:
          "Confirm ownership of this inbox before Auth Lab will create a session.",
        actionLabel: "Verify email",
        url
      });
    },
    async afterEmailVerification(user, request) {
      if (!request) return;
      const requestUrl = new URL(request.url);
      const callbackURL = requestUrl.searchParams.get("callbackURL");
      let flowId = request.headers.get("x-auth-flow-id");
      if (!flowId && callbackURL) {
        flowId = new URL(callbackURL, requestUrl.origin).searchParams.get("flow");
      }
      const visitorId = getVisitorIdFromHeaders(request.headers);
      if (!flowId || !visitorId) return;
      await attachFlowToUser(flowId, user.id);
      await appendOwnedEvent(flowId, visitorId, {
        actor: "database",
        action: "email.verified",
        description: "The user record now marks the email address as verified.",
        outcome: "success",
        metadata: { email: user.email }
      });
      await setFlowStatus(flowId, "completed");
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 30
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-up/email": {
        window: 60,
        max: 10
      },
      "/sign-in/email": {
        window: 60,
        max: 10
      },
      "/request-password-reset": {
        window: 60,
        max: 5
      }
    }
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!prospectivePasswordPaths.has(ctx.path)) return;
      const body = ctx.body as
        | { email?: unknown; password?: unknown; newPassword?: unknown }
        | undefined;
      const password =
        typeof body?.password === "string"
          ? body.password
          : typeof body?.newPassword === "string"
            ? body.newPassword
            : null;
      if (!password) return;

      const reason = passwordRejectionReason(password, {
        email: typeof body?.email === "string" ? body.email : undefined
      });
      if (reason === "blocked" || reason === "context-specific") {
        throw APIError.from("BAD_REQUEST", {
          code: "PASSWORD_BLOCKLISTED",
          message:
            "Choose a password that is not commonly used, compromised, or specific to this account."
        });
      }
    })
  },
  advanced: {
    cookiePrefix: "auth-lab",
    useSecureCookies: process.env.NODE_ENV === "production"
  },
  databaseHooks: {
    user: {
      create: {
        async after(createdUser, ctx) {
          const flowId = ctx?.headers?.get("x-auth-flow-id");
          const visitorId = ctx?.headers
            ? getVisitorIdFromHeaders(ctx.headers)
            : null;
          if (!flowId || !visitorId) return;
          await attachFlowToUser(flowId, createdUser.id);
          await appendOwnedEvent(flowId, visitorId, {
            actor: "database",
            action: "user.created",
            description:
              "A user and credential account were stored; the password itself was not retained.",
            outcome: "success",
            metadata: {
              entityId: createdUser.id,
              email: createdUser.email
            }
          });
        }
      }
    },
    session: {
      create: {
        async after(createdSession, ctx) {
          const flowId = ctx?.headers?.get("x-auth-flow-id");
          const visitorId = ctx?.headers
            ? getVisitorIdFromHeaders(ctx.headers)
            : null;
          if (!flowId || !visitorId) return;
          const [owner] = await db
            .select({ twoFactorEnabled: user.twoFactorEnabled })
            .from(user)
            .where(eq(user.id, createdSession.userId))
            .limit(1);
          await attachFlowToUser(flowId, createdSession.userId);
          await appendOwnedEvent(flowId, visitorId, {
            actor: "database",
            action: owner?.twoFactorEnabled
              ? "session.pending-step-up"
              : "session.created",
            description:
              owner?.twoFactorEnabled
                ? "The primary factor matched, but the provisional session remains unusable until TOTP step-up."
                : "The database stored a revocable session and the browser received an opaque cookie.",
            outcome: owner?.twoFactorEnabled ? "pending" : "success",
            metadata: {
              entityId: createdSession.id,
              cookieFlags: {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax"
              }
            }
          });
          if (!owner?.twoFactorEnabled) {
            await setFlowStatus(flowId, "completed");
          }
        }
      }
    }
  },
  plugins: [
    passkey({
      rpName: "Auth Lab",
      rpID: relyingParty.rpID,
      origin: relyingParty.origin,
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required"
      },
      registration: {
        async afterVerification({
          verification,
          clientData,
          context,
          user: registrationUser
        }) {
          if (!verification.registrationInfo?.userVerified) {
            throw APIError.from("BAD_REQUEST", {
              code: "USER_VERIFICATION_REQUIRED",
              message: "Local user verification is required."
            });
          }
          const kind =
            context === "security-key" ? "security-key" : "passkey";
          await db
            .insert(passkeyKind)
            .values({
              credentialID: clientData.id,
              userId: registrationUser.id,
              kind
            })
            .onConflictDoUpdate({
              target: passkeyKind.credentialID,
              set: { userId: registrationUser.id, kind }
            });
        }
      },
      authentication: {
        afterVerification({ verification }) {
          if (!verification.authenticationInfo.userVerified) {
            throw APIError.from("UNAUTHORIZED", {
              code: "USER_VERIFICATION_REQUIRED",
              message: "Local user verification is required."
            });
          }
        }
      }
    }),
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
      storeToken: "hashed",
      rateLimit: { window: 60, max: MAGIC_LINK_REQUESTS_PER_MINUTE },
      async sendMagicLink({ email, url }, ctx) {
        const flowId = ctx?.headers?.get("x-auth-flow-id");
        const visitorId = ctx?.headers
          ? getVisitorIdFromHeaders(ctx.headers)
          : null;
        if (flowId && visitorId) {
          await appendOwnedEvent(flowId, visitorId, {
            actor: "email",
            action: "magic-link.email-queued",
            description:
              "The application queued a five-minute single-use link in Mailpit.",
            outcome: "success",
            metadata: { email, endpoint: "/magic-link/verify" }
          });
        }
        await sendAuthEmail({
          to: email,
          subject: "Sign in to Auth Lab with a magic link",
          heading: "Your single-use sign-in link",
          message:
            "This bearer link expires in five minutes and is consumed by its first verification attempt.",
          actionLabel: "Sign in to Auth Lab",
          url
        });
      }
    }),
    emailOTP({
      expiresIn: EMAIL_OTP_EXPIRES_IN_SECONDS,
      otpLength: EMAIL_OTP_LENGTH,
      allowedAttempts: EMAIL_OTP_ALLOWED_ATTEMPTS,
      storeOTP: "hashed",
      resendStrategy: "rotate",
      rateLimit: { window: 60, max: EMAIL_OTP_REQUESTS_PER_MINUTE },
      async sendVerificationOTP({ email, otp, type }, ctx) {
        const flowId = ctx?.headers?.get("x-auth-flow-id");
        const visitorId = ctx?.headers
          ? getVisitorIdFromHeaders(ctx.headers)
          : null;
        if (flowId && visitorId) {
          await appendOwnedEvent(flowId, visitorId, {
            actor: "email",
            action: "email-otp.queued",
            description:
              "The application queued a six-digit, five-minute email code in Mailpit.",
            outcome: "success",
            metadata: { email, endpoint: "/sign-in/email-otp" }
          });
        }
        await sendAuthCodeEmail({
          to: email,
          subject:
            type === "sign-in"
              ? "Your Auth Lab email sign-in code"
              : "Your Auth Lab verification code",
          heading: "Your email code",
          message:
            "This manually entered code expires in five minutes, rotates when resent, and remains phishable.",
          code: otp
        });
      }
    }),
    twoFactor({
      issuer: "Auth Lab",
      totpOptions: { digits: TOTP_DIGITS, period: TOTP_PERIOD_SECONDS },
      backupCodeOptions: {
        amount: 8,
        length: 10,
        storeBackupCodes: "encrypted"
      },
      accountLockout: {
        enabled: true,
        maxFailedAttempts: TOTP_ACCOUNT_FAILURE_LIMIT,
        durationSeconds: TOTP_LOCK_SECONDS
      }
    }),
    authRecorderPlugin(),
    nextCookies()
  ]
});

export type Session = typeof auth.$Infer.Session;
