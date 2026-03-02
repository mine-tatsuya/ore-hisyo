"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

// パス → ページタイトルの対応表
const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "ダッシュボード",
    subtitle: "今日のタスクとスケジュールを確認",
  },
  "/tasks": {
    title: "タスク一覧",
    subtitle: "タスクの管理と進捗を記録",
  },
  "/schedule": {
    title: "スケジュール",
    subtitle: "AIが生成した今日のスケジュール",
  },
  "/settings": {
    title: "設定",
    subtitle: "生活リズムとAI設定を管理",
  },
};

interface TopNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 現在のパスに対応するタイトルを取得
  // Object.keys() で全キーを走査し、先頭一致（startsWith）で判定
  const pageKey = Object.keys(pageTitles).find((key) =>
    pathname.startsWith(key)
  );
  const { title, subtitle } = pageKey
    ? pageTitles[pageKey]
    : { title: "俺秘書", subtitle: "" };

  // 今日の日付を日本語フォーマットで表示
  // toLocaleDateString("ja-JP", ...) = "3月2日（日）" のような形式
  const today = new Date().toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // ドロップダウンメニューの外側クリックで閉じる処理
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // menuRef.current: メニューのDOM要素
      // contains(): クリック対象がメニューの中にあるか確認
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    // イベントリスナーを追加
    document.addEventListener("mousedown", handleClickOutside);
    // コンポーネントが消えるときにイベントリスナーを削除（メモリリーク防止）
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="px-6 pt-6 pb-3 flex items-center justify-between">
      {/* 左：ページタイトル */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* 右：今日の日付 + ユーザーアバター */}
      <div className="flex items-center gap-3">
        {/* 日付バッジ */}
        <span className="text-xs text-slate-500 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
          {today}
        </span>

        {/* ユーザーアバター + ドロップダウンメニュー */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-full bg-[#0052FF]/10 flex items-center justify-center text-[#0052FF] font-bold text-sm hover:bg-[#0052FF]/20 transition-colors"
          >
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </button>

          {/* ドロップダウンメニュー（menuOpen が true のときだけ表示） */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50">
              {/* ユーザー情報ヘッダー */}
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>

              {/* ログアウトボタン */}
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors rounded-b-2xl"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
