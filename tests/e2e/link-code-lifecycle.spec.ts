import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const mailpitUrl = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

async function latestMessage(
  request: APIRequestContext,
  subject: string,
  recipient: string
) {
  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`${mailpitUrl}/api/v1/messages`);
      if (!response.ok()) return null;
      const data = await response.json();
      messageId = data.messages?.find(
        (message: {
          Subject: string;
          To: Array<{ Address: string }>;
        }) =>
          message.Subject.includes(subject) &&
          message.To.some(({ Address }) => Address === recipient)
      )?.ID;
      return messageId ?? null;
    }, { timeout: 15_000 })
    .toBeTruthy();
  return (
    await request.get(`${mailpitUrl}/api/v1/message/${messageId}`)
  ).json();
}

function messageUrl(message: { Text?: string; HTML?: string }) {
  const match = String(message.Text ?? message.HTML).match(/https?:\/\/[^\s"<]+/);
  if (!match) throw new Error("No URL in message.");
  return match[0].replace(/&amp;/g, "&");
}

function messageCode(message: { Text?: string; HTML?: string }) {
  const match = String(message.Text ?? message.HTML).match(/\b\d{6}\b/);
  if (!match) throw new Error("No six-digit code in message.");
  return match[0];
}

async function registerAndSignIn(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string
) {
  await page.goto("/methods/password");
  await page.getByLabel("NAME").fill("Milestone Three");
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto(
    messageUrl(
      await latestMessage(request, "Verify your Auth Lab email", email)
    )
  );
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("magic link is single-use and creates a session", async ({
  browser,
  page,
  request
}) => {
  const email = `magic-${Date.now()}@example.com`;
  await page.goto("/methods/magic-link");
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByText(/single-use link is now in Mailpit/i)).toBeVisible();

  const url = messageUrl(
    await latestMessage(request, "Sign in to Auth Lab with a magic link", email)
  );
  await page.goto(url);
  await expect(page.getByText(`Session active for ${email}`)).toBeVisible();

  const replayContext = await browser.newContext();
  const replayPage = await replayContext.newPage();
  await replayPage.goto(url);
  await expect(replayPage).toHaveURL(/error=INVALID_TOKEN/);
  await expect(
    replayPage.getByText(`Session active for ${email}`)
  ).toHaveCount(0);
  await replayContext.close();
});

test("email OTP rotates, signs in, and rejects replay", async ({
  page,
  request
}) => {
  const email = `email-otp-${Date.now()}@example.com`;
  await page.goto("/methods/email-otp");
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send email code" }).click();
  const code = messageCode(
    await latestMessage(request, "Auth Lab email sign-in code", email)
  );
  await page.getByLabel("EMAIL CODE").fill(code);
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText(/code consumed; session created/i)).toBeVisible();

  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(
    page.getByText("Invalid, expired, consumed, or rate-limited code.")
  ).toBeVisible();
});

test("SMS simulation demonstrates interception, consumption, and replay", async ({
  page
}) => {
  await page.goto("/methods/sms-otp");
  await page
    .getByLabel("SYNTHETIC DELIVERY SCENARIO")
    .selectOption("intercepted");
  await page
    .getByRole("button", { name: "Run SMS delivery simulation" })
    .click();
  await expect(page.getByText(/simulated interceptor/i)).toBeVisible();
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText(/code consumed/i)).toBeVisible();
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("Simulation result: replayed.")).toBeVisible();
});

test("TOTP supports enrollment, step-up, replay defense, recovery, and removal", async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  const email = `totp-${Date.now()}@example.com`;
  const password = "correct horse battery staple";
  await registerAndSignIn(page, request, email, password);

  await page.goto("/methods/totp");
  await page.getByLabel("CURRENT PASSWORD").fill(password);
  const enableResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/auth/two-factor/enable")
  );
  await page.getByRole("button", { name: "Begin TOTP enrollment" }).click();
  const enableData = await (await enableResponsePromise).json() as {
    totpURI: string;
    backupCodes: string[];
  };
  await expect(page.getByAltText("TOTP enrollment QR code")).toBeVisible();
  const secret = new URL(enableData.totpURI).searchParams.get("secret");
  if (!secret) throw new Error("No TOTP secret in enrollment URI.");
  const generator = createOTP(new TextDecoder().decode(base32.decode(secret)), {
    digits: 6,
    period: 30
  });
  const enrollmentCode = await generator.totp();
  await page.getByLabel("AUTHENTICATOR CODE").fill(enrollmentCode);
  await page.getByRole("button", { name: "Confirm enrollment" }).click();
  await expect(page.getByText(/enrollment confirmed/i)).toBeVisible();

  await page.goto("/methods/password");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page).toHaveURL(/\/methods\/totp\?challenge=1/);

  let signInCode = await generator.totp();
  if (signInCode === enrollmentCode) {
    await expect.poll(async () => generator.totp(), { timeout: 35_000 })
      .not.toBe(enrollmentCode);
    signInCode = await generator.totp();
  }
  await page.getByLabel("AUTHENTICATOR CODE").fill(signInCode);
  await page.getByRole("button", { name: "Complete sign-in" }).click();
  await expect(page.getByText(/pending sign-in is now a session/i)).toBeVisible();

  await page.goto("/methods/password");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page).toHaveURL(/\/methods\/totp\?challenge=1/);
  await page
    .getByLabel("RECOVERY CODE", { exact: true })
    .fill(enableData.backupCodes[0]);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(page.getByText(/recovery code consumed/i)).toBeVisible();

  await page.goto("/methods/password");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page).toHaveURL(/\/methods\/totp\?challenge=1/);
  await page
    .getByLabel("RECOVERY CODE", { exact: true })
    .fill(enableData.backupCodes[0]);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(
    page.getByText("Recovery code invalid or already consumed.")
  ).toBeVisible();
  await page.getByLabel("AUTHENTICATOR CODE").fill(signInCode);
  await page.getByRole("button", { name: "Complete sign-in" }).click();
  await expect(
    page.getByText(
      "This TOTP code was already accepted and was rejected as a replay."
    )
  ).toBeVisible();

  await page.goto("/methods/password");
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page).toHaveURL(/\/methods\/totp\?challenge=1/);
  await expect.poll(async () => generator.totp(), { timeout: 35_000 })
    .not.toBe(signInCode);
  const freshCode = await generator.totp();
  await page.getByLabel("AUTHENTICATOR CODE").fill(freshCode);
  await page.getByRole("button", { name: "Complete sign-in" }).click();
  await expect(page.getByText(/pending sign-in is now a session/i)).toBeVisible();

  await page.goto("/methods/totp");
  await page.getByLabel("CURRENT PASSWORD").fill(password);
  await page.getByRole("button", { name: "Remove TOTP" }).click();
  await expect(
    page.getByText(
      "TOTP, encrypted secret, and remaining recovery codes were removed."
    )
  ).toBeVisible();
});
