// Cron エンドポイント（骨格のみ・後続フェーズで実装）
//
// 【このエンドポイントの役割】
// Vercel Cron Jobs が毎日 UTC 3:00（JST 12:00）に呼び出す。
// calendarMode === "AUTO" のユーザーに対してスケジュールを自動生成する。
//
// vercel.json の設定:
//   "schedule": "0 3 * * *"
//   → cron 式。"分 時 日 月 曜日" の形式で、毎日 UTC 3:00 を意味する
//   → UTC 3:00 = JST 12:00（日本時間の正午・前日分を生成するのに適切）
//
// 【セキュリティ】
// CRON_SECRET 環境変数を使った認証を実装予定。
// Vercel が呼ぶとき Authorization: Bearer {CRON_SECRET} ヘッダーを付けてくれる。
// これにより「Vercel 以外からの呼び出し」を拒否できる。

import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  // ── 認証チェック（後続フェーズで実装）──
  // const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  // if (secret !== process.env.CRON_SECRET) {
  //   return Response.json({ error: "Unauthorized" }, { status: 401 });
  // }

  // ── TODO: 後続フェーズで実装する内容 ──
  //
  // 1. prisma.user.findMany({ where: { settings: { calendarMode: "AUTO" } } })
  //    → calendarMode === "AUTO" のユーザーを全件取得
  //
  // 2. 各ユーザーに対して:
  //    - Account から accessToken を取得（refresh_token で更新が必要な場合も考慮）
  //    - generate/route.ts のロジックを共通関数として抽出して呼ぶ
  //    - 生成されたスケジュールを Google Calendar に自動追加
  //
  // 3. 処理結果（成功数・失敗数）をログに記録

  return Response.json({
    message: "Cron endpoint is ready. AUTO mode execution will be implemented in a future phase.",
    timestamp: new Date().toISOString(),
  });
}
