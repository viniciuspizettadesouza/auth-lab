import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(12).max(128);

export const signUpInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema
});

export function publicAuthError(code?: string): string {
  if (code === "EMAIL_NOT_VERIFIED") {
    return "Email verification is required. Open Mailpit and follow the verification link.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return "Use at least 12 characters.";
  }
  return "The request could not be completed. Credentials and account existence were not disclosed.";
}
