import { test, expect } from "@playwright/test";
const signIn = async (page, role = "Admin") => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(`^${role} `, "i") })
    .click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Revenue overview" }),
  ).toBeVisible();
};
test("public site, local assets, 3D fallback, story, and 404 render cleanly", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good business/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Our story", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /Business is human/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Shahyan360", exact: true }),
  ).toBeVisible();
  await page.goto("/a-page-that-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "A little off the map." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("dashboard, theme persistence, notifications and Ctrl+K navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.getByText(/items need a restock/)).toBeVisible();
  await page.getByRole("button", { name: "Close notifications" }).click();
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light appearance" }).click();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Search workspace" })
    .fill("People");
  await dialog.getByRole("button", { name: "People & payroll" }).click();
  await expect(page).toHaveURL(/\/app\/employees/);
  await expect(page.getByRole("heading", { name: "Employees." })).toBeVisible();
  expect(errors).toEqual([]);
});
test("product create, update, search, CSV download, and delete through UI", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/app/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^SKU/).fill("E2E-PRODUCT");
  await dialog.getByLabel(/^Product name/).fill("Browser test product");
  await dialog.getByLabel(/^Category/).fill("Testing");
  await dialog.getByLabel(/^Selling price/).fill("125.50");
  await dialog.getByLabel(/^Cost price/).fill("80");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search Products" })
    .fill("E2E-PRODUCT");
  const row = page.getByRole("row").filter({ hasText: "Browser test product" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /^Edit product/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Product name/).fill("Updated browser product");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Updated browser product" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe("meridian-products.csv");
  await page
    .getByRole("row")
    .filter({ hasText: "Updated browser product" })
    .getByRole("button", { name: /^Delete product/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove record" })
    .click();
  await expect(
    page.getByRole("heading", { name: "No matches. A fresh search?" }),
  ).toBeVisible();
});
test("sales draft, posting, payment allocation, and invoice PDF", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/app/sales");
  await page.getByRole("button", { name: "Add sales order" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/^Customer/)
    .selectOption({ label: "Northstar Creative" });
  await dialog
    .getByRole("combobox", { name: "Product 1", exact: true })
    .selectOption({ label: "Everyday notebook" });
  await dialog
    .getByRole("spinbutton", { name: "Quantity 1", exact: true })
    .fill("2");
  await dialog.getByRole("button", { name: "Save draft" }).click();
  await expect(dialog).not.toBeVisible();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Northstar Creative" })
    .first();
  await expect(row).toContainText("draft");
  await row.getByRole("button", { name: "Post", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Post order", exact: true })
    .click();
  await expect(row).toContainText("posted");
  await row.getByRole("button", { name: "Pay", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(row).toContainText("paid");
  await row.getByRole("button", { name: /^View sales order/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Download PDF" })
    .click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^INV-.+\.pdf$/);
});
test("public contact is saved and readable from administrator Inbox", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByLabel("Your name", { exact: true }).fill("Browser visitor");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("browser@example.com");
  await page
    .getByLabel("What’s it about?")
    .fill("Browser contact verification");
  await page
    .getByLabel("Your message", { exact: true })
    .fill(
      "Please verify this contact form submission reaches the admin inbox.",
    );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Message received." }),
  ).toBeVisible();
  await signIn(page);
  await page.goto("/app/inbox");
  await page
    .getByRole("textbox", { name: "Search Inbox" })
    .fill("Browser contact verification");
  await expect(
    page.getByRole("row").filter({ hasText: "Browser visitor" }),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Browser visitor" })
    .getByRole("button", { name: /^View message/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Please verify this contact form submission",
  );
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Browser visitor" }),
  ).toContainText("read");
});
test("assistant handles missing key and contact confirmation without Gemini", async ({
  page,
}) => {
  let releaseHistory;
  const historyReady = new Promise((resolve) => {
    releaseHistory = resolve;
  });
  await page.route("**/api/chat/history", async (route) => {
    const response = await route.fetch();
    await historyReady;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open Meridian assistant" }).click();
  const panel = page.getByRole("region", { name: "Meridian assistant" });
  await expect(
    panel.getByRole("textbox", { name: "Message Meridian" }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  releaseHistory();
  await panel
    .getByRole("textbox", { name: "Message Meridian" })
    .fill("Help me get started");
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(panel.locator(".chat-bubble.assistant")).toContainText(
    "isn’t configured yet",
  );
  await panel
    .getByRole("button", { name: "Contact owner", exact: true })
    .click();
  await panel
    .getByLabel("Your name", { exact: true })
    .fill("Assistant visitor");
  await panel
    .getByLabel("Email", { exact: true })
    .fill("assistant@example.com");
  await panel
    .getByLabel("Subject", { exact: true })
    .fill("Assistant browser confirmation");
  await panel
    .getByLabel("Message", { exact: true })
    .fill("This should only be saved after explicit user confirmation.");
  await panel.getByRole("button", { name: "Review message" }).click();
  await expect(
    panel.getByText("Nothing has changed.", { exact: false }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Confirm action" }).click();
  await expect(panel.locator(".chat-bubble.assistant").last()).toContainText(
    "saved to the owner",
  );
});
test("employee access is read-only and financial pages are protected", async ({
  page,
}) => {
  await signIn(page, "Employee");
  await expect(
    page.getByRole("link", { name: "People & payroll" }),
  ).toHaveCount(0);
  await page.goto("/app/products");
  await expect(
    page.getByText("You have view access.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add product", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/reports");
  await expect(
    page.getByRole("heading", { name: "A different level of access" }),
  ).toBeVisible();
});
test("mobile workspace navigation and public pages fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "Manager");
  await expect(page.locator(".sidebar")).not.toHaveClass(/is-open/);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inventory." })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/contact");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good business/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("HR records, payroll and manual accounting journal are connected end to end", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/app/employees");
  await page.getByRole("button", { name: "Add employee", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^First name/).fill("Browser");
  await dialog.getByLabel(/^Last name/).fill("Teammate");
  await dialog.getByLabel(/^Job title/).fill("Analyst");
  await dialog.getByLabel(/^Monthly salary/).fill("65000");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Payroll", exact: true }).click();
  await page.getByRole("button", { name: "Add payroll record" }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/^Employee/)
    .selectOption({ label: "Browser Teammate" });
  await dialog.getByLabel(/^Period/).fill("2030-01");
  await dialog.getByLabel(/^Basic salary/).fill("65000");
  await dialog.getByLabel(/^Allowances/).fill("5000");
  await dialog.getByLabel(/^Deductions/).fill("1000");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "2030-01" }),
  ).toContainText("69,000");
  await page.goto("/app/reports?tab=journal");
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/^Debit account/)
    .selectOption({ label: "Cash & bank" });
  await dialog
    .getByLabel(/^Credit account/)
    .selectOption({ label: "Opening capital" });
  await dialog.getByLabel(/^Amount/).fill("500");
  await dialog.getByLabel(/^Description/).fill("Browser journal verification");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Browser journal verification" }),
  ).toBeVisible();
});
