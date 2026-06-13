"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  FileSpreadsheet,
  User,
  Printer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseExcelFile, type BeneficiaryImportRow } from "@/lib/excel-utils";
import { QRCodeSVG } from "qrcode.react";

interface Beneficiary {
  id: string;
  full_name: string;
  identifier: string;
  phone: string | null;
  family_size: number;
  joined_at: string;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error";
}

const PAGE_SIZE = 20;

export function ManageInterface() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingBeneficiary, setEditingBeneficiary] =
    useState<Beneficiary | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    identifier: "",
    phone: "",
    family_size: "1",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirm state
  const [deletingBeneficiary, setDeletingBeneficiary] =
    useState<Beneficiary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  // Fetch paginated beneficiaries
  const fetchBeneficiaries = useCallback(
    async (page: number) => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // Fetch paginated data and the total count in a single query
        const { data, count, error } = await supabase
          .from("beneficiaries")
          .select("*", { count: "exact" })
          .order("joined_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        setTotalCount(count || 0);
        setBeneficiaries(data || []);
      } catch (err: any) {
        console.error("Fetch error:", err);
        showToast("فشل في تحميل بيانات المستفيدين", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchBeneficiaries(currentPage);
  }, [currentPage, fetchBeneficiaries]);

  const handlePrintAllCards = async () => {
    setIsPrintingAll(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("beneficiaries")
        .select("*")
        .order("joined_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        showToast("لا يوجد مستفيدين لطباعة كروت لهم", "error");
        setIsPrintingAll(false);
        return;
      }

      setAllBeneficiaries(data);

      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err: any) {
      console.error("Fetch all beneficiaries error:", err);
      showToast("فشل في تحميل بيانات المستفيدين للطباعة", "error");
      setIsPrintingAll(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const handleAfterPrint = () => {
      setIsPrintingAll(false);
      setAllBeneficiaries([]);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Open add modal
  const openAddModal = () => {
    setFormData({ full_name: "", identifier: "", phone: "", family_size: "1" });
    setFormErrors({});
    setEditingBeneficiary(null);
    setModalMode("add");
  };

  // Open edit modal
  const openEditModal = (b: Beneficiary) => {
    setFormData({
      full_name: b.full_name,
      identifier: b.identifier,
      phone: b.phone || "",
      family_size: b.family_size.toString(),
    });
    setFormErrors({});
    setEditingBeneficiary(b);
    setModalMode("edit");
  };

  // Edit confirmation modal state
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = "الاسم الكامل مطلوب";
    if (!formData.identifier.trim())
      errors.identifier = "رقم الهوية الوطنية مطلوب";
    if (!formData.phone.trim())
      errors.phone = "رقم الهاتف مطلوب";
    const fs = parseInt(formData.family_size, 10);
    if (isNaN(fs) || fs < 1) errors.family_size = "عدد أفراد الأسرة غير صالح";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Intercept save click to prompt confirmation if editing
  const handleSave = () => {
    if (!validateForm()) return;
    if (modalMode === "edit" && editingBeneficiary) {
      setShowEditConfirm(true);
    } else {
      executeSave();
    }
  };

  // Execute save (add or edit after confirmation)
  const executeSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const payload = {
        full_name: formData.full_name.trim(),
        identifier: formData.identifier.trim(),
        phone: formData.phone.trim(),
        family_size: parseInt(formData.family_size, 10),
      };

      if (modalMode === "add") {
        const { error } = await supabase
          .from("beneficiaries")
          .insert(payload);

        if (error) {
          if (error.code === "23505") {
            setFormErrors({
              identifier: "رقم الهوية مسجل مسبقاً لمستفيد آخر.",
            });
            return;
          }
          throw error;
        }
        showToast("تمت إضافة المستفيد بنجاح");
      } else if (modalMode === "edit" && editingBeneficiary) {
        const { error } = await supabase
          .from("beneficiaries")
          .update(payload)
          .eq("id", editingBeneficiary.id);

        if (error) {
          if (error.code === "23505") {
            setFormErrors({
              identifier: "رقم الهوية مسجل مسبقاً لمستفيد آخر.",
            });
            return;
          }
          throw error;
        }
        showToast("تم تعديل بيانات المستفيد بنجاح");
      }

      setModalMode(null);
      fetchBeneficiaries(currentPage);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast(err.message || "حدث خطأ أثناء حفظ البيانات", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingBeneficiary) return;
    setIsDeleting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("beneficiaries")
        .delete()
        .eq("id", deletingBeneficiary.id);

      if (error) throw error;

      showToast("تم حذف المستفيد بنجاح");
      setDeletingBeneficiary(null);

      // If deleting the last item on the page, go back one page
      if (beneficiaries.length === 1 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else {
        fetchBeneficiaries(currentPage);
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast("فشل في حذف المستفيد", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Excel import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportErrors([]);

    try {
      const result = await parseExcelFile(file);

      if (result.errors.length > 0) {
        setImportErrors(result.errors);
      }

      if (result.data.length === 0) {
        if (result.errors.length === 0) {
          showToast("الملف لا يحتوي على بيانات صالحة", "error");
        }
        return;
      }

      // Bulk insert
      const supabase = createClient();
      const { error } = await supabase
        .from("beneficiaries")
        .insert(result.data);

      if (error) {
        if (error.code === "23505") {
          showToast(
            "بعض السجلات تحتوي على أرقام هوية مكررة ولم يتم إضافتها",
            "error"
          );
        } else {
          throw error;
        }
      } else {
        showToast(`تمت إضافة ${result.data.length} مستفيد بنجاح من الملف`);
      }

      fetchBeneficiaries(1);
      setCurrentPage(1);
    } catch (err: any) {
      console.error("Import error:", err);
      showToast(err.message || "فشل في استيراد الملف", "error");
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Container */}
      <div className="fixed top-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md transition-all ${
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

      {/* Action Buttons Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>إضافة مستفيد</span>
          </button>

          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            {isImporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            <span>{isImporting ? "جاري الاستيراد..." : "استيراد من Excel"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handlePrintAllCards}
            disabled={isPrintingAll}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPrintingAll ? (
              <Loader2 className="size-4 animate-spin text-emerald-700" />
            ) : (
              <Printer className="size-4 text-emerald-700" />
            )}
            <span>طباعة كروت الجميع</span>
          </button>
        </div>

        <div className="text-sm font-bold text-slate-500 self-start sm:self-auto">
          إجمالي المستفيدين:{" "}
          <span className="font-mono text-slate-800">{totalCount}</span>
        </div>
      </div>

      {/* Import Errors */}
      {importErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          <p className="text-sm font-bold text-amber-800">
            تحذيرات أثناء الاستيراد:
          </p>
          {importErrors.slice(0, 10).map((err, i) => (
            <p key={i} className="text-xs font-medium text-amber-700">
              • {err}
            </p>
          ))}
          {importErrors.length > 10 && (
            <p className="text-xs font-bold text-amber-600">
              ... و {importErrors.length - 10} تحذيرات أخرى
            </p>
          )}
          <button
            type="button"
            onClick={() => setImportErrors([])}
            className="mt-2 text-xs font-bold text-amber-800 underline"
          >
            إغلاق التحذيرات
          </button>
        </div>
      )}

      {/* Table - Desktop and Landscape iPad only */}
      <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  الاسم الكامل
                </th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  رقم الهوية
                </th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  رقم الهاتف
                </th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  عدد الأفراد
                </th>
                <th className="px-5 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <Loader2 className="mx-auto size-7 animate-spin text-emerald-700" />
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      جاري تحميل البيانات...
                    </p>
                  </td>
                </tr>
              ) : beneficiaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <Users className="size-10" />
                      <p className="mt-2 text-sm font-bold text-slate-600">
                        لا يوجد مستفيدين بعد
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        أضف مستفيدين يدوياً أو استورد ملف Excel.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                beneficiaries.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-slate-50 transition-colors hover:bg-slate-50/60 last:border-b-0"
                  >
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      <Link
                        href={`/beneficiary/${b.id}`}
                        className="hover:underline hover:text-emerald-800 outline-none transition-colors"
                      >
                        {b.full_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {b.identifier}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {b.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {b.family_size}{" "}
                      {b.family_size >= 3 && b.family_size <= 10
                        ? "أفراد"
                        : "فرد"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/beneficiary/${b.id}`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-emerald-700 cursor-pointer"
                          title="عرض ملف المستفيد وإحصائياته"
                        >
                          <User className="size-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(b)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-emerald-700 cursor-pointer"
                          title="تعديل"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBeneficiary(b)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            <span className="text-xs font-bold text-slate-500">
              صفحة {currentPage} من {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cards View - Mobile and Portrait iPad (< 1024px) */}
      <div className="lg:hidden space-y-4">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <Loader2 className="mx-auto size-7 animate-spin text-emerald-700" />
            <p className="mt-2 text-sm font-semibold text-slate-500">
              جاري تحميل البيانات...
            </p>
          </div>
        ) : beneficiaries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-14 text-center text-slate-400">
            <Users className="mx-auto size-10" />
            <p className="mt-2 text-sm font-bold text-slate-600">لا يوجد مستفيدين بعد</p>
            <p className="mt-1 text-xs text-slate-400">أضف مستفيدين يدوياً أو استورد ملف Excel.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {beneficiaries.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-slate-800 text-base leading-snug">
                        <Link
                          href={`/beneficiary/${b.id}`}
                          className="hover:underline hover:text-emerald-800 outline-none transition-colors"
                        >
                          {b.full_name}
                        </Link>
                      </h3>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-100">
                        {b.family_size} {b.family_size >= 3 && b.family_size <= 10 ? "أفراد" : "فرد"}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 space-y-1">
                      <div>
                        <span className="text-slate-400">رقم الهوية:</span>{" "}
                        <span className="font-mono text-slate-700">{b.identifier}</span>
                      </div>
                      {b.phone && (
                        <div>
                          <span className="text-slate-400">رقم الهاتف:</span>{" "}
                          <span className="font-mono text-slate-700">{b.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <Link
                      href={`/beneficiary/${b.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-700 cursor-pointer"
                    >
                      <User className="size-3.5" />
                      <span>الملف</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-700 cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingBeneficiary(b)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cards Pagination Footer */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                <span className="text-xs font-bold text-slate-500">
                  صفحة {currentPage} من {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !isSaving && setModalMode(null)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-800">
                {modalMode === "add" ? "إضافة مستفيد جديد" : "تعديل بيانات المستفيد"}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                disabled={isSaving}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">
                  الاسم الكامل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, full_name: e.target.value }))
                  }
                  placeholder="مثال: أحمد محمد علي"
                  className={`h-11 w-full rounded-lg border bg-slate-50 px-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 ${
                    formErrors.full_name
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 focus:border-emerald-700 focus:ring-emerald-700/15"
                  }`}
                />
                {formErrors.full_name && (
                  <p className="text-xs font-bold text-rose-600">
                    {formErrors.full_name}
                  </p>
                )}
              </div>

              {/* Identifier */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">
                  رقم الهوية الوطنية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.identifier}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, identifier: e.target.value }))
                  }
                  placeholder="مثال: 1234567890"
                  className={`h-11 w-full rounded-lg border bg-slate-50 px-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 ${
                    formErrors.identifier
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 focus:border-emerald-700 focus:ring-emerald-700/15"
                  }`}
                />
                {formErrors.identifier && (
                  <p className="text-xs font-bold text-rose-600">
                    {formErrors.identifier}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">
                  رقم الهاتف <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="مثال: 01012345678"
                  className={`h-11 w-full rounded-lg border bg-slate-50 px-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 ${
                    formErrors.phone
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 focus:border-emerald-700 focus:ring-emerald-700/15"
                  }`}
                />
                {formErrors.phone && (
                  <p className="text-xs font-bold text-rose-600">
                    {formErrors.phone}
                  </p>
                )}
              </div>

              {/* Family Size */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">
                  عدد أفراد الأسرة
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.family_size}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, family_size: e.target.value }))
                  }
                  className={`h-11 w-full rounded-lg border bg-slate-50 px-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 ${
                    formErrors.family_size
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 focus:border-emerald-700 focus:ring-emerald-700/15"
                  }`}
                />
                {formErrors.family_size && (
                  <p className="text-xs font-bold text-rose-600">
                    {formErrors.family_size}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>
                    {modalMode === "add" ? "إضافة المستفيد" : "حفظ التعديلات"}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                disabled={isSaving}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeletingBeneficiary(null)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <Trash2 className="size-6" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-800">
              تأكيد حذف المستفيد
            </h2>
            <p className="text-sm font-medium text-slate-500">
              سيتم حذف المستفيد{" "}
              <span className="font-extrabold text-slate-800">
                {deletingBeneficiary.full_name}
              </span>{" "}
              وجميع سجلات الصرف المرتبطة به نهائياً. لا يمكن التراجع عن هذا
              الإجراء.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-600/60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>حذف نهائي</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeletingBeneficiary(null)}
                disabled={isDeleting}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {showEditConfirm && editingBeneficiary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowEditConfirm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-slate-800">
                تأكيد حفظ التعديلات
              </h2>
              <button
                type="button"
                onClick={() => setShowEditConfirm(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <p className="text-sm font-semibold text-slate-500">
              هل أنت متأكد من حفظ التعديلات التالية للمستفيد؟
            </p>

            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 space-y-3 font-semibold text-slate-700">
              {editingBeneficiary.full_name !== formData.full_name.trim() && (
                <div className="text-sm flex flex-row-reverse justify-end items-center gap-2">
                  <span className="font-extrabold min-w-[70px] text-slate-500">الاسم:</span>
                  <span className="line-through text-rose-500">{editingBeneficiary.full_name}</span>
                  <span className="text-slate-400">←</span>
                  <span className="text-emerald-700">{formData.full_name.trim()}</span>
                </div>
              )}
              {editingBeneficiary.identifier !== formData.identifier.trim() && (
                <div className="text-sm flex flex-row-reverse justify-end items-center gap-2">
                  <span className="font-extrabold min-w-[70px] text-slate-500">رقم الهوية:</span>
                  <span className="line-through text-rose-500 font-mono">{editingBeneficiary.identifier}</span>
                  <span className="text-slate-400">←</span>
                  <span className="text-emerald-700 font-mono">{formData.identifier.trim()}</span>
                </div>
              )}
              {(editingBeneficiary.phone || "") !== formData.phone.trim() && (
                <div className="text-sm flex flex-row-reverse justify-end items-center gap-2">
                  <span className="font-extrabold min-w-[70px] text-slate-500">رقم الهاتف:</span>
                  <span className="line-through text-rose-500 font-mono">{editingBeneficiary.phone || "—"}</span>
                  <span className="text-slate-400">←</span>
                  <span className="text-emerald-700 font-mono">{formData.phone.trim() || "—"}</span>
                </div>
              )}
              {editingBeneficiary.family_size.toString() !== formData.family_size && (
                <div className="text-sm flex flex-row-reverse justify-end items-center gap-2">
                  <span className="font-extrabold min-w-[70px] text-slate-500">أفراد الأسرة:</span>
                  <span className="line-through text-rose-500">{editingBeneficiary.family_size}</span>
                  <span className="text-slate-400">←</span>
                  <span className="text-emerald-700">{formData.family_size}</span>
                </div>
              )}
              {editingBeneficiary.full_name === formData.full_name.trim() &&
                editingBeneficiary.identifier === formData.identifier.trim() &&
                (editingBeneficiary.phone || "") === formData.phone.trim() &&
                editingBeneficiary.family_size.toString() === formData.family_size && (
                  <p className="text-xs font-semibold text-slate-400 text-center py-2">
                    لا توجد أي تعديلات فعلية في البيانات.
                  </p>
                )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditConfirm(false);
                  executeSave();
                }}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
              >
                تأكيد التعديل
              </button>
              <button
                type="button"
                onClick={() => setShowEditConfirm(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-only bulk cards container */}
      {isMounted && allBeneficiaries.length > 0 &&
        createPortal(
          <div className="print-container-bulk text-right" style={{ direction: "rtl" }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  margin: 0;
                  size: A4 portrait;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                body > *:not(.print-container-bulk) {
                  display: none !important;
                }
                body > .print-container-bulk {
                  display: block !important;
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 210mm !important;
                  height: auto !important;
                  background: white !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .print-page {
                  width: 210mm !important;
                  height: 297mm !important;
                  padding: 10mm 15mm !important;
                  box-sizing: border-box !important;
                  page-break-after: always !important;
                  break-after: always !important;
                  display: grid !important;
                  grid-template-columns: repeat(2, 85.6mm) !important;
                  grid-template-rows: repeat(5, 53.98mm) !important;
                  gap: 8mm 10mm !important;
                  justify-content: center !important;
                  align-content: center !important;
                  background: white !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                /* Standard ID card styles for print grid */
                .print-card-item {
                  position: relative !important;
                  width: 85.6mm !important;
                  height: 53.98mm !important;
                  border: 1.5px solid #059669 !important;
                  border-radius: 8px !important;
                  padding: 12px !important;
                  box-sizing: border-box !important;
                  display: flex !important;
                  flex-direction: row-reverse !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  direction: rtl !important;
                  background: white !important;
                  color: #0f172a !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `}} />
            <div className="print-container-bulk-content">
              {chunkArray(allBeneficiaries, 10).map((pageGroup, pageIndex) => (
                <div key={pageIndex} className="print-page">
                  {pageGroup.map((b) => (
                    <div key={b.id} className="print-card-item">
                      {/* Left side: QR Code */}
                      <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm shrink-0">
                        <QRCodeSVG
                          value={b.identifier}
                          size={80}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      {/* Right side: Details */}
                      <div className="flex flex-1 flex-col justify-between h-full pr-3 text-right">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block size-2 rounded-full bg-emerald-600"></span>
                            <span className="text-[9px] font-extrabold text-emerald-800 tracking-wider">بطاقة مستفيد المساعدات</span>
                          </div>
                          <h3 className="text-xs font-extrabold text-slate-800 line-clamp-2 leading-tight">
                            {b.full_name}
                          </h3>
                        </div>

                        <div className="space-y-0.5">
                          <div className="text-[9px] text-slate-500 font-bold">
                            رقم الهوية: <span className="font-mono font-extrabold text-slate-800 text-[10px]">{b.identifier}</span>
                          </div>
                          {b.phone && (
                            <div className="text-[9px] text-slate-500 font-bold">
                              رقم الهاتف: <span className="font-mono font-extrabold text-slate-800 text-[10px]">{b.phone}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-[9px] font-bold text-slate-500">
                          أفراد العائلة: <span className="font-extrabold text-emerald-700">{b.family_size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
