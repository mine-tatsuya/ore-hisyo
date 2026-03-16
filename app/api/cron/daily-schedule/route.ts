// GET /api/cron/daily-schedule
//
// Vercel Cron Jobs が毎時 0 分に呼び出す。
// 「現在の JST 時刻 = ユーザーが設定した cronTime」のユーザーのみ
// スケジュールを自動生成し Google Calendar に書き込む。
//
// ────────────────────────────────────────────────────
// 【毎時実行にする理由】
// Vercel Cron は 1 つのスケジュールしか設定できない。
// A さんは 7:00、B さんは 22:00 … など、ユーザーごとに違う時刻を設定するには
// 「毎時動かして、その時刻のユーザーだけ処理する」方式が最もシンプル。
//
// 【CRON_SECRET によるセキュリティ】
// Vercel Cron は呼び出しに Authorization: Bearer {CRON_SECRET} を自動付与する。
// このシークレットが一致しないリクエストは 401 で拒否する。
// → 悪意ある第三者が直接 URL を叩いてもスケジュールを走らせられない。
// ────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/auth/getValidAccessToken";
import { runScheduleForUser } from "@/lib/schedule/runScheduleForUser";

export async function GET(req: NextRequest) {

  // ── 1. CRON_SECRET 認証 ──
  // Authorization ヘッダーから "Bearer " を除いてシークレットを取り出す
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    console.warn("[cron] Unauthorized access attempt");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 現在の JST 時刻を "HH:00" 形式で取得 ──
  //
  // Vercel の Cron は UTC 時刻で動く。
  // 日本時間（JST）は UTC + 9 時間なので、(UTC時 + 9) % 24 で JST の時を求める。
  //
  // 例: UTC 22:05 → JST 7:05 → cronTimeStr = "07:00"
  //     UTC 13:00 → JST 22:00 → cronTimeStr = "22:00"
  //
  // ※ vercel.json で "0 * * * *"（毎時0分）にしているので
  //   分は常に 0 であり、分の考慮は不要
  const nowUtc       = new Date();
  const jstHour      = (nowUtc.getUTCHours() + 9) % 24;
  const cronTimeStr  = `${String(jstHour).padStart(2, "0")}:00`;

  console.log(`[cron] 実行開始: UTC=${nowUtc.toISOString()}, JST=${cronTimeStr}`);

  // ── 3. 処理対象ユーザーを取得 ──
  //
  // 「AUTO モード」かつ「cronTime が現在の JST 時刻と一致」するユーザーだけを取得。
  // 例: 今が JST 07:00 なら cronTime = "07:00" に設定したユーザーのみ処理される。
  // → 各ユーザーは 1 日 1 回だけスケジュールが自動生成される。
  const targets = await prisma.settings.findMany({
    where: {
      calendarMode: "AUTO",
      cronTime:     cronTimeStr,
    },
    select: {
      userId:          true,
      cronTargetOffset: true,
    },
  });

  console.log(`[cron] 対象ユーザー数: ${targets.length}`);

  if (targets.length === 0) {
    return Response.json({
      processed: 0,
      success:   0,
      fail:      0,
      cronTime:  cronTimeStr,
      message:   "この時刻に設定されたユーザーはいません",
    });
  }

  // ── 4. 各ユーザーを順番に処理 ──
  let successCount = 0;
  let failCount    = 0;

  for (const { userId, cronTargetOffset } of targets) {

    // ① アクセストークンを取得（期限切れなら自動更新）
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.error(`[cron] トークン取得失敗: userId=${userId}`);
      failCount++;
      continue; // このユーザーはスキップして次へ
    }

    // ② 対象日を計算
    // cronTargetOffset = 0 なら今日、1 なら明日、2 なら明後日…
    // 例: cronTargetOffset=1（翌日）→ 夜に実行して「明日のスケジュール」を生成
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + cronTargetOffset);

    // ③ スケジュール生成 → Google Calendar 書き込み
    const result = await runScheduleForUser({ userId, accessToken, targetDate });

    if (result.success) {
      successCount++;
      console.log(`[cron] 成功: userId=${userId}, applied=${result.appliedCount}`);
    } else {
      failCount++;
      console.error(`[cron] 失敗: userId=${userId}, error=${result.error}`);
    }
  }

  // ── 5. 結果を返す ──
  const response = {
    processed: targets.length,
    success:   successCount,
    fail:      failCount,
    cronTime:  cronTimeStr,
  };

  console.log(`[cron] 完了:`, response);
  return Response.json(response);
}
