"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface TopNavProps {
  onMenuClick?: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { data: session } = useSession();
  const today = format(new Date(), "M/d (E)", { locale: ja });

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        {/* モバイル用ハンバーガー */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        {/* モバイル用ロゴ */}
        <span className="md:hidden text-sm font-bold text-slate-900">🤖 俺秘書</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-500">
          今日: {today}
        </span>
        {session?.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ""}
            width={30}
            height={30}
            className="rounded-full"
          />
        )}
      </div>
    </header>
  );
}
