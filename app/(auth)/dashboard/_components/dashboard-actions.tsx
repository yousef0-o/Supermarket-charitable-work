"use client";

import { useState } from "react";
import {
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { exportToExcel } from "@/lib/excel-utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export function DashboardActions() {
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [toasts, setToasts] = useState<{ id: string; text: string; type: "success" | "error" }[]>([]);

  // Show Toast Helper
  const showToast = (text: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Export transactions to Excel
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const supabase = createClient();
      const allRows: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const fromIdx = page * pageSize;
        const toIdx = fromIdx + pageSize - 1;

        const { data, error } = await supabase
          .from("aid_transactions")
          .select("id, received_at, beneficiaries(full_name, identifier)")
          .order("received_at", { ascending: false })
          .range(fromIdx, toIdx);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          const pageRows = data.map((tx) => {
            let name = "غير معروف";
            let identifier = "—";

            if (tx.beneficiaries) {
              if (Array.isArray(tx.beneficiaries)) {
                name = tx.beneficiaries[0]?.full_name || name;
                identifier = tx.beneficiaries[0]?.identifier || identifier;
              } else {
                name = (tx.beneficiaries as any).full_name || name;
                identifier = (tx.beneficiaries as any).identifier || identifier;
              }
            }

            let formattedDate = tx.received_at;
            try {
              formattedDate = format(
                new Date(tx.received_at),
                "d MMMM yyyy - hh:mm a",
                { locale: ar }
              );
            } catch {
              // keep raw
            }

            return {
              "رقم العملية": tx.id,
              "اسم المستفيد": name,
              "رقم الهوية": identifier,
              "تاريخ الصرف": formattedDate,
            };
          });

          allRows.push(...pageRows);

          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      if (allRows.length === 0) {
        showToast("لا توجد عمليات صرف لتصديرها.", "error");
        return;
      }

      exportToExcel(allRows, `تقرير_التوزيعات_${new Date().toISOString().slice(0, 10)}`);
    } catch (err) {
      console.error("Export error:", err);
      showToast("فشل في تصدير التقرير. يرجى المحاولة مرة أخرى.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Reset distribution cycle
  const handleResetCycle = async () => {
    setIsResetting(true);
    try {
      const supabase = createClient();

      // Call the atomic reset_distribution_cycle RPC
      const { error } = await supabase.rpc("reset_distribution_cycle");

      if (error) throw error;

      setShowResetConfirm(false);

      // Reload the page to reflect new cycle stats
      window.location.reload();
    } catch (err) {
      console.error("Reset cycle error:", err);
      showToast("فشل في بدء دورة توزيع جديدة. يرجى المحاولة مرة أخرى.", "error");
    } finally {
      setIsResetting(false);
    }
  };


  return (
    <>
      {/* Toast Manager Overlay */}
      <div className="fixed top-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md pointer-events-auto transition-all ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-5 shrink-0 text-rose-600" />
            )}
            <span className="text-sm font-bold">{toast.text}</span>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="mr-auto text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Export Button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          <span>{isExporting ? "جاري التصدير..." : "تصدير التقارير"}</span>
        </button>


        {/* Reset Cycle Button */}
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
        >
          <RefreshCw className="size-4" />
          <span>بدء دورة توزيع جديدة</span>
        </button>
      </div>


      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !isResetting && setShowResetConfirm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="size-7" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-800">
              بدء دورة توزيع جديدة
            </h2>
            <p className="text-sm font-medium text-slate-500">
              سيتم إنشاء دورة توزيع جديدة. جميع المستفيدين سيصبحون مؤهلين
              لاستلام المساعدة مرة أخرى. السجلات السابقة ستبقى محفوظة
              للتقارير.
            </p>
            <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-100">
              ⚠️ هذا الإجراء لا يمكن التراجع عنه. تأكد من أن جميع عمليات الصرف
              للدورة الحالية قد اكتملت.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetCycle}
                disabled={isResetting}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-600/60"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>جاري التنفيذ...</span>
                  </>
                ) : (
                  <span>تأكيد بدء دورة جديدة</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


