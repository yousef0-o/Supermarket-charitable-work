"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
  X,
  Sparkles,
  HelpCircle,
  TrendingUp,
  QrCode,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useNetworkStatus } from "@/components/providers/network-provider";
import { saveOfflineTransaction } from "@/lib/offline-store";
import { QRScannerModal } from "./qr-scanner-modal";

interface Beneficiary {
  id: string;
  full_name: string;
  identifier: string;
  phone: string | null;
  family_size: number;
  joined_at: string;
}

interface BeneficiaryWithStatus extends Beneficiary {
  hasReceived: boolean;
  receivedAt: string | null;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error";
}

export function SearchInterface() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [confirmingBeneficiary, setConfirmingBeneficiary] = useState<BeneficiaryWithStatus | null>(null);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { isOnline, refreshPendingCount } = useNetworkStatus();
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  // Show Toast helper
  const showToast = (text: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Fetch active cycle once on mount to avoid querying it on every keystroke
  useEffect(() => {
    const fetchActiveCycle = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("distribution_cycles")
          .select("id")
          .eq("is_active", true)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();
        if (data) {
          setActiveCycleId(data.id);
        }
      } catch (err) {
        console.error("Error fetching active cycle on mount:", err);
      }
    };
    const fetchUserRole = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setRole(user.user_metadata?.role || "manager");
        }
      } catch (err) {
        console.error("Error fetching user role on mount:", err);
      }
    };
    fetchActiveCycle();
    fetchUserRole();
  }, []);

  // Debouncing Query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Query beneficiaries & transaction status in 1 single nested query roundtrip
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.length < 2) {
        setBeneficiaries([]);
        setErrorText("");
        return;
      }

      setIsLoading(true);
      setErrorText("");

      try {
        const supabase = createClient();
        const cycleId = activeCycleId || "00000000-0000-0000-0000-000000000001";
        
        // 1. Single database roundtrip: search beneficiaries and fetch their matching cycle transactions in one go
        const { data: beneficiariesData, error: searchError } = await supabase
          .from("beneficiaries")
          .select(`
            id,
            full_name,
            identifier,
            phone,
            family_size,
            joined_at,
            aid_transactions(id, received_at, cycle_id)
          `)
          .or(`full_name.ilike.%${debouncedQuery}%,identifier.ilike.%${debouncedQuery}%,phone.ilike.%${debouncedQuery}%`);

        if (searchError) throw searchError;

        if (!beneficiariesData || beneficiariesData.length === 0) {
          setBeneficiaries([]);
          setIsLoading(false);
          return;
        }

        // 2. Map results directly, looking up the transaction that matches active cycleId
        const results: BeneficiaryWithStatus[] = beneficiariesData.map((b) => {
          const matchingTx = (b.aid_transactions || []).find(
            (tx: any) => tx.cycle_id === cycleId
          );
          return {
            id: b.id,
            full_name: b.full_name,
            identifier: b.identifier,
            phone: b.phone,
            family_size: b.family_size,
            joined_at: b.joined_at,
            hasReceived: !!matchingTx,
            receivedAt: matchingTx ? matchingTx.received_at : null,
          };
        });

        setBeneficiaries(results);
      } catch (err: any) {
        console.error("Search error:", err);
        setErrorText("حدث خطأ أثناء إجراء البحث. يرجى المحاولة مرة أخرى.");
        showToast("فشل في تحميل نتائج البحث", "error");
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, activeCycleId]);

  // Handle confirming disbursement
  const handleConfirmDisbursement = async () => {
    if (!confirmingBeneficiary) return;

    setIsDisbursing(true);
    try {
      const supabase = createClient();

      if (!isOnline) {
        // Offline Flow: Save to IndexedDB and optimistically update UI
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || "00000000-0000-0000-0000-000000000000";
        const cycleId = activeCycleId || "00000000-0000-0000-0000-000000000001";
        
        const tempTxId = (typeof window !== "undefined" && window.crypto?.randomUUID)
          ? window.crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15);

        const receivedAt = new Date().toISOString();

        await saveOfflineTransaction({
          id: tempTxId,
          beneficiary_id: confirmingBeneficiary.id,
          admin_id: userId,
          cycle_id: cycleId,
          received_at: receivedAt,
        });

        // Update pending count in header
        await refreshPendingCount();

        // Update state locally instantly (Optimistic UI)
        setBeneficiaries((prev) =>
          prev.map((b) =>
            b.id === confirmingBeneficiary.id
              ? { ...b, hasReceived: true, receivedAt: receivedAt }
              : b
          )
        );

        showToast("تم الحفظ محلياً. ستتم المزامنة عند عودة الإنترنت", "success");
        setConfirmingBeneficiary(null);
        return;
      }

      // Online Flow: Standard Supabase write
      // Retrieve current session/user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("غير مصرح لك بالقيام بهذا الإجراء. يرجى تسجيل الدخول.");
      }

      // Get active cycle
      const { data: activeCycle } = await supabase
        .from("distribution_cycles")
        .select("id")
        .eq("is_active", true)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      const cycleId = activeCycle?.id || "00000000-0000-0000-0000-000000000001";

      // Insert transaction log
      const { data: insertedTx, error: insertError } = await supabase
        .from("aid_transactions")
        .insert({
          beneficiary_id: confirmingBeneficiary.id,
          admin_id: user.id,
          cycle_id: cycleId,
        })
        .select()
        .single();

      if (insertError) {
        // Check if constraint is breached
        if (insertError.code === "23505") {
          throw new Error("عذراً، هذا المستفيد حصل بالفعل على مساعدة في هذه الدورة.");
        }
        throw insertError;
      }

      // Update state locally instantly
      setBeneficiaries((prev) =>
        prev.map((b) =>
          b.id === confirmingBeneficiary.id
            ? { ...b, hasReceived: true, receivedAt: insertedTx.received_at }
            : b
        )
      );

      showToast("تم صرف المساعدة بنجاح", "success");
      setConfirmingBeneficiary(null);
    } catch (err: any) {
      console.error("Disbursement error:", err);
      showToast(err.message || "حدث خطأ غير متوقع أثناء عملية الصرف", "error");
    } finally {
      setIsDisbursing(false);
    }
  };

  // Date Formatter
  const formatReceiptDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "d MMMM yyyy - hh:mm a", { locale: ar });
    } catch (e) {
      return dateStr;
    }
  };

  const getMonthNameArabic = () => {
    return format(new Date(), "MMMM", { locale: ar });
  };

  return (
    <LazyMotion features={domAnimation}>
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Toast Alert Container */}
      <div className="fixed top-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md ${
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
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="mr-auto text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="size-4" />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header Info */}
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Sparkles className="size-4.5" />
          </span>
          <h1 className="text-lg font-extrabold text-slate-800">البحث وصرف المساعدات</h1>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          ابحث عن المستفيد برقم الهوية أو الاسم، وتحقق من تاريخ أحدث صرف، وسجل الصرف للدورة الحالية ({getMonthNameArabic()}) فوراً.
        </p>
      </div>

      {/* Search Input Container */}
      <div className="relative">
        <label htmlFor="search-input" className="sr-only">
          ابحث بالاسم أو رقم الهوية أو الهاتف...
        </label>
        <div className="relative flex items-center">
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهوية أو الهاتف..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-14 text-right text-base text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
          />
          <Search className="absolute right-4 size-5 text-slate-400" />
          
          <div className="absolute left-3 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus:outline-none transition-colors"
                aria-label="مسح البحث"
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="rounded-full p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none transition-colors cursor-pointer"
              aria-label="مسح رمز QR"
              title="مسح رمز QR للمستفيد"
            >
              <QrCode className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorText && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {errorText}
        </div>
      )}

      {/* Results Section */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="size-8 animate-spin text-emerald-700" />
            <p className="mt-3 text-sm font-semibold">جاري البحث في قاعدة البيانات...</p>
          </div>
        ) : debouncedQuery.length < 2 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
            <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-inner">
              <Search className="size-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-700">ابدأ البحث الآن</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400 px-4">
              ادخل حرفين على الأقل للبحث عن المستفيد بالاسم الكامل أو رقم الهوية أو الهاتف المسجل.
            </p>
          </div>
        ) : beneficiaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
            <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users className="size-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-700">لم يتم العثور على نتائج</h3>
            <p className="mt-1 max-w-xs text-sm text-slate-400 px-4">
              لم نجد أي مستفيد يطابق &quot;{debouncedQuery}&quot;. تأكد من كتابة الاسم أو الرقم بشكل صحيح.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500">
                نتائج البحث عن: &quot;{debouncedQuery}&quot;
              </span>
              <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                {beneficiaries.length} {beneficiaries.length === 1 ? "مستفيد" : "مستفيدين"}
              </span>
            </div>

            <m.div layout className="grid gap-3">
              <AnimatePresence mode="popLayout">
                {beneficiaries.map((beneficiary) => (
                  <m.div
                    key={beneficiary.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className={`flex flex-col justify-between gap-4 rounded-xl border p-5 shadow-sm transition-all sm:flex-row sm:items-center ${
                      beneficiary.hasReceived
                        ? "border-rose-100 bg-rose-50/70"
                        : "border-emerald-100 bg-emerald-50/70"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {role === "cashier" ? (
                          <span
                            className={`text-base font-extrabold ${
                              beneficiary.hasReceived ? "text-rose-900" : "text-emerald-900"
                            }`}
                          >
                            {beneficiary.full_name}
                          </span>
                        ) : (
                          <Link
                            href={`/beneficiary/${beneficiary.id}`}
                            className={`text-base font-extrabold outline-none hover:underline focus-visible:ring-1 focus-visible:ring-emerald-700 ${
                              beneficiary.hasReceived ? "text-rose-900" : "text-emerald-900"
                            }`}
                          >
                            {beneficiary.full_name}
                          </Link>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold leading-none ${
                            beneficiary.hasReceived
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {beneficiary.hasReceived ? (
                            <>
                              <AlertCircle className="size-3 shrink-0" />
                              <span>مستلم</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-3 shrink-0" />
                              <span>غير مستلم</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="font-semibold text-slate-700">رقم الهوية:</span>{" "}
                          <span className="font-mono">{beneficiary.identifier}</span>
                        </span>
                        {beneficiary.phone && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-slate-700">رقم الهاتف:</span>{" "}
                            <span className="font-mono">{beneficiary.phone}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">أفراد الأسرة:</span>{" "}
                          <span>{beneficiary.family_size} {beneficiary.family_size >= 3 && beneficiary.family_size <= 10 ? "أفراد" : "فرد"}</span>
                        </span>
                      </div>

                      {beneficiary.hasReceived && beneficiary.receivedAt && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-rose-700">
                          <Calendar className="size-3.5 shrink-0" />
                          <span>تاريخ الاستلام:</span>
                          <span className="font-mono">{formatReceiptDate(beneficiary.receivedAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap sm:flex-nowrap">
                      {role !== "cashier" && (
                        <Link
                          href={`/beneficiary/${beneficiary.id}`}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-700"
                          title="عرض ملف المستفيد وإحصائياته"
                        >
                          <User className="size-3.5" />
                          <span>ملف المستفيد</span>
                        </Link>
                      )}

                      {beneficiary.hasReceived ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-100/50 px-4 text-xs font-bold text-rose-700 cursor-not-allowed opacity-80"
                        >
                          تم الصرف في هذه الدورة
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingBeneficiary(beneficiary)}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm outline-none transition-colors hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50"
                        >
                          تأكيد الصرف
                        </button>
                      )}
                    </div>
                  </m.div>
                ))}
              </AnimatePresence>
            </m.div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmingBeneficiary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDisbursing && setConfirmingBeneficiary(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <m.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <div className="flex flex-col items-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <TrendingUp className="size-6" />
                </span>

                <h2 id="modal-title" className="mt-4 text-lg font-extrabold text-slate-800">
                  تأكيد صرف المساعدة
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-500">
                  أنت على وشك تسجيل صرف المساعدة المالية الشهرية للمستفيد التالي لشهر{" "}
                  <span className="font-bold text-emerald-800">{getMonthNameArabic()}</span>.
                </p>

                {/* Beneficiary Details Panel */}
                <div className="mt-4 w-full rounded-lg bg-slate-50 p-4 text-right border border-slate-100">
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-xs font-bold text-slate-400">اسم المستفيد:</span>
                      <span className="text-sm font-extrabold text-slate-800">
                        {confirmingBeneficiary.full_name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-xs font-bold text-slate-400">رقم الهوية:</span>
                      <span className="text-sm font-bold font-mono text-slate-700">
                        {confirmingBeneficiary.identifier}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-slate-400">أفراد الأسرة:</span>
                      <span className="text-sm font-bold text-slate-700">
                        {confirmingBeneficiary.family_size} {confirmingBeneficiary.family_size >= 3 && confirmingBeneficiary.family_size <= 10 ? "أفراد" : "فرد"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex w-full gap-3">
                  <button
                    type="button"
                    disabled={isDisbursing}
                    onClick={handleConfirmDisbursement}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm outline-none transition-colors hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
                  >
                    {isDisbursing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>جاري التسجيل...</span>
                      </>
                    ) : (
                      <span>تأكيد وتسجيل الصرف</span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isDisbursing}
                    onClick={() => setConfirmingBeneficiary(null)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scannedText) => {
          setQuery(scannedText);
          setIsScannerOpen(false);
          showToast("تم قراءة رمز QR بنجاح", "success");
        }}
      />
    </div>
    </LazyMotion>
  );
}
