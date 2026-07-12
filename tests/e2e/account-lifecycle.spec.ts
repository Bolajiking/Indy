import { test, expect } from "./fixtures/auth";

test("exposes export and guarded account deletion controls", async ({
  authedPage: page,
}) => {
  await page.goto("/dashboard?settings=account");
  await expect(
    page.getByRole("button", { name: "Download my data" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(
    page.getByRole("group", { name: "Permanently delete this account" }),
  ).toContainText(/exactly/i);
  await expect(
    page.getByRole("button", { name: /delete/i }).last(),
  ).toBeDisabled();
});
