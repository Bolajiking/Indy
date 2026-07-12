import { test, expect } from "./fixtures/auth";

test("shows a server-backed approval preview before execution", async ({
  authedPage: page,
}) => {
  await page.goto("/dashboard");
  const composer = page.getByPlaceholder("Ask Indyfren anything…");
  await composer.fill("Send my pitch to Acme");
  await composer.press("Enter");
  await expect(
    page.getByText("I prepared a safe preview for your approval."),
  ).toBeVisible();
  await expect(page.getByText(/Send pitch|approval/i).first()).toBeVisible();
});
