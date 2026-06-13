import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { NetworkProvider, useNetworkStatus } from "../network-provider";

// 1. Mock Supabase Client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: { user: {} } },
  error: null,
});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

// 2. Mock Offline Store
const mockGetOfflineTransactions = vi.fn();
const mockDeleteOfflineTransaction = vi.fn();
vi.mock("@/lib/offline-store", () => ({
  getOfflineTransactions: () => mockGetOfflineTransactions(),
  deleteOfflineTransaction: (...args: any[]) => mockDeleteOfflineTransaction(...args),
}));

// Test consumer component
function TestConsumer() {
  const { isOnline, pendingCount, syncOfflineData } = useNetworkStatus();
  return (
    <div>
      <span data-testid="online-status">{isOnline ? "online" : "offline"}</span>
      <span data-testid="pending-count">{pendingCount}</span>
      <button data-testid="sync-btn" onClick={syncOfflineData}>
        Sync Now
      </button>
    </div>
  );
}

describe("NetworkProvider Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes online status and fetches pendingCount on mount", async () => {
    mockGetOfflineTransactions.mockResolvedValue([
      { id: "tx-1", beneficiary_id: "b1", admin_id: "a1", cycle_id: "c1", received_at: "t1" },
      { id: "tx-2", beneficiary_id: "b2", admin_id: "a1", cycle_id: "c1", received_at: "t2" },
    ]);

    const { getByTestId } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    expect(getByTestId("online-status")).toHaveTextContent("online");

    await waitFor(() => {
      expect(getByTestId("pending-count")).toHaveTextContent("2");
    });
  });

  it("handles postgres unique violation code 23505 as a success and deletes local record", async () => {
    // 1. Mock navigator to be offline on mount so no auto-sync is triggered
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    const transactions = [
      { id: "tx-1", beneficiary_id: "b1", admin_id: "admin-1", cycle_id: "cycle-1", received_at: "time-1" },
      { id: "tx-2", beneficiary_id: "b2", admin_id: "admin-1", cycle_id: "cycle-1", received_at: "time-2" },
    ];
    mockGetOfflineTransactions.mockResolvedValue(transactions);

    // 2. Mock insert: first one fails with 23505 (unique constraint), second one succeeds
    mockInsert
      .mockResolvedValueOnce({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      })
      .mockResolvedValueOnce({
        error: null,
      });

    // 3. Mock delete transaction to succeed
    mockDeleteOfflineTransaction.mockResolvedValue(undefined);

    const { getByTestId } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    // Verify it starts offline and no auto-sync insert has been executed
    expect(getByTestId("online-status")).toHaveTextContent("offline");
    expect(mockInsert).not.toHaveBeenCalled();

    // Click manual sync button
    const syncButton = getByTestId("sync-btn");
    await act(async () => {
      fireEventClick(syncButton);
    });

    // Verify both items were sent to insert on manual sync
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    // Verify both items were deleted from IndexedDB (first because of 23505, second because error is null)
    expect(mockDeleteOfflineTransaction).toHaveBeenCalledWith("tx-1");
    expect(mockDeleteOfflineTransaction).toHaveBeenCalledWith("tx-2");

    onlineSpy.mockRestore();
  });

  it("stops syncing and preserves IndexedDB items if session is expired", async () => {
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    mockGetOfflineTransactions.mockResolvedValue([
      { id: "tx-expired", beneficiary_id: "b1", admin_id: "a1", cycle_id: "c1", received_at: "t1" },
    ]);

    // Mock session as expired/missing
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const { getByTestId, queryByText } = render(
      <NetworkProvider>
        <TestConsumer />
      </NetworkProvider>
    );

    const syncButton = getByTestId("sync-btn");
    await act(async () => {
      fireEventClick(syncButton);
    });

    // Verify session getSession was called
    expect(mockGetSession).toHaveBeenCalled();

    // Verify no insert was called since session was missing
    expect(mockInsert).not.toHaveBeenCalled();

    // Verify offline transactions were NOT deleted
    expect(mockDeleteOfflineTransaction).not.toHaveBeenCalled();

    onlineSpy.mockRestore();
  });
});

// Helper for testing firing events cleanly
function fireEventClick(element: HTMLElement) {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}
