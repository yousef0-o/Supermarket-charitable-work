"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center"
      dir="rtl"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Error Icon */}
        <div className="space-y-2">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800">
            حدث خطأ غير متوقع
          </h2>
          <p className="text-sm font-medium text-slate-500">
            عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى أو
            العودة للوحة التحكم.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            حاول مرة أخرى
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            العودة للوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
