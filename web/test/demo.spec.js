import { test, expect } from "@playwright/test";
test("live demo: filter, search, stock adjustment, persistence, Excel upload and mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByText("Complete Sheet Set", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Living space", exact: true }).click();
  await expect(page.getByText("Custom Curtain", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Complete Sheet Set", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All products", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search inventory" })
    .fill("NUKA-SHEET");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Sell one Complete Sheet Set", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("23 units");
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search inventory" })
    .fill("NUKA-SHEET");
  await expect(page.locator("tbody tr .stock-control strong")).toHaveText("23");
  await page
    .getByRole("button", { name: "Add one Complete Sheet Set", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("24 units");
  await page.getByRole("textbox", { name: "Search inventory" }).fill("");
  await expect
    .poll(async () => (await page.request.get("/excel/health")).status())
    .toBe(200);
  await page
    .getByLabel("Import Excel inventory")
    .setInputFiles("examples/sample-inventory.xlsx");
  await expect(page.getByRole("status")).toContainText(
    "Imported 2 product variants",
  );
  await expect(
    page.getByText("Linen Throw Pillow", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Import Excel inventory")
    .setInputFiles("examples/sample-inventory.xlsx");
  await expect(page.getByRole("alert")).toContainText("SKU already exists");
  await page.screenshot({ path: "/tmp/edepo-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/edepo-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("create, edit, validate and delete a product", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Complete Sheet Set", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Demo Curtain");
  await page.getByLabel("SKU", { exact: true }).fill("CRUD-DEMO");
  await page.getByLabel("Stock quantity", { exact: true }).fill("12");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Demo Curtain", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Demo Curtain", exact: true })
    .click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Updated Curtain");
  await page.getByLabel("Fabric", { exact: true }).fill("Linen");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Updated Curtain", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Updated Curtain", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Updated Curtain", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Updated Curtain", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Updated Curtain", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await expect(page.getByText("Updated Curtain", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Team Avengers", { exact: false })).toHaveCount(
    0,
  );
});
