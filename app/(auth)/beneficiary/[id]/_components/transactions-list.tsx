"use client";

import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { CheckCircle2, Inbox } from "lucide-react";

interface Transaction {
  id: string;
  beneficiary_id: string;
  received_at: string;
  admin_id: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
    },
  },
} as const;

export function TransactionsList({ transactions }: TransactionsListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
        <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Inbox className="size-6" />
        </span>
        <h3 className="mt-3 text-sm font-bold text-slate-700">لا توجد عمليات صرف</h3>
        <p className="mt-1 text-xs text-slate-400">
          لم يتم تسجيل أي عمليات صرف مساعدة مالية لهذا المستفيد سابقاً.
        </p>
      </div>
    );
  }

  const formatTxDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMMM yyyy, hh:mm a", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-150 bg-slate-50/40"
      >
        {transactions.map((tx) => (
          <m.div
            key={tx.id}
            variants={itemVariants}
            className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100">
                <CheckCircle2 className="size-4.5" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-800">صرف مساعدة مالية شهرية</p>
                <p className="text-xs font-semibold text-slate-400 font-mono">
                  مُعرّف الصرف: {tx.id.substring(0, 8)}...
                </p>
              </div>
            </div>

            <div className="text-left">
              <span className="inline-flex items-center rounded bg-white px-2.5 py-1 text-xs font-bold font-mono text-slate-600 border border-slate-100 shadow-sm">
                {formatTxDate(tx.received_at)}
              </span>
            </div>
          </m.div>
        ))}
      </m.div>
    </LazyMotion>
  );
}
