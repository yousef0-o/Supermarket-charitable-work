"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle, Loader2 } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => void;
}

export function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const scannerRef = useRef<any>(null);

  const handleRetry = () => {
    setErrorText(null);
    setIsInitializing(true);
    setRetryTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setErrorText(null);
    setIsInitializing(true);

    // Dynamically load html5-qrcode to prevent SSR node failures
    import("html5-qrcode")
      .then(({ Html5Qrcode }) => {
        if (!isMounted) return;

        const elementId = "qr-reader-container";
        const container = document.getElementById(elementId);
        if (!container) return;

        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        html5QrCode
          .start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              },
            },
            (decodedText) => {
              if (isMounted) {
                onScan(decodedText);
              }
            },
            () => {
              // Silent check logs during scanner scan loop
            }
          )
          .then(() => {
            if (isMounted) {
              setIsInitializing(false);
            } else {
              // Component has unmounted while starting! We must immediately stop it!
              if (html5QrCode.isScanning) {
                html5QrCode.stop().catch((e: any) => console.error("Error stopping on unmount delay:", e));
              }
            }
          })
          .catch((err) => {
            console.error("Camera start error:", err);
            if (isMounted) {
              const errMsg = err?.toString() || "";
              const isPermissionError =
                err?.name === "NotAllowedError" ||
                err?.name === "PermissionDeniedError" ||
                errMsg.toLowerCase().includes("denied") ||
                errMsg.toLowerCase().includes("permission") ||
                errMsg.toLowerCase().includes("block") ||
                errMsg.toLowerCase().includes("notallowed");

              if (isPermissionError) {
                setErrorText("تم حظر الوصول للكاميرا. يرجى تفعيل الصلاحية من إعدادات المتصفح ثم المحاولة مرة أخرى.");
              } else {
                setErrorText("فشل الوصول إلى الكاميرا. يرجى التأكد من توفر كاميرا وتفعيل صلاحيات الكاميرا.");
              }
              setIsInitializing(false);
            }
          });
      })
      .catch((err) => {
        console.error("Failed to load html5-qrcode:", err);
        if (isMounted) {
          setErrorText("حدث خطأ أثناء تحميل مكتبة مسح الأكواد.");
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
      const html5QrCode = scannerRef.current;
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode
            .stop()
            .then(() => {
              // Scanner stopped successfully
            })
            .catch((err: any) => {
              console.error("Error stopping scanner on unmount:", err);
            });
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan, retryTrigger]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <m.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ direction: "rtl" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
            <div className="flex items-center gap-2 text-emerald-800">
              <Camera className="size-5" />
              <h3 className="text-base font-extrabold text-slate-800">مسح رمز الاستجابة السريعة (QR)</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Scanner Area */}
          <div className="p-6 flex flex-col items-center justify-center">
            {errorText ? (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-800 w-full">
                <AlertCircle className="size-10 text-rose-600" />
                <p className="text-sm font-bold">{errorText}</p>
                <div className="flex gap-2 w-full justify-center">
                  <button
                    onClick={handleRetry}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                  <button
                    onClick={onClose}
                    className="text-xs font-bold bg-white text-rose-800 border border-rose-200 px-4 py-2 rounded-lg hover:bg-rose-100 transition-colors shadow-sm cursor-pointer"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full aspect-square max-w-[280px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
                {/* Live Feed Container */}
                <div id="qr-reader-container" className="absolute inset-0 w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

                {/* Loading / Startup state */}
                {isInitializing && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 text-slate-400 space-y-3 p-4 text-center">
                    <Loader2 className="size-8 text-emerald-500 animate-spin" />
                    <p className="text-xs font-bold">يتم تشغيل الكاميرا وطلب الصلاحية...</p>
                  </div>
                )}

                {/* Scan box HUD overlay */}
                {!isInitializing && (
                  <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                    {/* Pulsing Green Corner Indicators */}
                    <div className="relative size-[180px] border-2 border-emerald-500/20 rounded-lg">
                      <div className="absolute top-0 right-0 size-4 border-t-4 border-r-4 border-emerald-500 rounded-tr" />
                      <div className="absolute top-0 left-0 size-4 border-t-4 border-l-4 border-emerald-500 rounded-tl" />
                      <div className="absolute bottom-0 right-0 size-4 border-b-4 border-r-4 border-emerald-500 rounded-br" />
                      <div className="absolute bottom-0 left-0 size-4 border-b-4 border-l-4 border-emerald-500 rounded-bl" />
                      
                      {/* Laser Line Animation */}
                      <div className="w-full h-0.5 bg-emerald-500 absolute top-0 left-0 animate-[bounce_2s_infinite] opacity-80 shadow-[0_0_8px_rgba(16,185,129,1)]" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!errorText && (
              <div className="mt-4 text-center space-y-1">
                <p className="text-xs font-bold text-slate-600">
                  ضع رمز QR الخاص بالمستفيد داخل المربع
                </p>
                <p className="text-[10px] text-slate-400 font-semibold">
                  سيتم التعرف على الرمز وتوجيهك فوراً
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors focus:outline-none cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
