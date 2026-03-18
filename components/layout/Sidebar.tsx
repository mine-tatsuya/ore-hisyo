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
  X,
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
  isOpen: boolean;           // デスクトップ：サイドバーが展開しているか
  onToggle: () => void;      // デスクトップ：展開/折りたたみボタンのハンドラ
  isMobileOpen: boolean;     // モバイル：ドロワーが開いているか
  onMobileClose: () => void; // モバイル：ドロワーを閉じるハンドラ
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function Sidebar({ isOpen, onToggle, isMobileOpen, onMobileClose, user }: SidebarProps) {
  const pathname = usePathname(); // 現在のURL（例: "/dashboard"）

  return (
    // ── レスポンシブ切り替えの仕組み ──
    //
    // モバイル（〜767px）:
    //   fixed で画面全体に重ねるドロワー方式。
    //   isMobileOpen が false のとき translate-x-[-100%] で画面左外に隠す。
    //   isMobileOpen が true のとき translate-x-0 で画面内にスライドイン。
    //   z-50 でオーバーレイ（z-40）より手前に表示。
    //
    // デスクトップ（md = 768px〜）:
    //   md:relative で通常フローに戻す。
    //   md:translate-x-0 でモバイルの translate を打ち消し（常に表示）。
    //   幅は isOpen に応じて w-60（展開）/ w-[72px]（折りたたみ）で切り替える。
    <aside
      className={`
        fixed top-0 left-0 h-full z-50 p-3 w-64
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:z-auto
        md:flex-shrink-0
        ${isOpen ? "md:w-60" : "md:w-[72px]"}
      `}
    >
      {/* ガラスカード風サイドバー本体 */}
      {/* bg-white/80: 白の80%不透明 / backdrop-blur-xl: 背景をぼかす / rounded-[2rem]: 大きな角丸 */}
      <div className="h-full bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_4px_24px_rgba(0,82,255,0.06)] flex flex-col overflow-hidden border border-white/60">

        {/* ロゴエリア */}
        <div className={`px-4 py-5 flex items-center gap-3 ${!isOpen && "md:justify-center"}`}>
          <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            俺
          </div>
          {/* ロゴテキスト: デスクトップは isOpen のとき表示、モバイルは常に表示 */}
          <span className={`font-bold text-slate-800 text-sm whitespace-nowrap ${!isOpen && "md:hidden"}`}>
            俺秘書
          </span>
          {/* モバイル専用×ボタン（デスクトップでは非表示） */}
          <button
            onClick={onMobileClose}
            className="ml-auto md:hidden p-1 text-slate-400 hover:text-slate-600 transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
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
                onClick={onMobileClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-150
                  ${!isOpen && "md:justify-center"}
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
                {/* ラベル: モバイルは常に表示、デスクトップは isOpen のみ */}
                <span className={`text-sm whitespace-nowrap ${!isOpen && "md:hidden"}`}>
                  {item.label}
                </span>
                {/* アクティブなリンクの右端に青い点（デスクトップ展開時のみ） */}
                {isActive && isOpen && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0052FF] flex-shrink-0 hidden md:block" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ユーザー情報 + 折りたたみボタン */}
        <div className="p-3 space-y-2">
          {/* ユーザー情報: モバイルは常に表示、デスクトップは isOpen のみ */}
          {/* !isOpen のとき md:hidden でデスクトップだけ非表示にする */}
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 ${!isOpen ? "md:hidden" : ""}`}>
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

          {/* 折りたたみ/展開ボタン（デスクトップ専用） */}
          <button
            onClick={onToggle}
            className="hidden md:flex w-full items-center justify-center p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
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
