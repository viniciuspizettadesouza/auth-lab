import { expect, test, type APIRequestContext } from "@playwright/test";

const mailpitUrl = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

async function latestMessageUrl(
  request: APIRequestContext,
  subject: string,
  recipient: string
) {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpitUrl}/api/v1/messages`);
        if (!response.ok()) return null;
        const data = await response.json();
        messageId = data.messages?.find(
          (message: {
            Subject: string;
            To: Array<{ Address: string }>;
          }) =>
            message.Subject.includes(subject) &&
            message.To.some((address) => address.Address === recipient)
        )?.ID;
        return messageId ?? null;
      },
      { timeout: 15_000 }
    )
    .toBeTruthy();

  if (!messageId) throw new Error(`No Mailpit message found: ${subject}`);
  const detail = await (
    await request.get(`${mailpitUrl}/api/v1/message/${messageId}`)
  ).json();
  const match = String(detail.Text ?? detail.HTML).match(/https?:\/\/[^\s"<]+/);
  if (!match) throw new Error(`No URL found in Mailpit message: ${subject}`);
  return match[0].replace(/&amp;/g, "&");
}

test("register, verify, sign in, inspect, and sign out", async ({
  page,
  request
}) => {
  const email = `playwright-${Date.now()}@example.com`;
  await page.goto("/methods/password");
  await page.getByLabel("NAME").fill("Playwright User");
  await page.getByLabel("EMAIL").fill(email);
  await page
    .getByLabel("PASSWORD", { exact: true })
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Registration accepted/)).toBeVisible();

  const verificationUrl = await latestMessageUrl(
    request,
    "Verify your Auth Lab email",
    email
  );
  await page.goto(verificationUrl);
  await expect(page.getByText(/Email verified/)).toBeVisible();

  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL").fill(email);
  await page
    .getByLabel("PASSWORD", { exact: true })
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByText(/current/)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Create session" })).toBeVisible();
});

test("recorder responses never expose secret values", async ({ page }) => {
  await page.goto("/methods/password");
  await page.getByLabel("EMAIL").fill(`safe-${Date.now()}@example.com`);
  await page
    .getByLabel("PASSWORD", { exact: true })
    .fill("uniquely-sensitive-password");
  await page.getByRole("button", { name: "Create account" }).click();

  const recorderText = await page.locator(".lab-layout").textContent();
  expect(recorderText).not.toContain("uniquely-sensitive-password");
  expect(recorderText).not.toMatch(/better-auth\.session_token/i);
});

test("evolution map separates historical exhibits from interactive methods", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Historical" })).toBeVisible();
  const historical = page.locator('[data-classification="historical"]');
  await expect(historical.getByText("Security questions")).toBeVisible();
  await expect(historical.locator("input")).toHaveCount(0);
  await expect(
    historical.locator('[data-exhibit="non-interactive"]')
  ).toHaveCount(3);

  await page.getByRole("button", { name: "Federation" }).click();
  const evolutionMap = page.getByLabel("Authentication evolution");
  await expect(
    evolutionMap.getByRole("heading", { name: "OpenID Connect" })
  ).toBeVisible();
  await expect(evolutionMap.getByText("Server-verified PIN")).toHaveCount(0);
});

test("registration rejects a common password with a useful reason", async ({
  page
}) => {
  await page.goto("/methods/password");
  await page.getByLabel("NAME").fill("Blocklist Test");
  await page.getByLabel("EMAIL").fill(`blocked-${Date.now()}@example.com`);
  await page.getByLabel("PASSWORD", { exact: true }).fill("passwordpassword");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/commonly used, compromised/i)).toBeVisible();
});

test("password reset invalidates old credentials and existing sessions", async ({
  browser,
  page,
  request
}) => {
  const email = `reset-${Date.now()}@example.com`;
  const oldPassword = "correct horse battery staple";
  const newPassword = "new correct horse battery staple";

  await page.goto("/methods/password");
  await page.getByLabel("NAME").fill("Reset Test");
  await page.getByLabel("EMAIL").fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(oldPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto(
    await latestMessageUrl(request, "Verify your Auth Lab email", email)
  );
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL").fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(oldPassword);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/methods/password");
  await secondPage.getByRole("tab", { name: "Sign in" }).click();
  await secondPage.getByLabel("EMAIL").fill(email);
  await secondPage
    .getByLabel("PASSWORD", { exact: true })
    .fill(oldPassword);
  await secondPage.getByRole("button", { name: "Create session" }).click();
  await expect(secondPage.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("tab", { name: "Reset" }).click();
  await page.getByLabel("EMAIL").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If the account exists/)).toBeVisible();
  await page.goto(
    await latestMessageUrl(request, "Reset your Auth Lab password", email)
  );
  await page.getByLabel("NEW PASSWORD").fill(newPassword);
  await page
    .getByRole("button", { name: "Reset password and revoke sessions" })
    .click();
  await expect(page).toHaveURL(/\/methods\/password\?flow=/);

  await secondPage.reload();
  await expect(
    secondPage.getByRole("button", { name: "Create account" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL").fill(email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(oldPassword);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(/request could not be completed/i)).toBeVisible();

  await page.getByLabel("PASSWORD", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await secondContext.close();
});
