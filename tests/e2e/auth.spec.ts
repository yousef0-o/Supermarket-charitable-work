import { test, expect } from "@playwright/test";

test.describe("Suite A: Authentication & Routing", () => {
  test("Simulate a user logging in with valid credentials and redirecting to /search", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_TEST_USER_EMAIL;
    const password = process.env.PLAYWRIGHT_TEST_USER_PASSWORD;

    if (!email || !password) {
      console.warn(
        "\n⚠️  [PLAYWRIGHT WARNING]: PLAYWRIGHT_TEST_USER_EMAIL and PLAYWRIGHT_TEST_USER_PASSWORD are not set. " +
          "Skipping real authentication E2E tests. Add them to your .env to run this test.\n",
      );
      test.skip(true, "Credentials not provided in environment.");
      return;
    }

    // Navigate to login page
    await page.goto("/login");

    // Verify page language / direction is RTL
    await expect(page.locator("main")).toHaveAttribute("dir", "rtl");

    // Fill the inputs
    await page.fill("#email", email);
    await page.fill("#password", password);

    // Click on submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify redirect to search interface
    await expect(page).toHaveURL(/\/search/, { timeout: 15000 });
  });
});
