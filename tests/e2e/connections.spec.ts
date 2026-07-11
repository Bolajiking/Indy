import { test, expect } from "./fixtures/auth";

test("opens the connections control plane", async ({ authedPage: page }) => {
  await page.goto("/dashboard?settings=connections");
  await expect(
    page.getByRole("heading", { name: "Connections" }),
  ).toBeVisible();
  await expect(
    page.getByText(/configured|connected|connection/i).first(),
  ).toBeVisible();
});
