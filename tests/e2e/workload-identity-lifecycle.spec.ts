import { expect, test } from "@playwright/test";

test("evolves a machine principal from bearer keys to workload federation", async ({ page }) => {
  await page.goto("/methods/workloads");
  await page.getByRole("button", { name: "Create principal and API key" }).click();
  await expect(page.getByText("Machine principal created.")).toBeVisible();

  await page.getByRole("button", { name: "Call orders API" }).click();
  await expect(page.getByText("The resource authorized this machine principal")).toBeVisible();
  await page.getByRole("button", { name: "Wrong audience" }).click();
  await expect(page.getByText("rejected for a different audience")).toBeVisible();

  await page.getByRole("tab", { name: "OAuth token" }).click();
  await page.getByRole("button", { name: "Issue client secret" }).click();
  await expect(page.getByText("Confidential client credential returned once")).toBeVisible();
  await page.getByRole("button", { name: "Exchange for token" }).click();
  await expect(page.getByText("a five-minute scoped bearer token was issued")).toBeVisible();
  await page.getByRole("button", { name: "Call with 5-minute token" }).click();
  await expect(page.getByText("Bearer workload access succeeded")).toBeVisible();

  await page.getByRole("tab", { name: "Federation" }).click();
  await page.getByRole("button", { name: "Attest runtime" }).click();
  await expect(page.getByText("No API key or client secret was used")).toBeVisible();
  await page.getByRole("button", { name: "Exchange assertion" }).click();
  await expect(page.getByText("A two-minute DPoP-bound access token")).toBeVisible();
  await page.getByRole("button", { name: "Replay assertion" }).click();
  await expect(page.getByText("rejected on replay")).toBeVisible();
  await page.getByRole("button", { name: "Call with DPoP proof" }).click();
  await expect(page.getByText("Sender-constrained workload access succeeded")).toBeVisible();
  await page.getByRole("button", { name: "Replay exact proof" }).click();
  await expect(page.getByText("exact DPoP proof was rejected on replay")).toBeVisible();
});
