import { createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";

import { appendOwnedEvent } from "@/lib/recorder";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

const endpointDescriptions: Record<
  string,
  { action: string; description: string; fields: string[] }
> = {
  "/sign-up/email": {
    action: "signup.requested",
    description: "The browser submitted registration fields to the application.",
    fields: ["name", "email", "password", "callbackURL"]
  },
  "/sign-in/email": {
    action: "signin.requested",
    description: "The browser submitted an email and password for verification.",
    fields: ["email", "password", "rememberMe"]
  },
  "/sign-out": {
    action: "signout.requested",
    description: "The browser requested termination of the current session.",
    fields: []
  },
  "/request-password-reset": {
    action: "reset.requested",
    description: "The browser requested a password reset email.",
    fields: ["email"]
  },
  "/reset-password": {
    action: "reset.submitted",
    description: "The browser submitted a replacement password with a reset proof.",
    fields: ["newPassword"]
  },
  "/verify-email": {
    action: "email.verify",
    description: "The application received a single-use email verification proof.",
    fields: []
  },
  "/list-sessions": {
    action: "sessions.listed",
    description: "The application loaded the user's active database sessions.",
    fields: []
  },
  "/revoke-session": {
    action: "session.revoked",
    description: "The user revoked one selected database session.",
    fields: []
  },
  "/revoke-other-sessions": {
    action: "sessions.others-revoked",
    description: "The user revoked every session except the current one.",
    fields: []
  }
};

function nestedFlowId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, "http://localhost");
    return url.searchParams.get("flow");
  } catch {
    return null;
  }
}

function getFlowId(ctx: {
  headers?: Headers;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}) {
  return (
    ctx.headers?.get("x-auth-flow-id") ??
    (typeof ctx.query?.flow === "string" ? ctx.query.flow : null) ??
    nestedFlowId(ctx.query?.callbackURL) ??
    nestedFlowId(ctx.body?.callbackURL) ??
    nestedFlowId(ctx.body?.redirectTo)
  );
}

export function authRecorderPlugin(): BetterAuthPlugin {
  return {
    id: "auth-lab-recorder",
    hooks: {
      before: [
        {
          matcher: (ctx) => Boolean(ctx.path && endpointDescriptions[ctx.path]),
          handler: createAuthMiddleware(async (ctx) => {
            const template = endpointDescriptions[ctx.path];
            const flowId = getFlowId(ctx);
            const visitorId = ctx.headers
              ? getVisitorIdFromHeaders(ctx.headers)
              : null;
            if (!template || !flowId || !visitorId) return;

            await appendOwnedEvent(flowId, visitorId, {
              actor: "browser",
              action: template.action,
              description: template.description,
              outcome: "pending",
              metadata: {
                endpoint: `/api/auth${ctx.path}`,
                method: ctx.method ?? "POST",
                fields: template.fields
              }
            });
          })
        }
      ],
      after: [
        {
          matcher: (ctx) => Boolean(ctx.path && endpointDescriptions[ctx.path]),
          handler: createAuthMiddleware(async (ctx) => {
            const template = endpointDescriptions[ctx.path];
            const flowId = getFlowId(ctx);
            const visitorId = ctx.headers
              ? getVisitorIdFromHeaders(ctx.headers)
              : null;
            if (!template || !flowId || !visitorId) return;

            await appendOwnedEvent(flowId, visitorId, {
              actor: "application",
              action: `${template.action}.accepted`,
              description:
                "The authentication endpoint completed without exposing secret material.",
              outcome: "success",
              metadata: {
                endpoint: `/api/auth${ctx.path}`,
                method: ctx.method ?? "POST",
                statusCode: 200
              }
            });
          })
        }
      ]
    }
  };
}
