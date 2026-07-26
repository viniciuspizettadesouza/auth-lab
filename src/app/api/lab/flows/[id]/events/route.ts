import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { appendOwnedEvent } from "@/lib/recorder";
import { getVisitorIdFromHeaders } from "@/lib/visitor";

type Context = { params: Promise<{ id: string }> };

const clientEventSchema = z.object({
  operation: z.enum([
    "sign-up",
    "sign-in",
    "sign-out",
    "request-reset",
    "reset-password",
    "list-sessions",
    "revoke-session"
  ]),
  outcome: z.enum(["success", "failure"]),
  statusCode: z.number().int().min(100).max(599),
  durationMs: z.number().int().min(0).max(120_000)
});

const templates = {
  "sign-up": {
    endpoint: "/api/auth/sign-up/email",
    success: "Registration was accepted and verification is now required.",
    failure: "Registration did not complete; the safe error was shown to the user."
  },
  "sign-in": {
    endpoint: "/api/auth/sign-in/email",
    success: "Credentials were verified and a database session was created.",
    failure: "Authentication failed without revealing which credential was wrong."
  },
  "sign-out": {
    endpoint: "/api/auth/sign-out",
    success: "The current session was terminated.",
    failure: "The sign-out request could not be completed."
  },
  "request-reset": {
    endpoint: "/api/auth/request-password-reset",
    success: "A generic reset response was returned regardless of account existence.",
    failure: "The reset request could not be accepted."
  },
  "reset-password": {
    endpoint: "/api/auth/reset-password",
    success: "The password was replaced and previous sessions were revoked.",
    failure: "The reset proof or replacement password was rejected."
  },
  "list-sessions": {
    endpoint: "/api/lab/sessions",
    success: "Active session summaries were returned without their tokens.",
    failure: "Session summaries could not be loaded."
  },
  "revoke-session": {
    endpoint: "/api/lab/sessions/:id",
    success: "The selected server-side session was revoked by ID.",
    failure: "The selected session could not be revoked."
  }
} as const;

export async function POST(request: NextRequest, context: Context) {
  const visitorId = getVisitorIdFromHeaders(request.headers);
  if (!visitorId) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }

  const parsed = clientEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const { id } = await context.params;
  const template = templates[parsed.data.operation];
  const event = await appendOwnedEvent(id, visitorId, {
    actor: "browser",
    action: `${parsed.data.operation}.${parsed.data.outcome}`,
    description: template[parsed.data.outcome],
    outcome: parsed.data.outcome,
    metadata: {
      endpoint: template.endpoint,
      method:
        parsed.data.operation === "list-sessions"
          ? "GET"
          : parsed.data.operation === "revoke-session"
            ? "DELETE"
            : "POST",
      statusCode: parsed.data.statusCode,
      durationMs: parsed.data.durationMs
    }
  });

  if (!event) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }
  return NextResponse.json({ event }, { status: 201 });
}
