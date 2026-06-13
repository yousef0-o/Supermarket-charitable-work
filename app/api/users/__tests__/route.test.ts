import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const mockGetUser = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "test-anon-key",
  }),
}));

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("غير مصرح. يرجى تسجيل الدخول أولاً.");
  });

  it("returns 403 when authenticated user is a cashier", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "cashier-id",
          user_metadata: { role: "cashier" },
        },
      },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("غير مصرح. لا تملك صلاحية إضافة مستخدمين.");
  });

  it("returns 400 when request body contains additional/forbidden fields", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "manager-id",
          user_metadata: { role: "manager" },
        },
      },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "test@domain.com",
        password: "password123",
        name: "خالد محمود",
        role: "cashier",
        extra_field: "not-allowed",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("طلب غير صالح. يحتوي على حقول غير مسموح بها.");
  });

  it("returns 422 when required fields are missing or invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "manager-id",
          user_metadata: { role: "manager" },
        },
      },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "invalid-email",
        password: "123",
        name: "أ",
        role: "invalid-role",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.email).toBe("يرجى إدخال بريد إلكتروني صحيح.");
    expect(body.errors.password).toBe("يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
    expect(body.errors.name).toBe("يرجى إدخال اسم صحيح ثنائي على الأقل.");
    expect(body.errors.role).toBe("نوع الحساب غير صحيح. يجب أن يكون مدير أو كاشير.");
  });

  it("succeeds (201) and returns user when parameters are valid and caller is a manager", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "manager-id",
          user_metadata: { role: "manager" },
        },
      },
      error: null,
    });

    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: "new-user-id",
          email: "newuser@example.com",
          user_metadata: {
            name: "سعيد محمد",
            role: "cashier",
          },
        },
      },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "newuser@example.com",
        password: "password123",
        name: "سعيد محمد",
        role: "cashier",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe("new-user-id");
    expect(body.user.email).toBe("newuser@example.com");
    expect(body.user.name).toBe("سعيد محمد");
    expect(body.user.role).toBe("cashier");
  });

  it("returns error status and message when Supabase auth signUp fails", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "manager-id",
          user_metadata: { role: "manager" },
        },
      },
      error: null,
    });

    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: {
        message: "Email address already registered",
        status: 400,
      },
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "existing@example.com",
        password: "password123",
        name: "مستخدم موجود",
        role: "manager",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Email address already registered");
  });
});
