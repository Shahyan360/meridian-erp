import { test, expect } from "@playwright/test";
test("all workspace sections load, support keyboard navigation, and retain clear headings", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: /admin full workspace/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  const sections = [
    "products",
    "products?tab=product-categories",
    "inventory",
    "inventory?tab=stock-movements",
    "sales",
    "sales?tab=payments",
    "purchases",
    "customers",
    "vendors",
    "employees",
    "employees?tab=payroll",
    "employees?tab=employee-leaves",
    "expenses",
    "students",
    "students?tab=classes",
    "students?tab=guardians",
    "students?tab=attendance",
    "students?tab=student-leaves",
    "students?tab=fees",
    "students?tab=fee-payments",
    "reports",
    "reports?tab=accounts",
    "reports?tab=journal",
    "reports?tab=bank",
    "inbox",
    "settings",
    "settings?tab=users",
    "settings?tab=audit",
  ];
  for (const section of sections) {
    await page.goto(`/app/${section}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".error-state")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(
      "A little interruption.",
    );
  }
  await page.goto("/app/dashboard");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /search/i }).first(),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("public navigation and small phone layouts fit at 320, 375, 768 and 1024 pixels", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 850 });
    for (const path of ["/", "/about", "/contact", "/login"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} at ${width}px`,
      ).toBeTruthy();
    }
  }
});
