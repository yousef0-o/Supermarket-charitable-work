import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QRCard } from "../_components/qr-card";

// Mock window.print
const originalPrint = window.print;

describe("QRCard Component", () => {
  beforeEach(() => {
    window.print = vi.fn();
  });

  afterEach(() => {
    window.print = originalPrint;
  });

  it("renders QR Card with beneficiary details and triggers print", () => {
    render(
      <QRCard
        identifier="123456789"
        fullName="سعيد محمد أحمد"
        familySize={5}
      />
    );

    // Assert name, identifier and family size render correctly
    expect(screen.getByText("سعيد محمد أحمد")).toBeInTheDocument();
    expect(screen.getByText("123456789")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // Verify Print Button works
    const printButton = screen.getByRole("button", { name: /طباعة الكارت/i });
    expect(printButton).toBeInTheDocument();
    fireEvent.click(printButton);
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
