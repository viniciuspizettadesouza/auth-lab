import { z } from "zod";

import type { SafeEventMetadata } from "@/contracts";

const forbiddenKeyPattern =
  /password|secret|token|cookie|authorization|hash|credential|value/i;

const safeMetadataSchema = z
  .object({
    endpoint: z.string().max(160).optional(),
    method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    durationMs: z.number().int().min(0).max(120_000).optional(),
    fields: z
      .array(
        z.enum([
          "name",
          "email",
          "password",
          "newPassword",
          "callbackURL",
          "rememberMe"
        ])
      )
      .max(10)
      .optional(),
    entityId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    email: z.string().max(254).optional(),
    cookieFlags: z
      .object({
        httpOnly: z.boolean(),
        secure: z.boolean(),
        sameSite: z.enum(["lax", "strict", "none"])
      })
      .strict()
      .optional()
  })
  .strict();

export function redactEmail(email: string): string {
  const [localPart = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (!localPart || !domain) return "[redacted email]";

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function sanitizeMetadata(
  input: Record<string, unknown> | undefined
): SafeEventMetadata {
  if (!input) return {};

  for (const key of Object.keys(input)) {
    if (forbiddenKeyPattern.test(key) && key !== "cookieFlags") {
      throw new Error(`Unsafe metadata key rejected: ${key}`);
    }
  }

  const parsed = safeMetadataSchema.parse(input);
  return {
    ...parsed,
    email: parsed.email ? redactEmail(parsed.email) : undefined
  };
}

export function containsSensitiveData(value: unknown): boolean {
  const serialized = JSON.stringify(value).toLowerCase();
  return [
    '"password":',
    '"newpassword":',
    '"token":',
    '"authorization":',
    '"cookie":',
    '"hash":'
  ].some((needle) => serialized.includes(needle));
}
