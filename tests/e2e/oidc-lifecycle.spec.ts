import { expect, test } from "@playwright/test";

test("completes local OIDC Authorization Code with PKCE", async ({ page }, testInfo) => {
  await page.goto("/methods/oidc");
  await page.getByRole("button", {
    name: "Continue with local OpenID Provider"
  }).click();

  await expect(page).toHaveURL(/\/api\/lab\/oidc\/provider\/authorize/);
  await expect(page.getByText("Local provider · consent")).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByText("River Federated").click();
  } else {
    await page.getByText("Ava Federated").click();
  }
  await page.getByRole("button", { name: "Approve and redirect" }).click();

  await expect(page).toHaveURL(/\/methods\/oidc\?.*result=signed-in/);
  await expect(
    page.getByText(/Signed in as (ava|river)@federation\.auth-lab\.local/)
  ).toBeVisible();
  await expect(
    page.getByText("Provider claims validated and an opaque local session created.")
  ).toBeVisible();
  await expect(
    page.getByText("/api/auth/oauth2/callback/local-oidc")
  ).toBeVisible();

  await page.getByRole("button", { name: "Unlink" }).click();
  await expect(
    page.getByText(/must keep at least one sign-in method/)
  ).toBeVisible();
});
