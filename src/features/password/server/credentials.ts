import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

// This deliberately small, auditable local blocklist demonstrates the verifier
// boundary without sending a prospective password to a third party. A production
// deployment should maintain a substantially larger, regularly updated corpus.
const blockedPasswords = new Set(
  [
    "123456789012345",
    "adminadminadmin",
    "correcthorsebatterystaple",
    "letmeinletmein",
    "password123456",
    "passwordpassword",
    "qwertyqwertyqwerty",
    "welcome123456789"
  ].map((password) => password.toLocaleLowerCase("en"))
);

function comparablePassword(password: string) {
  return password.normalize("NFC").toLocaleLowerCase("en");
}

export type PasswordRejection =
  | "too-short"
  | "too-long"
  | "blocked"
  | "context-specific";

export function passwordRejectionReason(
  password: string,
  context?: { email?: string }
): PasswordRejection | null {
  const normalized = password.normalize("NFC");
  if ([...normalized].length < MIN_PASSWORD_LENGTH) return "too-short";
  if ([...normalized].length > MAX_PASSWORD_LENGTH) return "too-long";

  const comparable = comparablePassword(normalized);
  if (blockedPasswords.has(comparable)) return "blocked";

  const emailName = context?.email
    ?.split("@", 1)[0]
    ?.normalize("NFC")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]/g, "");
  const compactPassword = comparable.replace(/[^a-z0-9]/g, "");
  if (
    compactPassword.includes("authlab") ||
    (emailName && emailName.length >= 4 && compactPassword === emailName.repeat(2))
  ) {
    return "context-specific";
  }

  return null;
}

export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z
  .string()
  .refine((password) => passwordRejectionReason(password) !== "too-short", {
    message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  })
  .refine((password) => passwordRejectionReason(password) !== "too-long", {
    message: `Use no more than ${MAX_PASSWORD_LENGTH} characters.`
  })
  .refine((password) => passwordRejectionReason(password) !== "blocked", {
    message: "Choose a password that is not commonly used or compromised."
  })
  .refine(
    (password) => passwordRejectionReason(password) !== "context-specific",
    { message: "Choose a password that is not specific to this service." }
  );

export const signUpInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: passwordSchema
  })
  .superRefine(({ email, password }, context) => {
    if (passwordRejectionReason(password, { email }) === "context-specific") {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Choose a password that is not based on the account or service."
      });
    }
  });

export function publicAuthError(code?: string, status?: number): string {
  if (status === 429) {
    return "Too many attempts. Wait for the rate-limit window before trying again.";
  }
  if (code === "EMAIL_NOT_VERIFIED") {
    return "Email verification is required. Open Mailpit and follow the verification link.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (code === "PASSWORD_TOO_LONG") {
    return `Use no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (code === "PASSWORD_BLOCKLISTED") {
    return "Choose a different password. This value is commonly used, compromised, or specific to this account.";
  }
  return "The request could not be completed. Credentials and account existence were not disclosed.";
}
