import { Sparkles, ClipboardList } from "lucide-react";
import { ManageInterface } from "./_components/manage-interface";

export const metadata = {
  title: "إدارة المستفيدين",
  description: "إضافة وتعديل وحذف واستيراد بيانات المستفيدين من المساعدات",
};

export default function ManagePage() {
  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <ClipboardList className="size-4.5" />
          </span>
          <h1 className="text-lg font-extrabold text-slate-800">إدارة المستفيدين</h1>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          إضافة وتعديل وحذف بيانات المستفيدين يدوياً، أو استيراد البيانات بشكل جماعي عبر ملفات Excel.
        </p>
      </div>

      <ManageInterface />
    </div>
  );
}
