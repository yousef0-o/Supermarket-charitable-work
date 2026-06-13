import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";

// Mock Supabase Server Client
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

describe("POST /api/notify", () => {
  let originalEnvSecret: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnvSecret = process.env.ADMIN_NOTIFICATION_SECRET;
    process.env.ADMIN_NOTIFICATION_SECRET = "test_admin_secret_key";
  });

  afterEach(() => {
    process.env.ADMIN_NOTIFICATION_SECRET = originalEnvSecret;
  });

  it("returns 500 when ADMIN_NOTIFICATION_SECRET environment variable is missing", async () => {
    delete process.env.ADMIN_NOTIFICATION_SECRET;

    const req = new Request("http://localhost:3000/api/notify", {
      method: "POST",
    });

    const response = await POST(req);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("التكوين البرمجي للخادم غير مكتمل");
  });

  it("returns 401 when unauthorized", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const req = new Request("http://localhost:3000/api/notify", {
      method: "POST",
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBe("غير مصرح بالدخول");
  });

  it("succeeds with active session and processes valid numbers", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-uuid" } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { identifier: "01012345678", full_name: "مستفيد صالح" },
          { identifier: "9876543210", full_name: "مستفيد غير صالح" },
        ],
        error: null,
      }),
    });

    const req = new Request("http://localhost:3000/api/notify", {
      method: "POST",
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.total_beneficiaries).toBe(2);
    expect(body.queued).toBe(1); // Only the one starting with 01012345678 is processed
    expect(body.message).toContain("تمت جدولة إرسال 1 رسالة بنجاح");
  });

  it("succeeds when authorized via admin secret header", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { identifier: "01187654321", full_name: "أحمد صالح" },
        ],
        error: null,
      }),
    });

    // We can pass the secret via x-admin-secret header
    const req = new Request("http://localhost:3000/api/notify", {
      method: "POST",
      headers: {
        "x-admin-secret": "test_admin_secret_key",
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.queued).toBe(1);
  });
});
