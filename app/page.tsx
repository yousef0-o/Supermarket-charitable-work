"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-950 p-4 select-none text-white"
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        {/* App Logo Emblem */}
        <div className="relative flex size-24 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md animate-pulse">
          <svg
            className="size-12 text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-wide text-white">
            نظام إدارة المساعدات
          </h1>
          <p className="text-xs font-bold text-emerald-200/70">
            جاري التحقق من الهوية وتحميل النظام...
          </p>
        </div>

        {/* Loading Spinner */}
        <div className="relative mt-2 flex size-10 items-center justify-center">
          <div className="absolute size-full rounded-full border-4 border-emerald-500/20"></div>
          <div className="absolute size-full rounded-full border-4 border-t-emerald-400 animate-spin"></div>
        </div>
      </div>
    </div>
  );
}
