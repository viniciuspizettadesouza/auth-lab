import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import { schema } from "@/db/schema";
import { authRecorderPlugin } from "@/lib/auth-recorder-plugin";
import { sendAuthEmail } from "@/lib/email";
import {
  appendOwnedEvent,
  attachFlowToUser,
  setFlowStatus
} from "@/lib/recorder";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

function requestContext(request?: Request | null) {
  const flowId = request?.headers.get("x-auth-flow-id") ?? null;
  const visitorId = request
    ? getVisitorIdFromHeaders(request.headers)
    : null;
  return { flowId, visitorId };
}

export const auth = betterAuth({
  appName: "Auth Lab",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-auth-lab-secret-change-me",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
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
          await attachFlowToUser(flowId, createdSession.userId);
          await appendOwnedEvent(flowId, visitorId, {
            actor: "database",
            action: "session.created",
            description:
              "The database stored a revocable session and the browser received an opaque cookie.",
            outcome: "success",
            metadata: {
              entityId: createdSession.id,
              cookieFlags: {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax"
              }
            }
          });
          await setFlowStatus(flowId, "completed");
        }
      }
    }
  },
  plugins: [authRecorderPlugin(), nextCookies()]
});

export type Session = typeof auth.$Infer.Session;
