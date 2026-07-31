import { expect, test } from "@playwright/test";

test("inspects a session and rejects a replayed DPoP proof", async ({
  page
}, testInfo) => {
  await page.goto("/methods/oidc");
  await page.getByRole("button", {
    name: "Continue with local OpenID Provider"
  }).click();
  await expect(page).toHaveURL(/\/api\/lab\/oidc\/provider\/authorize/);
  await page
    .getByText(
      testInfo.project.name === "mobile-chromium"
        ? "River Federated"
        : "Ava Federated"
    )
    .click();
  await page.getByRole("button", { name: "Approve and redirect" }).click();
  await expect(page).toHaveURL(/\/methods\/oidc\?.*result=signed-in/);

  await page.goto("/methods/sessions");
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.getByText("Current session")).toBeVisible();

  await page.getByRole("button", { name: "Inspect lifecycle" }).click();
  await expect(
    page.getByText(/Owned session summaries and public lifecycle policy/)
  ).toBeVisible();

  await page.getByRole("button", { name: "Routine read" }).click();
  await expect(page.getByText(/routine read can use/i)).toBeVisible();

  await page.getByRole("button", { name: "Issue bound token" }).click();
  await expect(page.getByText(/non-exportable private key remains/i)).toBeVisible();
  await page.getByRole("button", { name: "Call resource" }).click();
  await expect(page.getByText(/validated the token binding/i)).toBeVisible();
  await page.getByRole("button", { name: "Replay same proof" }).click();
  await expect(page.getByText(/rejected as a replay/i)).toBeVisible();

  const labText = await page.locator(".lab-layout").textContent();
  expect(labText).not.toMatch(/authorization:\s*DPoP/i);
  expect(labText).not.toMatch(/better-auth\.session_token/i);
});
