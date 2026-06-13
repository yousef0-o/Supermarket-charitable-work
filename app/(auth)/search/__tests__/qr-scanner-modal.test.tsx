import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QRScannerModal } from "../_components/qr-scanner-modal";

let scanSuccessCallback: ((text: string) => void) | null = null;
let startPromiseResolve: (() => void) | null = null;
let startPromiseReject: ((err: any) => void) | null = null;

vi.mock("html5-qrcode", () => {
  class MockHtml5Qrcode {
    isScanning = true;
    start(facingMode: any, config: any, onSuccess: any) {
      scanSuccessCallback = onSuccess;
      return new Promise<void>((resolve, reject) => {
        startPromiseResolve = resolve;
        startPromiseReject = reject;
      });
    }
    stop() {
      return Promise.resolve();
    }
  }
  return {
    Html5Qrcode: MockHtml5Qrcode,
  };
});

// Mock Framer Motion
vi.mock("framer-motion", () => {
  const React = require("react");
  const motionDiv = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement("div", { ref, ...props }, children)
  );
  return {
    motion: { div: motionDiv },
    m: { div: motionDiv },
    AnimatePresence: ({ children }: any) => children,
  };
});

describe("QRScannerModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanSuccessCallback = null;
    startPromiseResolve = null;
    startPromiseReject = null;
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <QRScannerModal isOpen={false} onClose={vi.fn()} onScan={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders loader during camera initialization and handles scan success", async () => {
    const handleScan = vi.fn();
    const handleClose = vi.fn();

    render(
      <QRScannerModal isOpen={true} onClose={handleClose} onScan={handleScan} />
    );

    // Initial load state
    expect(screen.getByText(/يتم تشغيل الكاميرا/i)).toBeInTheDocument();

    // Wait for the dynamic import to complete and promise handlers to be populated
    await waitFor(() => {
      expect(startPromiseResolve).not.toBeNull();
    });

    // Resolve camera start promise
    await act(async () => {
      startPromiseResolve!();
    });

    // Verify loading state turns off and we display the HUD target
    await waitFor(() => {
      expect(screen.queryByText(/يتم تشغيل الكاميرا/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/ضع رمز QR الخاص بالمستفيد/i)).toBeInTheDocument();

    // Simulate scan success callback
    await act(async () => {
      scanSuccessCallback!("9876543210");
    });

    expect(handleScan).toHaveBeenCalledWith("9876543210");
  });

  it("displays error message if camera access fails", async () => {
    const handleClose = vi.fn();

    render(
      <QRScannerModal isOpen={true} onClose={handleClose} onScan={vi.fn()} />
    );

    // Wait for the dynamic import to complete and promise handlers to be populated
    await waitFor(() => {
      expect(startPromiseReject).not.toBeNull();
    });

    // Reject camera start promise to simulate failure
    await act(async () => {
      startPromiseReject!(new Error("Hardware error"));
    });

    // Verify error UI
    await waitFor(() => {
      expect(screen.getByText(/فشل الوصول إلى الكاميرا/i)).toBeInTheDocument();
    });
  });

  it("displays specific permission error message if camera permission is denied, and handles retry button click", async () => {
    const handleClose = vi.fn();

    render(
      <QRScannerModal isOpen={true} onClose={handleClose} onScan={vi.fn()} />
    );

    // Wait for the dynamic import to complete and promise handlers to be populated
    await waitFor(() => {
      expect(startPromiseReject).not.toBeNull();
    });

    // Reject camera start promise to simulate permission denied
    await act(async () => {
      const permissionErr = new Error("Permission denied");
      permissionErr.name = "NotAllowedError";
      startPromiseReject!(permissionErr);
    });

    // Verify permission error UI
    await waitFor(() => {
      expect(screen.getByText(/تم حظر الوصول للكاميرا. يرجى تفعيل الصلاحية/i)).toBeInTheDocument();
    });

    // Clear start promise reference
    startPromiseReject = null;

    // Click retry button
    const retryButton = screen.getByText("إعادة المحاولة");
    expect(retryButton).toBeInTheDocument();

    await act(async () => {
      retryButton.click();
    });

    // Verify it transitions back to loader / re-initializes
    expect(screen.getByText(/يتم تشغيل الكاميرا/i)).toBeInTheDocument();

    // Wait for the new start promise handler
    await waitFor(() => {
      expect(startPromiseResolve).not.toBeNull();
    });

    // Resolve camera start promise to verify normal recovery path
    await act(async () => {
      startPromiseResolve!();
    });

    // Verify scan HUD shows up again
    await waitFor(() => {
      expect(screen.getByText(/ضع رمز QR الخاص بالمستفيد/i)).toBeInTheDocument();
    });
  });
});
