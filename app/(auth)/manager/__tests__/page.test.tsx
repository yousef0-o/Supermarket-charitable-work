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
      user_metadata: { name: "المدير الحالي", role: "manager" },
      email: "current-manager@example.com",
    },
  },
  error: null,
});

const mockUpdateUser = vi.fn().mockResolvedValue({
  data: {
    user: {
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock response for mounting
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: { name: "المدير الحالي", role: "manager" },
          email: "current-manager@example.com",
        },
      },
      error: null,
    });
  });

  it("renders the manager page and creation form correctly", () => {
    render(<ManagerPage />);
    expect(screen.getByRole("heading", { name: "صفحة المدير - إدارة المستخدمين" })).toBeInTheDocument();
    expect(screen.getByLabelText("الاسم الكامل")).toBeInTheDocument();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByLabelText("كلمة المرور للمستخدم الجديد")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة حساب المستخدم" })).toBeInTheDocument();
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ManagerPage />);
    
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        user: { id: "user-id", email: "new@example.com", name: "أحمد علي", role: "cashier" }
      }),
    });

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
    mockFetch.mockResolvedValue({
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

  /* New Settings/Profile tab tests */

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

  it("displays general error message when Supabase update fails", async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "فشل في تحديث الحساب (البريد مكرر)" },
    });

    render(<ManagerPage />);

    fireEvent.click(screen.getByRole("button", { name: "إعدادات حسابي" }));

    const profileNameInput = await screen.findByLabelText("اسم العرض (الاسم الكامل)") as HTMLInputElement;
    fireEvent.change(profileNameInput, { target: { value: "اسم جديد" } });

    const saveButton = screen.getByRole("button", { name: "حفظ التغييرات" });
    fireEvent.click(saveButton);

    expect(await screen.findByText("فشل تعديل البيانات")).toBeInTheDocument();
    expect(screen.getByText("فشل في تحديث الحساب (البريد مكرر)")).toBeInTheDocument();
  });
});
