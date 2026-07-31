import { expect, test } from "@playwright/test";

test("authorizes a constrained client and rejects device-code replay", async ({
  page
}, testInfo) => {
  await page.goto("/methods/oidc");
  await page.getByRole("button", {
    name: "Continue with local OpenID Provider"
  }).click();
  await page
    .getByText(
      testInfo.project.name === "mobile-chromium"
        ? "River Federated"
        : "Ava Federated"
    )
    .click();
  await page.getByRole("button", { name: "Approve and redirect" }).click();
  await expect(page).toHaveURL(/\/methods\/oidc\?.*result=signed-in/);

  await page.goto("/methods/device");
  await page.getByRole("button", { name: "Request device authorization" }).click();
  await expect(page.getByText(/USER CODE/).first()).toBeVisible();
  await expect(page.getByAltText("Device verification QR code")).toBeVisible();

  await page.getByRole("button", { name: "Poll token endpoint" }).click();
  await expect(page.getByText(/Authorization pending/)).toBeVisible();

  const approvalPagePromise = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "Open verification in another tab" })
    .click();
  const approvalPage = await approvalPagePromise;
  await expect(approvalPage.getByText("Auth Lab constrained client")).toBeVisible();
  await expect(approvalPage.getByText(/scope device\.read/)).toBeVisible();
  await approvalPage.getByRole("button", { name: "Approve device" }).click();
  await expect(approvalPage.getByText(/Return to the constrained client/)).toBeVisible();

  await page.getByRole("button", { name: "Poll token endpoint" }).click();
  await expect(page.getByText(/Approval consumed once/)).toBeVisible();
  await page.getByRole("button", { name: "Call scoped resource" }).click();
  await expect(page.getByText(/accessed the synthetic device resource/)).toBeVisible();
  await page.getByRole("button", { name: "Replay device code" }).click();
  await expect(page.getByText(/rejected as a replay/)).toBeVisible();

  const labText = await page.locator(".lab-layout").textContent();
  expect(labText).not.toMatch(/authorization:\s*Bearer/i);
  expect(labText).not.toMatch(/device_code=/i);
  await approvalPage.close();
});
