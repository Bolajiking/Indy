import { test, expect } from "./fixtures/auth";

test("creates and archives a creator-scoped deal", async ({
  authedPage: page,
}) => {
  await page.goto("/dashboard/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  await page.getByLabel("Brand name").fill("Public Beta Brand");
  await page
    .getByRole("button", { name: /save|add deal/i })
    .last()
    .click();
  await expect(page.getByText("Public Beta Brand")).toBeVisible();
  await page.getByRole("button", { name: "Archive" }).first().click();
});
