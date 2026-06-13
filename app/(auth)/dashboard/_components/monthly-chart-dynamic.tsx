"use client";

import dynamic from "next/dynamic";

export const MonthlyChartDynamic = dynamic(
  () => import("./monthly-chart").then((mod) => mod.MonthlyChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100/50 flex items-center justify-center text-sm font-bold text-slate-400">
        جاري تحميل الرسم البياني...
      </div>
    ),
  }
);
