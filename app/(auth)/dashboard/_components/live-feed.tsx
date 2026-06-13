"use client";

import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { CheckCircle2, Inbox } from "lucide-react";

interface FeedItem {
  id: string;
  received_at: string;
  beneficiaryName: string;
}

interface LiveFeedProps {
  items: FeedItem[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 15 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
    },
  },
} as const;

export function LiveFeed({ items }: LiveFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
        <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Inbox className="size-6" />
        </span>
        <h3 className="mt-3 text-sm font-bold text-slate-700">لا توجد سجلات بعد</h3>
        <p className="mt-1 text-xs text-slate-400">
          لم يتم تسجيل أي عمليات صرف مساعدات في النظام حالياً.
        </p>
      </div>
    );
  }

  const formatFeedDate = (dateStr: string) => {
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
        className="space-y-3"
      >
        {items.map((item) => (
          <m.div
            key={item.id}
            variants={itemVariants}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100">
                <CheckCircle2 className="size-4.5" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-800">
                  صرف مساعدة لـ{" "}
                  <span className="text-emerald-950 font-extrabold">{item.beneficiaryName}</span>
                </p>
                <p className="text-[10px] font-semibold text-slate-400 font-mono">
                  مُعرّف: {item.id.substring(0, 8)}...
                </p>
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="inline-flex items-center rounded bg-white px-2.5 py-1 text-xs font-bold font-mono text-slate-500 border border-slate-100 shadow-xs">
                {formatFeedDate(item.received_at)}
              </span>
            </div>
          </m.div>
        ))}
      </m.div>
    </LazyMotion>
  );
}
