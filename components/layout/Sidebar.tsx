"use client";
// "use client" が必要な理由：
// usePathname()（現在のURLを取得）や signOut()（ボタンクリック）は
// ブラウザ側でしか動かないため

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

// ナビゲーションの定義
// href: リンク先URL, icon: lucide-react のアイコン, label: 表示テキスト
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
  { href: "/tasks",     icon: ListTodo,         label: "タスク一覧" },
  { href: "/schedule",  icon: CalendarDays,     label: "スケジュール" },
  { href: "/settings",  icon: Settings,         label: "設定" },
];

interface SidebarProps {
  isOpen: boolean;          // サイドバーが開いているか
  onToggle: () => void;     // 開閉ボタンのハンドラ
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function Sidebar({ isOpen, onToggle, user }: SidebarProps) {
  const pathname = usePathname(); // 現在のURL（例: "/dashboard"）

  return (
    // transition-all で幅の変化をアニメーション
    <aside
      className={`
        ${isOpen ? "w-60" : "w-[72px]"}
        transition-all duration-300 ease-in-out
        flex-shrink-0 h-full p-3
      `}
    >
      {/* ガラスカード風サイドバー本体 */}
      {/* bg-white/80: 白の80%不透明 / backdrop-blur-xl: 背景をぼかす / rounded-[2rem]: 大きな角丸 */}
      <div className="h-full bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_4px_24px_rgba(0,82,255,0.06)] flex flex-col overflow-hidden border border-white/60">

        {/* ロゴエリア */}
        <div className={`px-4 py-5 flex items-center gap-3 ${!isOpen && "justify-center"}`}>
          <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            俺
          </div>
          {isOpen && (
            <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
              俺秘書
            </span>
          )}
        </div>

        {/* ナビゲーションリンク */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            // pathname.startsWith() でアクティブなリンクを判定
            // 例: pathname = "/tasks" → item.href = "/tasks" → isActive = true
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-150
                  ${!isOpen && "justify-center"}
                  ${isActive
                    ? "bg-blue-50 text-[#0052FF] font-medium"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }
                `}
              >
                {/* アクティブなアイコンは太く（strokeWidth=2）、非アクティブは細く（1.5）*/}
                <item.icon
                  className="w-5 h-5 flex-shrink-0"
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {isOpen && (
                  <span className="text-sm whitespace-nowrap">{item.label}</span>
                )}
                {/* アクティブなリンクの右端に青い点 */}
                {isActive && isOpen && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0052FF] flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ユーザー情報 + 折りたたみボタン */}
        <div className="p-3 space-y-2">
          {/* ユーザー情報（サイドバーが開いているときのみ表示） */}
          {isOpen && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
              {/* アバター：名前の頭文字を表示 */}
              <div className="w-8 h-8 rounded-full bg-[#0052FF]/10 flex items-center justify-center text-[#0052FF] text-xs font-bold flex-shrink-0">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
              {/* ログアウトボタン */}
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="flex-shrink-0 p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 折りたたみ/展開ボタン */}
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
            title={isOpen ? "閉じる" : "開く"}
          >
            {isOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
