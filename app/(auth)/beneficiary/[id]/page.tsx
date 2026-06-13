import Link from "next/link";
import { notFound } from "next/navigation";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  Clock,
  Coins,
  History,
  User,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TransactionsList } from "@/app/(auth)/beneficiary/[id]/_components/transactions-list";
import { QRCard } from "@/app/(auth)/beneficiary/[id]/_components/qr-card";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: beneficiary } = await supabase
      .from("beneficiaries")
      .select("full_name")
      .eq("id", id)
      .single();

    if (!beneficiary) {
      return {
        title: "المستفيد غير موجود",
      };
    }

    return {
      title: `ملف المستفيد: ${beneficiary.full_name}`,
      description: `متابعة حالة صرف المساعدات وتاريخ الاستلام للمستفيد ${beneficiary.full_name}`,
    };
  } catch {
    return {
      title: "ملف المستفيد",
    };
  }
}

export default async function BeneficiaryProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch beneficiary details and transactions in parallel to optimize page load
  const [beneficiaryResult, transactionsResult] = await Promise.all([
    supabase
      .from("beneficiaries")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("aid_transactions")
      .select("*")
      .eq("beneficiary_id", id)
      .order("received_at", { ascending: false })
  ]);

  const beneficiary = beneficiaryResult.data;
  const beneficiaryError = beneficiaryResult.error;

  if (beneficiaryError || !beneficiary) {
    notFound();
  }

  const transactions = transactionsResult.data || [];
  const txError = transactionsResult.error;

  if (txError) {
    console.error("Error fetching transactions:", txError);
  }

  const txs = transactions || [];

  // 3. Stats Engine calculations
  const totalReceipts = txs.length;
  
  const firstAidDate = txs.length > 0
    ? format(new Date(txs[txs.length - 1].received_at), "d MMMM yyyy", { locale: ar })
    : "لم يستلم بعد";

  const daysSinceLastReceipt = txs.length > 0
    ? differenceInDays(new Date(), new Date(txs[0].received_at))
    : null;

  return (
    <div className="w-full space-y-6">
      {/* Top Breadcrumb / Action */}
      <div className="flex items-center justify-between">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          <ArrowRight className="size-4" />
          <span>العودة للبحث</span>
        </Link>
      </div>

      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Decorative corner shape */}
        <div className="absolute top-0 left-0 size-24 -translate-x-8 -translate-y-8 rounded-full bg-emerald-500/10 pointer-events-none" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <User className="size-8" />
            </span>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-800">
                {beneficiary.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">رقم الهوية:</span>
                  <span className="font-mono text-slate-700">{beneficiary.identifier}</span>
                </span>
                {beneficiary.phone && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">رقم الهاتف:</span>
                      <span className="font-mono text-slate-700">{beneficiary.phone}</span>
                    </span>
                  </>
                )}
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">تاريخ الانضمام:</span>
                  <span className="text-slate-700">
                    {format(new Date(beneficiary.joined_at), "d MMMM yyyy", { locale: ar })}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2 border border-slate-100">
              <Users className="size-4 text-emerald-700" />
              <span className="text-sm font-bold text-slate-700">عدد أفراد الأسرة:</span>
              <span className="text-base font-extrabold text-slate-800">
                {beneficiary.family_size} {beneficiary.family_size >= 3 && beneficiary.family_size <= 10 ? "أفراد" : "فرد"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calculated Statistics Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Stat 1: Total Receipts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">إجمالي الاستلامات</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Coins className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{totalReceipts}</span>
            <span className="text-xs font-bold text-slate-400">مرات صرف</span>
          </div>
        </div>

        {/* Stat 2: First Aid Date */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">تاريخ أول مساعدة</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Calendar className="size-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-extrabold text-slate-800">{firstAidDate}</span>
          </div>
        </div>

        {/* Stat 3: Days Since Last Receipt */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">أيام منذ آخر استلام</span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Clock className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            {daysSinceLastReceipt === null ? (
              <span className="text-lg font-extrabold text-slate-800">لا يوجد</span>
            ) : (
              <>
                <span className="text-3xl font-extrabold text-slate-800">
                  {daysSinceLastReceipt}
                </span>
                <span className="text-xs font-bold text-slate-400">يوم</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* QR Identification Card */}
      <QRCard
        identifier={beneficiary.identifier}
        phone={beneficiary.phone}
        fullName={beneficiary.full_name}
        familySize={beneficiary.family_size}
      />

      {/* Historical Logs Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <History className="size-5 text-emerald-700" />
          <h2 className="text-lg font-extrabold text-slate-800">سجل المساعدات المستلمة</h2>
        </div>

        <TransactionsList transactions={txs} />
      </div>
    </div>
  );
}
