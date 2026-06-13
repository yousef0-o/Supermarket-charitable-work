"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NotFound() {
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
        {/* 404 Emblem */}
        <div className="relative flex size-24 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
          <h1 className="text-4xl font-extrabold text-emerald-300 font-mono select-none">
            404
          </h1>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-wide text-white">
            الصفحة غير موجودة
          </h1>
          <p className="text-xs font-bold text-emerald-200/70">
            جاري إعادة توجيهك إلى المكان الصحيح...
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
