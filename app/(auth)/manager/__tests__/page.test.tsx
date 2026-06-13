import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ManagerPage from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/manager",
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase client
const mockGetUser = vi.fn().mockResolvedValue({
  data: {
    user: {
      id: "current-manager-id",
      user_metadata: { name: "المدير الحالي", role: "manager" },
      email: "current-manager@example.com",
    },
  },
  error: null,
});

const mockUpdateUser = vi.fn().mockResolvedValue({
  data: {
    user: {
      id: "current-manager-id",
      user_metadata: { name: "الاسم الجديد", role: "manager" },
      email: "new-email@example.com",
    },
  },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
  }),
}));

describe("ManagerPage Component", () => {
  const mockUsersList = [
    {
      id: "current-manager-id",
      email: "current-manager@example.com",
      name: "المدير الحالي",
      role: "manager",
      created_at: "2026-06-13T22:00:00Z",
    },
    {
      id: "cashier-1-id",
      email: "cashier1@example.com",
      name: "كاشير واحد",
      role: "cashier",
      created_at: "2026-06-13T21:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock response for mounting
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "current-manager-id",
          user_metadata: { name: "المدير الحالي", role: "manager" },
          email: "current-manager@example.com",
        },
      },
      error: null,
    });

    mockFetch.mockImplementation(async (url, init) => {
      // Return user list for GET /api/users
      if (typeof url === "string" && url.includes("/api/users") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => mockUsersList,
        };
      }
      // Return success for POST /api/users
      if (typeof url === "string" && url.includes("/api/users") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      // Return success for PUT /api/users
      if (typeof url === "string" && url.includes("/api/users") && init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      // Return success for DELETE /api/users
      if (typeof url === "string" && url.includes("/api/users") && init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return { ok: false, status: 400 };
    });
  });

  it("renders the manager page and creation form correctly", async () => {
    render(<ManagerPage />);
    expect(screen.getByRole("heading", { name: "صفحة المدير - إدارة المستخدمين" })).toBeInTheDocument();
    expect(screen.getByLabelText("الاسم الكامل")).toBeInTheDocument();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByLabelText("كلمة المرور للمستخدم الجديد")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة حساب المستخدم" })).toBeInTheDocument();

    // Verify user list loaded
    expect(await screen.findByText("المدير الحالي")).toBeInTheDocument();
    expect(screen.getByText("كاشير واحد")).toBeInTheDocument();
  });

  it("displays validation errors for empty fields on submit", async () => {
    render(<ManagerPage />);
    const submitButton = screen.getByRole("button", { name: "إضافة حساب المستخدم" });
    fireEvent.click(submitButton);

    expect(await screen.findByText("الاسم الكامل مطلوب (ثنائي على الأقل).")).toBeInTheDocument();
    expect(screen.getByText("يرجى إدخال بريد إلكتروني صحيح.")).toBeInTheDocument();
    expect(screen.getByText("يجب أن تكون كلمة المرور 6 أحرف على الأقل.")).toBeInTheDocument();
  });

  it("disables button and shows loading text during submission", async () => {
    render(<ManagerPage />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "أحمد علي" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "ahmed@example.com" } });
    fireEvent.change(screen.getByLabelText("كلمة المرور للمستخدم الجديد"), { target: { value: "password123" } });

    const submitButton = screen.getByRole("button", { name: "إضافة حساب المستخدم" });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText("جاري إنشاء الحساب...")).toBeInTheDocument();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("shows success message and clears inputs upon successful creation", async () => {
    render(<ManagerPage />);

    const nameInput = screen.getByLabelText("الاسم الكامل") as HTMLInputElement;
    const emailInput = screen.getByLabelText("البريد الإلكتروني") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("كلمة المرور للمستخدم الجديد") as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "أحمد علي" } });
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const submitButton = screen.getByRole("button", { name: "إضافة حساب المستخدم" });
    fireEvent.click(submitButton);

    expect(await screen.findByText("تمت إضافة الحساب بنجاح!")).toBeInTheDocument();
    expect(screen.getByText(/أحمد علي/)).toBeInTheDocument();
    
    expect(nameInput.value).toBe("");
    expect(emailInput.value).toBe("");
    expect(passwordInput.value).toBe("");
  });

  it("displays general error message from API response on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "البريد الإلكتروني مسجل بالفعل لمستخدم آخر" }),
    });

    render(<ManagerPage />);

    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "أحمد علي" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "existing@example.com" } });
    fireEvent.change(screen.getByLabelText("كلمة المرور للمستخدم الجديد"), { target: { value: "password123" } });

    const submitButton = screen.getByRole("button", { name: "إضافة حساب المستخدم" });
    fireEvent.click(submitButton);

    expect(await screen.findByText("خطأ في إنشاء الحساب")).toBeInTheDocument();
    expect(screen.getByText("البريد الإلكتروني مسجل بالفعل لمستخدم آخر")).toBeInTheDocument();
  });

  /* User List Editing & Deleting UI flows */

  it("opens edit modal on edit button click and submits PUT changes", async () => {
    render(<ManagerPage />);
    
    // Find edit button for "كاشير واحد" (the second user in list)
    const editButtons = await screen.findAllByTitle("تعديل الحساب");
    expect(editButtons).toHaveLength(2);

    // Click edit on the cashier user (index 1)
    fireEvent.click(editButtons[1]);

    // Modal should be open
    expect(screen.getByText("تعديل بيانات المستخدم")).toBeInTheDocument();
    
    const editNameInput = screen.getByLabelText("الاسم الكامل للموظف") as HTMLInputElement;
    expect(editNameInput.value).toBe("كاشير واحد");

    // Change name
    fireEvent.change(editNameInput, { target: { value: "كاشير معدل" } });

    // Click Save
    const saveButton = screen.getByRole("button", { name: "حفظ التغييرات" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Modal should close
      expect(screen.queryByText("تعديل بيانات المستخدم")).not.toBeInTheDocument();
    });

    // Check fetch was called with PUT
    const putCall = mockFetch.mock.calls.find(call => call[1]?.method === "PUT");
    expect(putCall).toBeDefined();
    expect(JSON.parse(putCall?.[1]?.body)).toEqual({
      id: "cashier-1-id",
      name: "كاشير معدل",
      role: "cashier",
    });
  });

  it("opens delete modal on delete button click and submits DELETE request", async () => {
    render(<ManagerPage />);
    
    // Find delete buttons
    const deleteButtons = await screen.findAllByTitle("حذف الحساب");
    // Only 1 should be enabled/available since the manager's own delete button is disabled
    expect(deleteButtons).toHaveLength(1);

    // Click delete on cashier user
    fireEvent.click(deleteButtons[0]);

    // Confirmation dialog should be visible
    expect(screen.getByText("حذف حساب المستخدم؟")).toBeInTheDocument();
    expect(screen.getByText(/هل أنت متأكد من رغبتك في حذف حساب/)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: "نعم، حذف الحساب" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Modal should close
      expect(screen.queryByText("حذف حساب المستخدم؟")).not.toBeInTheDocument();
    });

    // Check fetch was called with DELETE
    const deleteCall = mockFetch.mock.calls.find(call => call[1]?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.[0]).toContain("/api/users?id=cashier-1-id");
  });

  it("disables deletion for current logged-in user", async () => {
    render(<ManagerPage />);
    
    // Find delete buttons (the manager's button is disabled, so we only get cashier's button as enabled)
    const disabledButtons = await screen.findAllByTitle("لا يمكنك حذف حسابك الحالي");
    expect(disabledButtons).toHaveLength(1);
    expect(disabledButtons[0]).toBeDisabled();
  });

  /* Settings/Profile tab tests */

  it("switches to settings tab and loads current profile details", async () => {
    render(<ManagerPage />);

    const settingsTab = screen.getByRole("button", { name: "إعدادات حسابي" });
    fireEvent.click(settingsTab);

    // Header changes
    expect(await screen.findByRole("heading", { name: "صفحة المدير - إعدادات حسابي" })).toBeInTheDocument();

    // Inputs should be pre-filled
    const profileNameInput = screen.getByLabelText("اسم العرض (الاسم الكامل)") as HTMLInputElement;
    const profileEmailInput = screen.getByLabelText("البريد الإلكتروني الحالي") as HTMLInputElement;
    
    expect(profileNameInput.value).toBe("المدير الحالي");
    expect(profileEmailInput.value).toBe("current-manager@example.com");
  });

  it("shows validation errors for invalid profile updates", async () => {
    render(<ManagerPage />);

    fireEvent.click(screen.getByRole("button", { name: "إعدادات حسابي" }));

    const profileNameInput = await screen.findByLabelText("اسم العرض (الاسم الكامل)") as HTMLInputElement;
    const profileEmailInput = screen.getByLabelText("البريد الإلكتروني الحالي") as HTMLInputElement;
    const profilePasswordInput = screen.getByLabelText("تغيير كلمة المرور (اختياري)") as HTMLInputElement;

    // Set invalid inputs
    fireEvent.change(profileNameInput, { target: { value: " " } });
    fireEvent.change(profileEmailInput, { target: { value: "not-an-email" } });
    fireEvent.change(profilePasswordInput, { target: { value: "123" } });

    const saveButton = screen.getByRole("button", { name: "حفظ التغييرات" });
    fireEvent.click(saveButton);

    expect(await screen.findByText("الاسم الكامل مطلوب (ثنائي على الأقل).")).toBeInTheDocument();
    expect(screen.getByText("يرجى إدخال بريد إلكتروني صحيح.")).toBeInTheDocument();
    expect(screen.getByText("يجب أن تكون كلمة المرور 6 أحرف على الأقل.")).toBeInTheDocument();
  });

  it("updates manager profile details successfully via Supabase", async () => {
    mockUpdateUser.mockResolvedValue({
      data: {
        user: {
          id: "current-manager-id",
          user_metadata: { name: "أحمد الجديد" },
          email: "newemail@example.com",
        },
      },
      error: null,
    });

    render(<ManagerPage />);

    fireEvent.click(screen.getByRole("button", { name: "إعدادات حسابي" }));

    const profileNameInput = await screen.findByLabelText("اسم العرض (الاسم الكامل)") as HTMLInputElement;
    const profileEmailInput = screen.getByLabelText("البريد الإلكتروني الحالي") as HTMLInputElement;
    const profilePasswordInput = screen.getByLabelText("تغيير كلمة المرور (اختياري)") as HTMLInputElement;

    fireEvent.change(profileNameInput, { target: { value: "أحمد الجديد" } });
    fireEvent.change(profileEmailInput, { target: { value: "newemail@example.com" } });
    fireEvent.change(profilePasswordInput, { target: { value: "newpassword123" } });

    const saveButton = screen.getByRole("button", { name: "حفظ التغييرات" });
    fireEvent.click(saveButton);

    expect(await screen.findByText("تم حفظ التغييرات بنجاح!")).toBeInTheDocument();
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { name: "أحمد الجديد" },
      email: "newemail@example.com",
      password: "newpassword123",
    });

    // Password input is cleared
    expect(profilePasswordInput.value).toBe("");
  });
});
