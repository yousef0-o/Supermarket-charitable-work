import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuthHeader } from "../auth-header";

// 1. Mock supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

// 2. Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

// 3. Mock Network Status
const mockUseNetworkStatus = vi.fn();
vi.mock("@/components/providers/network-provider", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

describe("AuthHeader Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render 'Sync Now' button when offline, even if pending transactions exist", () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      pendingCount: 3,
      syncOfflineData: vi.fn(),
    });

    render(<AuthHeader />);

    // Assert offline indicator is shown
    expect(screen.getByText("غير متصل - حفظ محلي")).toBeInTheDocument();

    // Assert "Sync Now" button is NOT rendered
    expect(screen.queryByText(/مزامنة الآن/)).not.toBeInTheDocument();
  });

  it("does not render 'Sync Now' button when online and pendingCount is 0", () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncOfflineData: vi.fn(),
    });

    render(<AuthHeader />);

    // Assert online indicator is shown
    expect(screen.getByText("متصل بالشبكة")).toBeInTheDocument();

    // Assert "Sync Now" button is NOT rendered
    expect(screen.queryByText(/مزامنة الآن/)).not.toBeInTheDocument();
  });

  it("renders 'Sync Now' button when online and pendingCount > 0, and triggers sync when clicked", async () => {
    const mockSyncOfflineData = vi.fn().mockResolvedValue(undefined);
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      pendingCount: 5,
      syncOfflineData: mockSyncOfflineData,
    });

    render(<AuthHeader />);

    // Assert online indicator is shown
    expect(screen.getByText("متصل بالشبكة")).toBeInTheDocument();

    // Assert "Sync Now" button is rendered with the correct count
    const syncButton = screen.getByRole("button", { name: "مزامنة الآن (5)" });
    expect(syncButton).toBeInTheDocument();

    // Click the button
    fireEvent.click(syncButton);

    // Verify loading state and sync action call
    expect(syncButton).toBeDisabled();
    expect(mockSyncOfflineData).toHaveBeenCalledTimes(1);

    // Wait for the sync to complete and loading state to reset
    await waitFor(() => {
      expect(syncButton).not.toBeDisabled();
    });
  });
});
