"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  HandHeart,
  LayoutDashboard,
  LogOut,
  Search,
  UsersRound,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useNetworkStatus } from "@/components/providers/network-provider";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "الرئيسية",
    icon: LayoutDashboard,
  },
  {
    href: "/search",
    label: "البحث",
    icon: Search,
  },
  {
    href: "/manage",
    label: "إدارة المستفيدين",
    icon: UsersRound,
  },
];

export function AuthHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline, pendingCount, syncOfflineData } = useNetworkStatus();

  const handleSignOut = async () => {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineData();
    } catch (err) {
      console.error("Manual sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-3 rounded-md text-slate-800 outline-none transition-colors hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-emerald-700 text-white shadow-sm">
            <HandHeart className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold">نظام توزيع المساعدات</span>
            <span className="text-xs font-medium text-slate-500">
              إدارة خيرية
            </span>
          </span>
        </Link>

        <nav
          aria-label="التنقل الرئيسي"
          className="order-3 flex w-full items-center justify-center gap-1.5 md:order-none md:w-auto"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "inline-flex h-10 items-center gap-1.5 lg:gap-2 rounded-md px-2 lg:px-3 text-xs lg:text-sm font-semibold outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  isActive
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                ].join(" ")}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Manual Sync Button */}
          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex h-9 items-center gap-1.5 sm:gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 sm:px-3 text-xs font-bold text-emerald-700 shadow-sm outline-none transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">مزامنة الآن ({pendingCount})</span>
              <span className="sm:hidden" aria-hidden="true">مزامنة ({pendingCount})</span>
            </button>
          )}

          {/* Connection Status Indicator */}
          <div
            className={[
              "inline-flex h-9 items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 text-xs font-bold border shadow-sm transition-colors",
              isOnline
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
            ].join(" ")}
          >
            <span
              className={[
                "size-2 rounded-full",
                isOnline ? "bg-emerald-500" : "bg-amber-500",
              ].join(" ")}
            />
            <span className="hidden sm:inline">{isOnline ? "متصل بالشبكة" : "غير متصل - حفظ محلي"}</span>
            <span className="sm:hidden" aria-hidden="true">{isOnline ? "متصل" : "محلي"}</span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex h-10 items-center gap-1.5 sm:gap-2 rounded-md border border-slate-200 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-semibold text-slate-600 outline-none transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{isSigningOut ? "جار تسجيل الخروج" : "تسجيل الخروج"}</span>
            <span className="sm:hidden" aria-hidden="true">{isSigningOut ? "..." : "خروج"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
