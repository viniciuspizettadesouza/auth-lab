import { expect, test } from "@playwright/test";

const groups = [
  {
    family: "Credentials",
    scenarios: ["Reused password", "Simulated credential stuffing"]
  },
  {
    family: "Links, codes & recovery",
    scenarios: ["Captured magic link", "Captured OTP", "Push fatigue", "Recovery abuse"]
  },
  {
    family: "Sessions & OAuth",
    scenarios: ["Session fixation", "Token expiry, replay, and revocation", "Missing OAuth state", "Invalid redirect URI", "Email-only account linking"]
  },
  {
    family: "Origin & token binding",
    scenarios: ["Traditional phishing vs WebAuthn", "Bearer theft vs sender constraint"]
  }
] as const;

test("runs every bounded defense scenario without attack inputs or execution", async ({ page }) => {
  await page.goto("/methods/defensive-simulator");
  await expect(page.getByRole("textbox")).toHaveCount(0);

  for (const group of groups) {
    await page.getByRole("tab", { name: group.family }).click();
    for (const scenario of group.scenarios) {
      await page.getByRole("button", { name: scenario }).click();
      await expect(page.getByText("Consequence model complete")).toBeVisible();
      await expect(page.getByText("Executed: no", { exact: false })).toBeVisible();
      await expect(page.locator(".session-card .session-id").filter({ hasText: scenario })).toBeVisible();
    }
  }

  const status = await page.evaluate(async () => {
    const response = await fetch("/api/lab/defensive-simulator", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenario: "reused-password",
        target: "https://example.invalid",
        payload: "not allowed"
      })
    });
    return response.status;
  });
  expect(status).toBe(400);
});
