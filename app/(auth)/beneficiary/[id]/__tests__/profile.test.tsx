import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BeneficiaryProfilePage from "../page";

// 1. Mock supabase server client
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// 2. Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND_TRIGGERED");
  },
}));

// 3. Mock Framer Motion
vi.mock("framer-motion", () => {
  const React = require("react");
  const motionDiv = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement("div", { ref, ...props }, children)
  );
  const motion = { div: motionDiv };
  const m = { div: motionDiv };
  const LazyMotion = ({ children }: any) => children;
  const domAnimation = {};
  return { motion, m, LazyMotion, domAnimation };
});

describe("BeneficiaryProfilePage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze time to June 13, 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-13T04:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws notFound error when beneficiary is not found in database", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "beneficiaries") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Not Found"),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
    });

    const paramsPromise = Promise.resolve({ id: "non-existent-uuid" });

    await expect(
      BeneficiaryProfilePage({ params: paramsPromise })
    ).rejects.toThrow("NOT_FOUND_TRIGGERED");
  });

  it("calculates and displays correct statistics cards with history when beneficiary has received aid", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "beneficiaries") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "b-uuid",
              full_name: "سليم محمد علي",
              identifier: "9876543210",
              phone: "9876543210",
              family_size: 4,
              joined_at: "2026-05-01T00:00:00.000Z",
            },
            error: null,
          }),
        };
      }
      if (table === "aid_transactions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "t2-uuid",
                beneficiary_id: "b-uuid",
                received_at: "2026-06-10T03:00:00.000Z", // 3 days ago from system time (June 13)
                admin_id: "admin-uuid",
              },
              {
                id: "t1-uuid",
                beneficiary_id: "b-uuid",
                received_at: "2026-05-10T12:00:00.000Z", // Earliest first package
                admin_id: "admin-uuid",
              },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    const paramsPromise = Promise.resolve({ id: "b-uuid" });
    const element = await BeneficiaryProfilePage({ params: paramsPromise });
    render(element);

    // Profile Details assertion
    expect(screen.getByRole("heading", { name: "سليم محمد علي", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("9876543210")[0]).toBeInTheDocument();
    expect(screen.getByText("4 أفراد")).toBeInTheDocument();

    // Stats calculations assertions
    // 1. Total Aid count
    expect(screen.getByText("إجمالي الاستلامات")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // Count = 2

    // 2. Earliest Date (10 May 2026)
    expect(screen.getByText("تاريخ أول مساعدة")).toBeInTheDocument();
    expect(screen.getByText("10 مايو 2026")).toBeInTheDocument();

    // 3. Days since last (June 13 - June 10 = 3 days)
    expect(screen.getByText("أيام منذ آخر استلام")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // Days = 3
  });

  it("handles beneficiary with no transactions gracefully", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "beneficiaries") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "b-uuid",
              full_name: "ياسر محمود",
              identifier: "5555555555",
              phone: null,
              family_size: 1,
              joined_at: "2026-06-01T00:00:00.000Z",
            },
            error: null,
          }),
        };
      }
      if (table === "aid_transactions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [], // No history
            error: null,
          }),
        };
      }
      return {};
    });

    const paramsPromise = Promise.resolve({ id: "b-uuid" });
    const element = await BeneficiaryProfilePage({ params: paramsPromise });
    render(element);

    expect(screen.getByRole("heading", { name: "ياسر محمود", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("1 فرد")).toBeInTheDocument();

    // Assert stats for no transaction
    expect(screen.getByText("0")).toBeInTheDocument(); // Count = 0
    expect(screen.getByText("لم يستلم بعد")).toBeInTheDocument(); // First date
    expect(screen.getByText("لا يوجد")).toBeInTheDocument(); // Days last

    // History Log empty state assertion
    expect(screen.getByText("لا توجد عمليات صرف")).toBeInTheDocument();
  });
});
