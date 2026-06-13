import { test, expect } from "@playwright/test";

test.describe("Suite C: Admin Dashboard Integration", () => {
  test("Log in as admin and verify the dashboard sections render successfully", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_TEST_USER_EMAIL;
    const password = process.env.PLAYWRIGHT_TEST_USER_PASSWORD;

    if (!email || !password) {
      console.warn(
        "\n⚠️  [PLAYWRIGHT WARNING]: PLAYWRIGHT_TEST_USER_EMAIL and PLAYWRIGHT_TEST_USER_PASSWORD are not set. " +
          "Skipping admin dashboard E2E tests.\n",
      );
      test.skip(true, "Credentials not provided in environment.");
      return;
    }

    // 1. Perform login
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');

    // Wait for redirection to /search
    await expect(page).toHaveURL(/\/search/, { timeout: 15000 });

    // 2. Navigate to /dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    // 3. Verify page header
    const dashboardHeader = page.locator("h1:has-text('لوحة التحكم والتقارير')");
    await expect(dashboardHeader).toBeVisible();

    // 4. Verify all 4 KPI Cards are rendered
    const kpi1 = page.locator("text=إجمالي المستفيدين");
    const kpi2 = page.locator("text=إجمالي التوزيعات");
    const kpi3 = page.locator("text=توزيعات الدورة الحالية");
    const kpi4 = page.locator("text=لم يستلموا بعد");

    await expect(kpi1).toBeVisible();
    await expect(kpi2).toBeVisible();
    await expect(kpi3).toBeVisible();
    await expect(kpi4).toBeVisible();

    // 5. Verify Monthly Chart Section
    const chartHeader = page.locator("h2:has-text('اتجاه التوزيع الشهري')");
    await expect(chartHeader).toBeVisible();

    // The chart component itself is lazy-loaded with dynamic import (ssr: false).
    // Let's assert either the loading placeholder is shown first or the recharts container itself is loaded.
    // This checks that no client-side crash occurred during chart mounting.
    const chartContainer = page.locator(".h-72");
    await expect(chartContainer).toBeVisible();

    // 6. Verify Live Feed Activity Section
    const feedHeader = page.locator("h2:has-text('النشاط الأخير')");
    await expect(feedHeader).toBeVisible();

    // Check if either empty state ("لا توجد سجلات بعد") or activity feed items are rendered
    const hasFeedContent = await page.locator("text=لا توجد سجلات بعد").isVisible() || 
                           await page.locator("text=صرف مساعدة لـ").first().isVisible();
    expect(hasFeedContent).toBe(true);
  });
});
