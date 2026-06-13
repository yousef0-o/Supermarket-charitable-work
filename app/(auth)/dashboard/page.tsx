import { createClient } from "@/lib/supabase/server";
import {
  Users,
  Award,
  CalendarDays,
  UserX,
  Sparkles,
  TrendingUp,
  Activity,
} from "lucide-react";
import { LiveFeed } from "./_components/live-feed";
import { DashboardActions } from "./_components/dashboard-actions";
import { MonthlyChartDynamic } from "./_components/monthly-chart-dynamic";

export const metadata = {
  title: "لوحة التحكم والتقارير",
  description: "عرض إحصائيات ومؤشرات توزيع المساعدات المالية ونشاطات الصرف الحية",
};

const monthNames = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Fetch active distribution cycle and recent 10 transactions in parallel to optimize TTFB
  const [cycleResult, recentResult] = await Promise.all([
    supabase
      .from("distribution_cycles")
      .select("id")
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("aid_transactions")
      .select("id, received_at, beneficiaries(full_name)")
      .order("received_at", { ascending: false })
      .limit(10)
  ]);

  const activeCycle = cycleResult.data;
  const cycleId = activeCycle?.id || "00000000-0000-0000-0000-000000000001";

  const recentTransactions = recentResult.data || [];
  const recentError = recentResult.error;

  if (recentError) {
    console.error("Error fetching recent transactions:", recentError);
  }

  // 2. Call RPC for aggregated stats (server-side, no full table scan in Node)
  let totalBeneficiaries = 0;
  let totalDistributions = 0;
  let cycleDistributions = 0;
  let remainingBeneficiaries = 0;
  let chartData: { monthName: string; count: number }[] = [];

  const { data: stats, error: statsError } = await supabase.rpc(
    "get_dashboard_stats",
    { p_cycle_id: cycleId }
  );

  if (statsError) {
    console.error("Error calling get_dashboard_stats RPC:", statsError);

    // Fallback: simple count queries if RPC doesn't exist yet (pre-migration)
    const { count: benCount } = await supabase
      .from("beneficiaries")
      .select("*", { count: "exact", head: true });
    totalBeneficiaries = benCount || 0;

    const { count: txCount } = await supabase
      .from("aid_transactions")
      .select("*", { count: "exact", head: true });
    totalDistributions = txCount || 0;
  } else if (stats) {
    totalBeneficiaries = stats.totalBeneficiaries || 0;
    totalDistributions = stats.totalDistributions || 0;
    cycleDistributions = stats.cycleDistributions || 0;
    remainingBeneficiaries = stats.remaining || 0;

    // Map chart data from RPC response
    const rawChart = stats.chartData || [];
    chartData = rawChart.map((m: any) => ({
      monthName: `${monthNames[(m.month_index || 1) - 1]} ${m.year || ""}`.trim(),
      count: m.count || 0,
    }));
  }

  const feedItems = (recentTransactions || []).map((tx) => {
    let beneficiaryName = "مستفيد غير معروف";
    if (tx.beneficiaries) {
      if (Array.isArray(tx.beneficiaries)) {
        beneficiaryName = tx.beneficiaries[0]?.full_name || beneficiaryName;
      } else {
        beneficiaryName = (tx.beneficiaries as any).full_name || beneficiaryName;
      }
    }
    return {
      id: tx.id,
      received_at: tx.received_at,
      beneficiaryName,
    };
  });

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Sparkles className="size-4.5" />
          </span>
          <h1 className="text-lg font-extrabold text-slate-800">لوحة التحكم والتقارير</h1>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          متابعة إحصائيات ومؤشرات توزيع المساعدات المالية للجمعية، وتحليل اتجاه الصرف ونشاطات النظام الحية.
        </p>
      </div>

      {/* Action Buttons (Export + Reset) */}
      <DashboardActions />

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Beneficiaries */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">إجمالي المستفيدين</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Users className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono">
              {totalBeneficiaries}
            </span>
            <span className="text-xs font-bold text-slate-400">مستفيد</span>
          </div>
        </div>

        {/* KPI 2: Total Distributions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">إجمالي التوزيعات</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Award className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono">
              {totalDistributions}
            </span>
            <span className="text-xs font-bold text-slate-400">حالة صرف</span>
          </div>
        </div>

        {/* KPI 3: Cycle Distributions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">توزيعات الدورة الحالية</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CalendarDays className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono">
              {cycleDistributions}
            </span>
            <span className="text-xs font-bold text-slate-400">مستلم</span>
          </div>
        </div>

        {/* KPI 4: Remaining Unreceived Beneficiaries */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">لم يستلموا بعد</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <UserX className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono">
              {remainingBeneficiaries}
            </span>
            <span className="text-xs font-bold text-slate-400">مستفيد متبقي</span>
          </div>
        </div>
      </div>

      {/* Main Sections Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left/Middle Column: Distribution Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <TrendingUp className="size-5 text-emerald-700" />
            <h2 className="text-lg font-extrabold text-slate-800">اتجاه التوزيع الشهري</h2>
          </div>
          <MonthlyChartDynamic data={chartData} />
        </div>

        {/* Right Column: Live Feed */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Activity className="size-5 text-emerald-700 animate-pulse" />
            <h2 className="text-lg font-extrabold text-slate-800">النشاط الأخير</h2>
          </div>
          <div className="max-h-72 overflow-y-auto pr-1">
            <LiveFeed items={feedItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
