import { expect, test } from "@playwright/test";

test("selectively presents, rejects replay and revocation, and keeps agents non-executing", async ({ page }) => {
  await page.goto("/methods/portable");
  await page.getByRole("button", { name: "Issue synthetic wallet credential" }).click();
  await expect(page.getByText("synthetic wallet received")).toBeVisible();

  await page.getByRole("button", { name: "Request minimum claims" }).click();
  await expect(page.getByText("asks only for adult status and membership")).toBeVisible();
  await page.getByRole("button", { name: "Try lookalike audience" }).click();
  await expect(page.getByText("lookalike verifier was rejected")).toBeVisible();
  await page.getByRole("button", { name: "Consent and present" }).click();
  await expect(page.getByText("accepted only the consented claims")).toBeVisible();
  await page.getByRole("button", { name: "Replay presentation" }).click();
  await expect(page.getByText("rejected on replay")).toBeVisible();

  await page.getByRole("button", { name: "Revoke credential" }).click();
  await expect(page.getByText("Credential revoked")).toBeVisible();
  await page.getByRole("button", { name: "Request minimum claims" }).click();
  await page.getByRole("button", { name: "Consent and present" }).click();
  await expect(page.getByText("failed closed", { exact: false })).toBeVisible();

  await page.getByRole("tab", { name: "Agent exhibit" }).click();
  await page.getByRole("button", { name: "Read calendar" }).click();
  await expect(page.getByText("allow:")).toBeVisible();
  await expect(page.getByText("Executed: no")).toBeVisible();
  await page.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByText("approval-required:")).toBeVisible();
  await page.getByRole("button", { name: "Wire money" }).click();
  await expect(page.getByText("deny:")).toBeVisible();
});
