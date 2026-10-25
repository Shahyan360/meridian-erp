import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const audit = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
};
test("workspace in both themes and product dialog have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin full workspace/i }).click();
  await expect(
    page.getByRole("heading", { name: "Revenue overview" }),
  ).toBeVisible();
  await audit(page);
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await audit(page);
  await page.goto("/app/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("contact page in both themes and fully revealed landing page have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/contact");
  await expect(
    page.getByRole("heading", { name: "Let’s start here." }),
  ).toBeVisible();
  await audit(page);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await audit(page);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.goto("/");
  for (const element of await page
    .locator(".public-section, .public-cta")
    .all())
    await element.scrollIntoViewIfNeeded();
  await audit(page);
});
