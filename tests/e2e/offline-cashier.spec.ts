import { test, expect } from "@playwright/test";

test.describe("Suite B: The Offline Cashier Flow (CRITICAL)", () => {
  test("Simulate search, offline disbursement, optimistic UI update, and subsequent online sync", async ({
    context,
    page,
  }) => {
    const email = process.env.PLAYWRIGHT_TEST_USER_EMAIL;
    const password = process.env.PLAYWRIGHT_TEST_USER_PASSWORD;

    if (!email || !password) {
      console.warn(
        "\n⚠️  [PLAYWRIGHT WARNING]: PLAYWRIGHT_TEST_USER_EMAIL and PLAYWRIGHT_TEST_USER_PASSWORD are not set. " +
          "Skipping offline cashier flow E2E tests.\n",
      );
      test.skip(true, "Credentials not provided in environment.");
      return;
    }

    const mockCycleId = "cycle-123-test";
    const mockBeneficiaryId = "beneficiary-999-test";

    // 1. Setup Supabase Interceptions in the browser
    // This allows us to keep the test predictable and isolate it from mutating real database records.
    
    // Intercept distribution cycles fetch
    await page.route("**/rest/v1/distribution_cycles*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: mockCycleId,
            started_at: new Date().toISOString(),
            is_active: true,
          },
        ]),
      });
    });

    // Intercept beneficiaries search
    await page.route("**/rest/v1/beneficiaries*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: mockBeneficiaryId,
            full_name: "مستفيد تجريبي للتحقق من الصرف",
            identifier: "01099999999",
            family_size: 4,
            joined_at: new Date().toISOString(),
            aid_transactions: [], // Not received in active cycle yet
          },
        ]),
      });
    });

    // Intercept transaction post/insert
    await page.route("**/rest/v1/aid_transactions*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "tx-new-uuid-test",
            beneficiary_id: mockBeneficiaryId,
            received_at: new Date().toISOString(),
            admin_id: "admin-uuid-test",
            cycle_id: mockCycleId,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 2. Perform Real Login (required to get authentication cookies for the middleware)
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');

    // Wait for redirection to /search
    await expect(page).toHaveURL(/\/search/, { timeout: 15000 });

    // 3. Search for the Mock Beneficiary
    const searchInput = page.locator("#search-input");
    await searchInput.fill("مستفيد");

    // Wait for the mock beneficiary card to load
    const beneficiaryCard = page.locator("text=مستفيد تجريبي للتحقق من الصرف");
    await expect(beneficiaryCard).toBeVisible({ timeout: 10000 });

    // Verify status is "غير مستلم" (not received)
    await expect(page.locator("text=غير مستلم")).toBeVisible();
    const disburseBtn = page.locator("button:has-text('تأكيد الصرف')");
    await expect(disburseBtn).toBeEnabled();

    // 4. Simulate Network Disconnection (Go Offline)
    await context.setOffline(true);

    // 5. Trigger Disbursement while Offline
    await disburseBtn.click();

    // Modal should appear
    const modalTitle = page.locator("text=تأكيد صرف المساعدة");
    await expect(modalTitle).toBeVisible();

    // Confirm disbursement inside the modal
    const confirmBtn = page.locator("button:has-text('تأكيد وتسجيل الصرف')");
    await confirmBtn.click();

    // 6. Verify Optimistic UI updates
    // The card status should turn to "مستلم" and button should say "تم الصرف"
    await expect(page.locator("text=مستلم")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=تم الصرف في هذه الدورة")).toBeVisible();

    // Verify "Saved locally" toast message appears
    const offlineToast = page.locator("text=تم الحفظ محلياً. ستتم المزامنة عند عودة الإنترنت");
    await expect(offlineToast).toBeVisible({ timeout: 5000 });

    // 7. Restore Connection (Go Online)
    await context.setOffline(false);

    // 8. Verify Background Sync triggers and succeeds
    // The "عادت التغطية" and "تمت مزامنة" toasts should appear
    const onlineToast = page.locator("text=عادت التغطية. جار مزامنة العمليات المحفوظة محلياً...");
    await expect(onlineToast).toBeVisible({ timeout: 10000 });

    const syncSuccessToast = page.locator("text=تمت مزامنة 1 من عمليات الصرف المحفوظة تلقائياً.");
    await expect(syncSuccessToast).toBeVisible({ timeout: 10000 });
  });
});
