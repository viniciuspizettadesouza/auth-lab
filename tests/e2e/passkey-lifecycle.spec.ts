import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const mailpitUrl = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

async function latestVerificationUrl(
  request: APIRequestContext,
  recipient: string
) {
  let messageId: string | undefined;
  await expect.poll(async () => {
    const response = await request.get(`${mailpitUrl}/api/v1/messages`);
    if (!response.ok()) return null;
    const data = await response.json();
    messageId = data.messages?.find(
      (message: { Subject: string; To: Array<{ Address: string }> }) =>
        message.Subject.includes("Verify your Auth Lab email") &&
        message.To.some(({ Address }) => Address === recipient)
    )?.ID;
    return messageId ?? null;
  }, { timeout: 15_000 }).toBeTruthy();
  const message = await (
    await request.get(`${mailpitUrl}/api/v1/message/${messageId}`)
  ).json() as { Text?: string; HTML?: string };
  const match = String(message.Text ?? message.HTML).match(/https?:\/\/[^\s"<]+/);
  if (!match) throw new Error("No verification URL in message.");
  return match[0].replace(/&amp;/g, "&");
}

async function bootstrapAccount(
  page: Page,
  request: APIRequestContext,
  email: string
) {
  await page.goto("/methods/password");
  await page.getByLabel("NAME").fill("Passkey User");
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page
    .getByLabel("PASSWORD", { exact: true })
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto(await latestVerificationUrl(request, email));
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("EMAIL", { exact: true }).fill(email);
  await page
    .getByLabel("PASSWORD", { exact: true })
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("platform passkey signs in and roaming key performs replay-resistant step-up", async ({
  page,
  request
}) => {
  test.skip(
    test.info().project.name !== "chromium",
    "Virtual WebAuthn is covered once on desktop Chromium."
  );
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });

  const email = `passkey-${Date.now()}@example.com`;
  await bootstrapAccount(page, request, email);
  await page.goto("/methods/passkey");
  await page.getByLabel("AUTHENTICATOR LABEL").fill("Platform test passkey");
  await page.getByRole("button", { name: "Add platform passkey" }).click();
  await expect(page.getByText("Discoverable passkey linked to this account."))
    .toBeVisible();

  await page.goto("/methods/password");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/methods/passkey");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByText(/opaque session is active/i)).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });
  await page.getByLabel("AUTHENTICATOR LABEL").fill("Roaming test key");
  await page.getByRole("button", { name: "Add roaming security key" }).click();
  await expect(page.getByText(/eligible for high-assurance step-up/i)).toBeVisible();

  let verificationBody: unknown;
  page.on("request", (sent) => {
    if (sent.url().includes("/api/lab/passkeys/step-up/verify")) {
      verificationBody = sent.postDataJSON();
    }
  });
  await page
    .getByRole("button", { name: "Verify security-key step-up" })
    .click();
  await expect(page.getByText(/no new session was created/i)).toBeVisible();
  expect(verificationBody).toBeTruthy();

  const replay = await page.request.post(
    "/api/lab/passkeys/step-up/verify",
    {
      data: verificationBody,
      headers: { origin: "http://localhost:3000" }
    }
  );
  expect(replay.status()).toBe(409);
  await expect(replay.json()).resolves.toEqual({
    error: "expired-or-replayed"
  });

  const freshOptions = await page.request.post(
    "/api/lab/passkeys/step-up/options"
  );
  expect(freshOptions.ok()).toBe(true);
  const { challengeId } = await freshOptions.json() as { challengeId: string };
  const invalidOrigin = await page.request.post(
    "/api/lab/passkeys/step-up/verify",
    {
      data: { challengeId, response: {} },
      headers: { origin: "https://auth-lab.invalid" }
    }
  );
  expect(invalidOrigin.status()).toBe(400);
  await expect(invalidOrigin.json()).resolves.toEqual({
    error: "invalid-origin"
  });

  await page.getByRole("button", { name: "Revoke Platform test passkey" }).click();
  await expect(page.getByText(/credential revoked/i)).toBeVisible();
  await expect(page.getByText("Platform test passkey")).toHaveCount(0);
});
