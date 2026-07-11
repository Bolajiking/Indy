import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures/auth";

for (const route of [
  "/",
  "/dashboard",
  "/dashboard/deals",
  "/dashboard/wallet",
  "/dashboard/reports",
  "/dashboard/settings",
]) {
  test(`${route} has no serious automated accessibility violations`, async ({
    authedPage: page,
  }) => {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}
