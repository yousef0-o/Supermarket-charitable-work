import { HandHeart } from "lucide-react";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"
    >
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-emerald-700 text-white shadow-sm">
            <HandHeart className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              تسجيل الدخول
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              نظام توزيع المساعدات الخيرية
            </p>
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
