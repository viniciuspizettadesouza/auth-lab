import { createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";

import { appendOwnedEvent } from "@/services/recorder/service";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

export type AuthEndpointDescriptions = Record<
  string,
  { action: string; description: string; fields: readonly string[] }
>;

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

export function createAuthRecorderPlugin(
  endpointDescriptions: AuthEndpointDescriptions
): BetterAuthPlugin {
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
                fields: [...template.fields]
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
