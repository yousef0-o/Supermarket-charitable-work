"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getOfflineTransactions,
  deleteOfflineTransaction,
} from "@/lib/offline-store";

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error";
}

interface NetworkContextType {
  isOnline: boolean;
  pendingCount: number;
  syncOfflineData: () => Promise<void>;
  refreshPendingCount: () => Promise<number>;
  showToast: (text: string, type: "success" | "error") => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const refreshPendingCount = async () => {
    try {
      const txs = await getOfflineTransactions();
      setPendingCount(txs.length);
      return txs.length;
    } catch (err) {
      console.error("Error refreshing pending count:", err);
      return 0;
    }
  };

  const syncOfflineData = async () => {
    try {
      const offlineTxs = await getOfflineTransactions();
      if (offlineTxs.length === 0) {
        await refreshPendingCount();
        return;
      }

      const supabase = createClient();

      // Check session state before syncing
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        showToast("انتهت الجلسة. يرجى تسجيل الدخول مجدداً لمزامنة البيانات المحفوظة.", "error");
        await refreshPendingCount();
        return;
      }

      let successCount = 0;
      let collisionCount = 0;

      // Process sequentially using a for...of loop to prevent connection pool exhaustion
      for (const tx of offlineTxs) {
        const { error } = await supabase.from("aid_transactions").insert({
          beneficiary_id: tx.beneficiary_id,
          admin_id: tx.admin_id,
          cycle_id: tx.cycle_id,
          received_at: tx.received_at,
        });

        // Code 23505 represents unique key violation (already disbursed).
        // We treat it as success and clear it from local IndexedDB queue.
        if (!error) {
          await deleteOfflineTransaction(tx.id);
          successCount++;
        } else if (error.code === "23505") {
          await deleteOfflineTransaction(tx.id);
          collisionCount++;
        } else {
          console.error("Failed to sync transaction ID:", tx.id, error);
        }
      }

      await refreshPendingCount();

      if (successCount > 0) {
        showToast(`تمت مزامنة ${successCount} من عمليات الصرف المحفوظة تلقائياً.`, "success");
      }
      if (collisionCount > 0) {
        showToast(`تم تخطي ${collisionCount} عمليات مسجلة مسبقاً بنجاح.`, "success");
      }
    } catch (err) {
      console.error("Error during offline sync:", err);
      await refreshPendingCount();
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(window.navigator.onLine);
      refreshPendingCount();

      // Register Service Worker for PWA
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js")
          .then((reg) => console.log("Service Worker registered with scope:", reg.scope))
          .catch((err) => console.error("Service Worker registration failed:", err));
      }

      const handleOnline = () => {
        setIsOnline(true);
        showToast("عادت التغطية. جار مزامنة العمليات المحفوظة محلياً...", "success");
        syncOfflineData();
      };

      const handleOffline = () => {
        setIsOnline(false);
        showToast("انقطع الاتصال بالإنترنت. سيتم حفظ العمليات محلياً وتلقائياً.", "error");
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Run sync on mount if online
      if (window.navigator.onLine) {
        syncOfflineData();
      }

      // Check IndexedDB periodically to keep components in sync
      const interval = setInterval(() => {
        refreshPendingCount();
      }, 5000);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        clearInterval(interval);
      };
    }
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        pendingCount,
        syncOfflineData,
        refreshPendingCount,
        showToast,
      }}
    >
      {children}

      {/* Toast Manager Overlay */}
      <div className="fixed top-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold shadow-md pointer-events-auto transition-all duration-300 ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-amber-600 text-white"
            }`}
          >
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetworkStatus must be used within a NetworkProvider");
  }
  return context;
}
