// 設定ページ
// サーバーコンポーネント：Prisma から直接設定を取得して SettingsForm に渡す

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsForm from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;

  // 設定を取得。なければデフォルト値で自動作成（APIと同じ upsert パターン）
  // サーバーコンポーネントなので Prisma を直接呼べる（APIを経由しなくてよい）
  const settings = await prisma.settings.upsert({
    where:  { userId },
    update: {},
    create: {
      userId,
      wakeUpTime:    "07:00",
      bedTime:       "23:00",
      lunchStart:    "12:00",
      lunchEnd:      "13:00",
      aiPersonality:    "BALANCED",
      calendarMode:     "MANUAL",
      location:         "",
      cronTime:         "12:00",
      cronTargetOffset: 1,
    },
  });

  return (
    <div className="pt-2 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-base font-bold text-slate-800">設定</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">
          AIがスケジュールを生成するための基本情報を設定してください
        </p>
      </div>

      {/*
        SettingsForm はクライアントコンポーネント（"use client"）。
        サーバーコンポーネントからクライアントコンポーネントへ
        データを渡すときは props を使う。
        ※ Settings 型はシリアライズ可能（Date 型なし）なのでそのまま渡せる
      */}
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
