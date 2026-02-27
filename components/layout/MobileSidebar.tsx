"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
  { href: "/tasks", icon: ListTodo, label: "タスク一覧" },
  { href: "/schedule", icon: CalendarDays, label: "スケジュール" },
  { href: "/settings", icon: Settings, label: "設定" },
];

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100">
          <span className="text-base font-bold text-slate-900">🤖 俺秘書</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-50">
            <X className="w-5 h-5 text-slate-500" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] shrink-0" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? "" : "ml-4"}`}
                  strokeWidth={1.5}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ""}
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {session?.user?.name ?? "ユーザー"}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-all"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
