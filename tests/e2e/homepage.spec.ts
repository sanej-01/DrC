import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads successfully and displays topbar", async ({ page }) => {
    await page.goto("/");

    // Check title
    await expect(page).toHaveTitle("Dr Codium");

    // Check topbar branding
    const brand = page.locator("text=Dr Codium");
    await expect(brand).toBeVisible();
  });

  test("displays role switch buttons", async ({ page }) => {
    await page.goto("/");

    // Check role buttons
    const devButton = page.locator("button:has-text('Developer')");
    const mgrButton = page.locator("button:has-text('Manager')");
    const vpButton = page.locator("button:has-text('Director / VP')");

    await expect(devButton).toBeVisible();
    await expect(mgrButton).toBeVisible();
    await expect(vpButton).toBeVisible();
  });

  test("displays Phase 0 placeholder content", async ({ page }) => {
    await page.goto("/");

    // Check placeholder
    const title = page.locator("text=Dr Codium");
    const subtitle = page.locator(
      "text=Phase 0.1 scaffold — design tokens & base layout complete"
    );

    await expect(title).toBeVisible();
    await expect(subtitle).toBeVisible();
  });
});
