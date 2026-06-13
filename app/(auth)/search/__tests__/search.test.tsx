import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SearchInterface } from "../_components/search-interface";

// Helper for real timers delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Mock supabase client
const mockAuthGetUser = vi.fn();
const mockAuthGetSession = vi.fn().mockResolvedValue({
  data: {
    session: {
      user: {
        id: "00000000-0000-0000-0000-000000000000",
      },
    },
  },
  error: null,
});
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockAuthGetUser,
      getSession: mockAuthGetSession,
    },
    from: mockFrom,
  }),
}));

// 2. Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/search",
}));

// 3. Mock Framer Motion to render immediately without animations
vi.mock("framer-motion", () => {
  const React = require("react");
  const motionDiv = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement("div", { ref, ...props }, children)
  );
  const motion = { div: motionDiv };
  const m = { div: motionDiv };
  const AnimatePresence = ({ children }: any) => children;
  const LazyMotion = ({ children }: any) => children;
  const domAnimation = {};
  return { motion, m, AnimatePresence, LazyMotion, domAnimation };
});

// 4. Mock Network Status Provider
const mockUseNetworkStatus = vi.fn(() => ({
  isOnline: true,
  pendingCount: 0,
  syncOfflineData: vi.fn(),
  refreshPendingCount: vi.fn().mockResolvedValue(0),
  showToast: vi.fn(),
}));

vi.mock("@/components/providers/network-provider", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

// 5. Mock Offline Store
const mockSaveOfflineTransaction = vi.fn();
vi.mock("@/lib/offline-store", () => ({
  saveOfflineTransaction: (...args: any[]) => mockSaveOfflineTransaction(...args),
  getOfflineTransactions: vi.fn(),
  deleteOfflineTransaction: vi.fn(),
  clearOfflineTransactions: vi.fn(),
}));

describe("SearchInterface Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default getUser
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "admin-uuid" } },
      error: null,
    });

    // Default mockFrom to prevent mount-time crashes
    mockFrom.mockImplementation(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "cycle-1" },
          error: null,
        }),
        or: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      };
    });
  });

  it("renders the search interface with proper Arabic headings and empty state description", () => {
    render(<SearchInterface />);
    expect(screen.getByText("البحث وصرف المساعدات")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("ابحث بالاسم أو رقم الهوية أو الهاتف...")
    ).toBeInTheDocument();
    expect(screen.getByText("ابدأ البحث الآن")).toBeInTheDocument();
  });

  it("does not trigger search if search input has less than 2 characters", async () => {
    render(<SearchInterface />);
    const input = screen.getByPlaceholderText("ابحث بالاسم أو رقم الهوية أو الهاتف...");

    fireEvent.change(input, { target: { value: "أ" } });
    
    // Wait for debounce period (300ms)
    await act(async () => {
      await delay(400);
    });

    expect(mockFrom).not.toHaveBeenCalledWith("beneficiaries");
  });

  it("queries the beneficiaries and their transactions when typing 2 or more characters", async () => {
    // Setup Mock queries
    mockFrom.mockImplementation((table: string) => {
      if (table === "beneficiaries") {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({
            data: [
              {
                id: "b1-uuid",
                full_name: "أحمد محمد علي",
                identifier: "1234567890",
                family_size: 5,
                joined_at: "2026-06-01T00:00:00Z",
                aid_transactions: [], // no transaction in active cycle
              },
              {
                id: "b2-uuid",
                full_name: "خالد وليد حسن",
                identifier: "0987654321",
                family_size: 3,
                joined_at: "2026-06-02T00:00:00Z",
                aid_transactions: [
                  {
                    id: "tx-2",
                    received_at: "2026-06-10T12:00:00.000Z",
                    cycle_id: "cycle-1",
                  },
                ],
              },
            ],
            error: null,
          }),
        };
      }
      if (table === "distribution_cycles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "cycle-1" },
            error: null,
          }),
        };
      }
      return {};
    });

    render(<SearchInterface />);
    const input = screen.getByPlaceholderText("ابحث بالاسم أو رقم الهوية أو الهاتف...");

    // Type query
    fireEvent.change(input, { target: { value: "أحمد" } });
    
    // Wait for debounce period (300ms)
    await act(async () => {
      await delay(450);
    });

    // Verify search calls database
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("beneficiaries");
    });

    // Verify results show up
    expect(screen.getByText("أحمد محمد علي")).toBeInTheDocument();
    expect(screen.getByText("خالد وليد حسن")).toBeInTheDocument();

    // Verify badges and button states
    expect(screen.getByText("غير مستلم")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "تأكيد الصرف" });
    expect(confirmButton).toBeInTheDocument();

    expect(screen.getByText("مستلم")).toBeInTheDocument();
    expect(screen.getByText(/تم الصرف/)).toBeDisabled();
  });

  it("opens confirmation modal on clicking disbursement and updates state instantly upon confirming", async () => {
    // Setup Mock queries
    mockFrom.mockImplementation((table: string) => {
      if (table === "beneficiaries") {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({
            data: [
              {
                id: "b1-uuid",
                full_name: "أحمد محمد علي",
                identifier: "1234567890",
                family_size: 5,
                joined_at: "2026-06-01T00:00:00Z",
              },
            ],
            error: null,
          }),
        };
      }
      if (table === "distribution_cycles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "cycle-1" },
            error: null,
          }),
        };
      }
      if (table === "aid_transactions") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [], // empty transactions
            error: null,
          }),
          insert: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "t1-uuid",
              beneficiary_id: "b1-uuid",
              received_at: "2026-06-13T04:00:00.000Z",
              admin_id: "admin-uuid",
            },
            error: null,
          }),
        };
      }
      return {};
    });

    render(<SearchInterface />);
    const input = screen.getByPlaceholderText("ابحث بالاسم أو رقم الهوية أو الهاتف...");

    fireEvent.change(input, { target: { value: "أحمد" } });
    
    // Wait for debounce period (300ms)
    await act(async () => {
      await delay(450);
    });

    await waitFor(() => {
      expect(screen.getByText("أحمد محمد علي")).toBeInTheDocument();
    });

    // 1. Click "تأكيد الصرف"
    const confirmBtn = screen.getByRole("button", { name: "تأكيد الصرف" });
    fireEvent.click(confirmBtn);

    // 2. Assert Modal opens
    expect(screen.getByText("تأكيد صرف المساعدة")).toBeInTheDocument();
    expect(screen.getAllByText("أحمد محمد علي").length).toBe(2);

    // 3. Click Cancel in modal
    const cancelBtn = screen.getByRole("button", { name: "إلغاء" });
    fireEvent.click(cancelBtn);

    // Assert Modal closed
    expect(screen.queryByText("تأكيد صرف المساعدة")).not.toBeInTheDocument();

    // 4. Click "تأكيد الصرف" again, then click submit in modal
    fireEvent.click(screen.getByRole("button", { name: "تأكيد الصرف" }));
    const submitBtn = screen.getByRole("button", { name: "تأكيد وتسجيل الصرف" });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 5. Assert transaction is logged and state updates instantly to received
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("aid_transactions");
      expect(screen.queryByText("تأكيد صرف المساعدة")).not.toBeInTheDocument();
    });

    // Verify success toast/alert and card state turned to received
    expect(screen.getByText("تم صرف المساعدة بنجاح")).toBeInTheDocument();
    expect(screen.getByText("مستلم")).toBeInTheDocument();
    expect(screen.getByText(/تم الصرف/)).toBeDisabled();
  });

  it("saves the transaction to IndexedDB and updates the UI optimistically when offline", async () => {
    // Override useNetworkStatus mock to return offline state
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      syncOfflineData: vi.fn(),
      refreshPendingCount: vi.fn().mockResolvedValue(0),
      showToast: vi.fn(),
    });

    // Mock search API to return Ahmed and distribution cycles
    mockFrom.mockImplementation((table: string) => {
      if (table === "beneficiaries") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ahmed-uuid",
                  full_name: "أحمد محمد علي",
                  identifier: "1234567890",
                  family_size: 3,
                  joined_at: "2026-06-01T00:00:00.000Z",
                  aid_transactions: [], // Not yet received
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "distribution_cycles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "active-cycle-uuid" },
            error: null,
          }),
        };
      }
      return {};
    });

    render(<SearchInterface />);
    const input = screen.getByPlaceholderText("ابحث بالاسم أو رقم الهوية أو الهاتف...");

    fireEvent.change(input, { target: { value: "أحمد" } });

    // Wait for debounce period (300ms)
    await act(async () => {
      await delay(450);
    });

    await waitFor(() => {
      expect(screen.getByText("أحمد محمد علي")).toBeInTheDocument();
    });

    // 1. Click "تأكيد الصرف" to open modal
    fireEvent.click(screen.getByRole("button", { name: "تأكيد الصرف" }));

    // 2. Click "تأكيد وتسجيل الصرف" in modal
    const submitBtn = screen.getByRole("button", { name: "تأكيد وتسجيل الصرف" });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 3. Assert IndexedDB store was called with the transaction data
    await waitFor(() => {
      expect(mockSaveOfflineTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          beneficiary_id: "ahmed-uuid",
          admin_id: "00000000-0000-0000-0000-000000000000",
        })
      );
    });

    // 4. Assert optimistic UI update and offline toast
    expect(screen.getByText("تم الحفظ محلياً. ستتم المزامنة عند عودة الإنترنت")).toBeInTheDocument();
    expect(screen.getByText("مستلم")).toBeInTheDocument();
  });
});
