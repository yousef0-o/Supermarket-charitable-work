"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartDataItem {
  monthName: string;
  count: number;
}

interface MonthlyChartProps {
  data: ChartDataItem[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100/70" />
    );
  }

  // Custom tooltips in Arabic
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-md text-right">
          <p className="text-xs font-bold text-slate-400">{payload[0].payload.monthName}</p>
          <p className="mt-1 text-sm font-extrabold text-white">
            <span className="text-emerald-400 font-mono">{payload[0].value}</span> عمليات صرف
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="monthName"
            stroke="#94a3b8"
            fontSize={11}
            fontWeight={600}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            fontWeight={600}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar
            dataKey="count"
            fill="url(#colorCount)"
            radius={[4, 4, 0, 0]}
            maxBarSize={45}
          >
            {/* Gradient definition for bars */}
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.6} />
              </linearGradient>
            </defs>
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
