import { test, expect } from "./fixtures/auth";

test("registers a deterministic local test creator", async ({
  authedPage: page,
}) => {
  await page.goto("/dashboard?e2eStage=unregistered");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByPlaceholder("Your name").fill("Public Beta Creator");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "What do you create?" }),
  ).toBeVisible();
});
