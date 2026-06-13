import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardPage from "../page";

// 1. Mock supabase server client
const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

// 2. Mock Recharts to avoid layout sizing errors in JSDOM
vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: any) =>
      React.createElement("div", null, children),
    BarChart: ({ children, data }: any) =>
      React.createElement(
        "div",
        { "data-testid": "bar-chart", "data-data": JSON.stringify(data) },
        children
      ),
    Bar: () => React.createElement("div", null),
    XAxis: () => React.createElement("div", null),
    YAxis: () => React.createElement("div", null),
    CartesianGrid: () => React.createElement("div", null),
    Tooltip: () => React.createElement("div", null),
  };
});

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

// 4. Mock xlsx (used by DashboardActions)
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

describe("DashboardPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockQueries = () => {
    mockFrom.mockImplementation((table: string) => {
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
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "tx-1",
                  received_at: "2026-06-11T12:00:00.000Z",
                  beneficiaries: { full_name: "أحمد بن علي" },
                },
                {
                  id: "tx-2",
                  received_at: "2026-06-10T10:00:00.000Z",
                  beneficiaries: { full_name: "سليم محمد" },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_dashboard_stats") {
        return Promise.resolve({
          data: {
            totalBeneficiaries: 10,
            totalDistributions: 25,
            cycleDistributions: 6,
            remaining: 4,
            chartData: [
              { month_index: 1, year: 2026, count: 3 },
              { month_index: 2, year: 2026, count: 5 },
              { month_index: 3, year: 2026, count: 4 },
              { month_index: 4, year: 2026, count: 7 },
              { month_index: 5, year: 2026, count: 2 },
              { month_index: 6, year: 2026, count: 6 },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  };

  it("renders dashboard with RPC stats and displays KPI cards correctly", async () => {
    setupMockQueries();

    const element = await DashboardPage();
    render(element);

    // Assert headers
    expect(screen.getByText("لوحة التحكم والتقارير")).toBeInTheDocument();

    // Assert KPI Card labels
    expect(screen.getByText("إجمالي المستفيدين")).toBeInTheDocument();
    expect(screen.getByText("إجمالي التوزيعات")).toBeInTheDocument();
    expect(screen.getByText("توزيعات الدورة الحالية")).toBeInTheDocument();
    expect(screen.getByText("لم يستلموا بعد")).toBeInTheDocument();

    // Assert KPI Card values
    expect(screen.getByText("10")).toBeInTheDocument(); // total beneficiaries
    expect(screen.getByText("25")).toBeInTheDocument(); // total distributions
    expect(screen.getByText("6")).toBeInTheDocument(); // cycle distributions
    expect(screen.getByText("4")).toBeInTheDocument(); // remaining

    // Assert chart section renders (dynamically loaded, shows loading placeholder in SSR test)
    expect(screen.getByText("اتجاه التوزيع الشهري")).toBeInTheDocument();

    // Assert Live Feed
    expect(screen.getByText("أحمد بن علي")).toBeInTheDocument();
    expect(screen.getByText("سليم محمد")).toBeInTheDocument();

    // Assert action buttons are rendered
    expect(screen.getByText("تصدير التقارير")).toBeInTheDocument();
    expect(screen.getByText("بدء دورة توزيع جديدة")).toBeInTheDocument();
  });


  it("paginates and retrieves all rows sequentially in chunks of 1000 during export", async () => {
    setupMockQueries();

    // Reset and override mockFrom for this specific export pagination test
    const mockRange = vi.fn();
    const mockLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "tx-1",
          received_at: "2026-06-11T12:00:00.000Z",
          beneficiaries: { full_name: "أحمد بن علي" },
        },
      ],
      error: null,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange, limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

    // Mock two chunks of data:
    // Page 0 (0-999): 1000 rows
    // Page 1 (1000-1999): 5 rows (less than 1000, so loop finishes)
    const page1Data = Array.from({ length: 1000 }, (_, i) => ({
      id: `tx-${i}`,
      received_at: "2026-06-11T12:00:00.000Z",
      beneficiaries: { full_name: `Beneficiary ${i}`, identifier: `id-${i}` },
    }));

    const page2Data = Array.from({ length: 5 }, (_, i) => ({
      id: `tx-1000-${i}`,
      received_at: "2026-06-10T10:00:00.000Z",
      beneficiaries: { full_name: `Beneficiary 1000-${i}`, identifier: `id-1000-${i}` },
    }));

    mockRange
      .mockResolvedValueOnce({ data: page1Data, error: null })
      .mockResolvedValueOnce({ data: page2Data, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "aid_transactions") {
        return { select: mockSelect };
      }
      // other tables fallback
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const element = await DashboardPage();
    render(element);

    const exportButton = screen.getByText("تصدير التقارير");
    expect(exportButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(exportButton);
    });

    // Check that range was called twice for pagination
    expect(mockRange).toHaveBeenCalledTimes(2);
    expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);

    // Verify xlsx writer was invoked
    const xlsx = await import("xlsx");
    expect(xlsx.utils.json_to_sheet).toHaveBeenCalled();
    const sheetData = (xlsx.utils.json_to_sheet as any).mock.calls[0][0];
    expect(sheetData).toHaveLength(1005);
    expect(sheetData[0]["اسم المستفيد"]).toBe("Beneficiary 0");
    expect(sheetData[1004]["اسم المستفيد"]).toBe("Beneficiary 1000-4");
  });

  it("displays reset cycle confirmation modal and calls reset_distribution_cycle RPC on confirm", async () => {
    setupMockQueries();

    // Mock window.location.reload
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;

    const element = await DashboardPage();
    render(element);

    const resetButton = screen.getByText("بدء دورة توزيع جديدة");
    expect(resetButton).toBeInTheDocument();

    // Open confirmation modal
    fireEvent.click(resetButton);

    expect(
      screen.getByText(/سيتم إنشاء دورة توزيع جديدة. جميع المستفيدين سيصبحون مؤهلين/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/⚠️ هذا الإجراء لا يمكن التراجع عنه. تأكد من أن جميع عمليات الصرف/i)
    ).toBeInTheDocument();

    // Confirm resetting
    const confirmButton = screen.getByText("تأكيد بدء دورة جديدة");
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockRpc).toHaveBeenCalledWith("reset_distribution_cycle");
    expect(window.location.reload).toHaveBeenCalled();

    // Restore window.location
    (window as any).location = originalLocation;
  });
});
