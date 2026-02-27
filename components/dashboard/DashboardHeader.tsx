"use client";

import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export function DashboardHeader() {
  const { data: session } = useSession();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";
  const today = format(new Date(), "M/d (E)", { locale: ja });

  return (
    <div className="mb-6">
      <p className="text-xs text-slate-500 mb-0.5">{today}</p>
      <h1 className="text-xl font-bold text-slate-900 tracking-tight">
        {greeting}、{session?.user?.name?.split(" ")[0] ?? ""}さん
      </h1>
    </div>
  );
}
