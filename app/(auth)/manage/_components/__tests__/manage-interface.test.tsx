import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { ManageInterface } from "../manage-interface";

// 1. Mock Supabase Client
const mockSelect = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

vi.mock("@/lib/supabase/client", () => {
  const queryResult = {
    data: [
      {
        id: "b-1",
        full_name: "أحمد محمد علي",
        identifier: "1234567890",
        phone: "01012345678",
        family_size: 5,
        joined_at: "2026-06-12",
      },
    ],
    count: 1,
    error: null,
  };

  const chain = {
    range: (...args: any[]) => {
      mockRange(...args);
      return Promise.resolve(queryResult);
    },
    then: (resolve: any) => Promise.resolve(queryResult).then(resolve),
    catch: (reject: any) => Promise.resolve(queryResult).catch(reject),
  };

  const orderChain = {
    order: (...args: any[]) => {
      mockOrder(...args);
      return chain;
    },
    then: (resolve: any) => Promise.resolve(queryResult).then(resolve),
    catch: (reject: any) => Promise.resolve(queryResult).catch(reject),
  };

  return {
    createClient: () => ({
      from: () => ({
        select: (...args: any[]) => {
          mockSelect(...args);
          return orderChain;
        },
        update: (...args: any[]) => {
          mockUpdate(...args);
          return {
            eq: (...args: any[]) => {
              mockEq(...args);
              return Promise.resolve({ error: null });
            },
          };
        },
        insert: (...args: any[]) => {
          mockInsert(...args);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
});

describe("ManageInterface Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders beneficiary list and supports opening the edit modal", async () => {
    render(<ManageInterface />);

    // Verify it loads and displays the beneficiary name
    await waitFor(() => {
      expect(screen.getAllByText("أحمد محمد علي")[0]).toBeInTheDocument();
    });

    // Find the edit button and click it
    const editBtn = screen.getAllByTitle("تعديل")[0];
    expect(editBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editBtn);
    });

    // Verify modal inputs are pre-filled
    expect(screen.getByPlaceholderText("مثال: أحمد محمد علي")).toHaveValue("أحمد محمد علي");
    expect(screen.getByPlaceholderText("مثال: 1234567890")).toHaveValue("1234567890");
    expect(screen.getByPlaceholderText("مثال: 01012345678")).toHaveValue("01012345678");
  });

  it("shows confirmation modal before updating beneficiary details", async () => {
    render(<ManageInterface />);

    await waitFor(() => {
      expect(screen.getAllByText("أحمد محمد علي")[0]).toBeInTheDocument();
    });

    // Open Edit Modal
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("تعديل")[0]);
    });

    // Change the name input value
    const nameInput = screen.getByPlaceholderText("مثال: أحمد محمد علي");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "محمود سعيد" } });
    });

    // Click save changes
    const saveBtn = screen.getByRole("button", { name: "حفظ التعديلات" });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify confirmation modal shows up with title
    expect(screen.getByText("تأكيد حفظ التعديلات")).toBeInTheDocument();
    expect(screen.getAllByText("أحمد محمد علي").length).toBe(3); // In desktop table, mobile card, and confirmation modal
    expect(screen.getByText("محمود سعيد")).toBeInTheDocument(); // New name

    // Verify update query hasn't been called yet
    expect(mockUpdate).not.toHaveBeenCalled();

    // Confirm save
    const confirmBtn = screen.getByRole("button", { name: "تأكيد التعديل" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Verify update API was called
    expect(mockUpdate).toHaveBeenCalledWith({
      full_name: "محمود سعيد",
      identifier: "1234567890",
      phone: "01012345678",
      family_size: 5,
    });
  });

  it("supports bulk printing of all beneficiaries", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(<ManageInterface />);

    const printBtn = screen.getByRole("button", { name: "طباعة كروت الجميع" });
    expect(printBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(printBtn);
    });

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled();
    });

    printSpy.mockRestore();
  });
});
