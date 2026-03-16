// GET /api/cron/daily-schedule
//
// Vercel Cron Jobs が毎日 UTC 3:00（JST 12:00）に呼び出す。
// calendarMode = AUTO のユーザー全員に対して「翌日のスケジュール」を自動生成し
// Google Calendar に書き込む。
//
// ────────────────────────────────────────────────────
// 【実行タイミング】
// "0 3 * * *" = 毎日 UTC 3:00 = JST 12:00（正午）
// 正午に「明日のスケジュール」を生成する。
//
// 【CRON_SECRET によるセキュリティ】
// Vercel Cron は呼び出しに Authorization: Bearer {CRON_SECRET} を自動付与する。
// このシークレットが一致しないリクエストは 401 で拒否する。
// ────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/auth/getValidAccessToken";
import { runScheduleForUser } from "@/lib/schedule/runScheduleForUser";

export async function GET(req: NextRequest) {

  // ── 1. CRON_SECRET 認証 ──
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    console.warn("[cron] Unauthorized access attempt");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[cron] 実行開始: ${new Date().toISOString()}`);

  // ── 2. AUTO モードのユーザーを全員取得 ──
  const targets = await prisma.settings.findMany({
    where:  { calendarMode: "AUTO" },
    select: { userId: true },
  });

  console.log(`[cron] 対象ユーザー数: ${targets.length}`);

  if (targets.length === 0) {
    return Response.json({
      processed: 0,
      success:   0,
      fail:      0,
      message:   "AUTO モードのユーザーはいません",
    });
  }

  // ── 3. 各ユーザーの「翌日スケジュール」を生成 ──
  let successCount = 0;
  let failCount    = 0;

  for (const { userId } of targets) {

    // アクセストークンを取得（期限切れなら自動更新）
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.error(`[cron] トークン取得失敗: userId=${userId}`);
      failCount++;
      continue;
    }

    // 翌日の日付を計算（今日 + 1日）
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);

    // スケジュール生成 → Google Calendar 書き込み
    const result = await runScheduleForUser({ userId, accessToken, targetDate });

    if (result.success) {
      successCount++;
      console.log(`[cron] 成功: userId=${userId}, applied=${result.appliedCount}`);
    } else {
      failCount++;
      console.error(`[cron] 失敗: userId=${userId}, error=${result.error}`);
    }
  }

  const response = {
    processed: targets.length,
    success:   successCount,
    fail:      failCount,
  };

  console.log(`[cron] 完了:`, response);
  return Response.json(response);
}
