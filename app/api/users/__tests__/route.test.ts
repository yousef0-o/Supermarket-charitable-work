import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE } from "../route";

const mockGetUser = vi.fn();
const mockSignUp = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
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

describe("API Users Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/users", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await GET();
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

      const response = await GET();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("غير مصرح. لا تملك صلاحية إدارة المستخدمين.");
    });

    it("succeeds (200) and returns users list when caller is a manager", async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "manager-id",
            user_metadata: { role: "manager" },
          },
        },
        error: null,
      });

      const mockUsers = [
        { id: "1", email: "user1@ex.com", name: "User 1", role: "cashier", created_at: "2026" },
      ];
      mockRpc.mockResolvedValue({ data: mockUsers, error: null });

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockUsers);
      expect(mockRpc).toHaveBeenCalledWith("list_users");
    });
  });

  describe("POST /api/users", () => {
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
    });
  });

  describe("PUT /api/users", () => {
    it("returns 422 when name is too short or role is invalid", async () => {
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
        method: "PUT",
        body: JSON.stringify({
          id: "some-user-id",
          name: "أ",
          role: "invalid-role",
        }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.errors).toBeDefined();
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
        method: "PUT",
        body: JSON.stringify({
          id: "some-user-id",
          name: "أحمد علي",
          role: "cashier",
          extra_field: "not-allowed",
        }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(400);
    });

    it("succeeds (200) when parameters are valid and caller is a manager", async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "manager-id",
            user_metadata: { role: "manager" },
          },
        },
        error: null,
      });

      mockRpc.mockResolvedValue({ data: null, error: null });

      const req = new Request("http://localhost:3000/api/users", {
        method: "PUT",
        body: JSON.stringify({
          id: "some-user-id",
          name: "أحمد علي",
          role: "cashier",
        }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("update_user_meta", {
        p_user_id: "some-user-id",
        p_name: "أحمد علي",
        p_role: "cashier",
      });
    });
  });

  describe("DELETE /api/users", () => {
    it("returns 400 when id query parameter is missing", async () => {
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
        method: "DELETE",
      });

      const response = await DELETE(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("معرف المستخدم مطلوب لحذف الحساب.");
    });

    it("returns 400 when manager attempts self-deletion", async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "manager-id",
            user_metadata: { role: "manager" },
          },
        },
        error: null,
      });

      const req = new Request("http://localhost:3000/api/users?id=manager-id", {
        method: "DELETE",
      });

      const response = await DELETE(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول.");
    });

    it("succeeds (200) when deleting another user and caller is a manager", async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "manager-id",
            user_metadata: { role: "manager" },
          },
        },
        error: null,
      });

      mockRpc.mockResolvedValue({ data: null, error: null });

      const req = new Request("http://localhost:3000/api/users?id=other-user-id", {
        method: "DELETE",
      });

      const response = await DELETE(req);
      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("delete_user", {
        p_user_id: "other-user-id",
      });
    });
  });
});
