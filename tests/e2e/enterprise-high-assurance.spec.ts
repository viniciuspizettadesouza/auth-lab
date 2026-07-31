import { expect, test } from "@playwright/test";

test("applies enterprise policy and high-assurance client lifecycle", async ({
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

  await page.goto("/methods/enterprise");
  await page.getByRole("button", { name: "Discover enterprise tenant" }).click();
  await expect(page.getByText(/Northstar Engineering requires OIDC SSO/)).toBeVisible();
  await page.getByRole("button", { name: "Apply valid tenant response" }).click();
  await expect(page.getByText(/Tenant membership mapped as member/)).toBeVisible();
  await page.getByRole("button", { name: "Try wrong issuer" }).click();
  await expect(page.getByText(/different enterprise tenant/)).toBeVisible();

  await page.getByRole("tab", { name: "FAPI + mTLS" }).click();
  await page.getByRole("button", { name: "Initialize confidential client" }).click();
  await expect(page.getByText(/non-exportable private key remains/)).toBeVisible();
  await page.getByRole("button", { name: "Sign assertion and request token" }).click();
  await expect(page.getByText(/Client assertion accepted once/)).toBeVisible();
  await page.getByRole("button", { name: "Replay assertion" }).click();
  await expect(page.getByText(/rejected as a replay/)).toBeVisible();
  await page.getByRole("button", { name: "Call bound resource" }).click();
  await expect(page.getByText(/accepted the matching token/)).toBeVisible();
  await page.getByRole("button", { name: "Try stolen token" }).click();
  await expect(page.getByText(/without its bound certificate was rejected/)).toBeVisible();
  await page.getByRole("button", { name: "Rotate certificate" }).click();
  await expect(page.getByText(/bounded overlap window/)).toBeVisible();
  await page.getByRole("button", { name: "Revoke certificate" }).click();
  await expect(page.getByText(/bound grants are unusable/)).toBeVisible();

  await page.getByRole("tab", { name: "Smartcard" }).click();
  await page.getByRole("button", { name: "Simulate valid card" }).click();
  await expect(page.getByText(/never accepts a PIN/)).toBeVisible();
  await page.getByRole("button", { name: "Try revoked card" }).click();
  await expect(page.getByText(/revocation check rejected/)).toBeVisible();

  const labText = await page.locator(".lab-layout").textContent();
  expect(labText).not.toMatch(/clientAssertion/i);
  expect(labText).not.toMatch(/authorization:\s*Bearer/i);
});
