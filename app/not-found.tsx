import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center"
      dir="rtl"
    >
      <div className="w-full max-w-md space-y-6">
        {/* 404 Number */}
        <div className="space-y-2">
          <h1 className="text-8xl font-extrabold text-emerald-700/20 font-mono select-none">
            404
          </h1>
          <h2 className="text-2xl font-extrabold text-slate-800">
            الصفحة غير موجودة
          </h2>
          <p className="text-sm font-medium text-slate-500">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها أو حذفها.
            تحقق من الرابط وحاول مرة أخرى.
          </p>
        </div>

        {/* Action Button */}
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
        >
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  );
}
