// DB の Account テーブルから有効な Google アクセストークンを取得するユーティリティ
//
// 【なぜ必要か？】
// Cron 実行時はユーザーのセッションが存在しない。
// セッションなしで Google Calendar を操作するには、DB に保存された
// refresh_token を使って access_token を直接取得する必要がある。
//
// 【トークンのライフサイクル】
//   access_token  ── 有効期限は約1時間（expires_at で確認）
//   refresh_token ── 長期間有効。access_token が切れたら这を使って更新する
//
// 【DB の Account テーブル（NextAuth が管理）】
//   access_token  : 現在のアクセストークン
//   refresh_token : リフレッシュトークン（Google が発行）
//   expires_at    : access_token の有効期限（Unix 秒）

import { prisma } from "@/lib/prisma";

export async function getValidAccessToken(userId: string): Promise<string | null> {
  // ── 1. DB から Google アカウント情報を取得 ──
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      access_token:  true,
      refresh_token: true,
      expires_at:    true,  // Unix 秒（例: 1712345678）
    },
  });

  if (!account) {
    console.warn(`[getValidAccessToken] Google account not found: userId=${userId}`);
    return null;
  }

  // ── 2. access_token がまだ有効かチェック ──
  // expires_at は Unix 秒なので ×1000 でミリ秒に変換して Date.now() と比較
  // 余裕を持って「60秒前」に期限切れ扱いにする（ギリギリを避ける）
  const BUFFER_MS = 60 * 1000;
  const isExpired =
    !account.expires_at ||
    account.expires_at * 1000 - BUFFER_MS < Date.now();

  if (!isExpired && account.access_token) {
    // まだ有効なのでそのまま返す
    return account.access_token;
  }

  // ── 3. 期限切れ → refresh_token で更新 ──
  if (!account.refresh_token) {
    console.warn(`[getValidAccessToken] No refresh_token: userId=${userId}`);
    return null;
  }

  // Google の OAuth2 トークンエンドポイントに POST する
  // （googleapis ライブラリを使わず fetch で直接叩く。依存を最小化するため）
  let newAccessToken: string;
  let newExpiresAt:   number;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: account.refresh_token,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error(`[getValidAccessToken] Token refresh failed: ${tokenRes.status} ${err}`);
      return null;
    }

    // レスポンス例:
    // { access_token: "ya29.xxx", expires_in: 3599, token_type: "Bearer" }
    const tokenData = await tokenRes.json() as {
      access_token: string;
      expires_in:   number;   // 秒数（通常 3599）
    };

    newAccessToken = tokenData.access_token;
    // expires_in 秒後が新しい有効期限（Unix 秒に変換して保存）
    newExpiresAt   = Math.floor(Date.now() / 1000) + tokenData.expires_in;

  } catch (err) {
    console.error(`[getValidAccessToken] Fetch error during token refresh:`, err);
    return null;
  }

  // ── 4. 新しいトークンを DB に保存 ──
  // NextAuth が管理する Account テーブルを直接更新する
  // （provider + userId の組み合わせで特定）
  try {
    await prisma.account.updateMany({
      where:  { userId, provider: "google" },
      data: {
        access_token: newAccessToken,
        expires_at:   newExpiresAt,
      },
    });
  } catch (err) {
    // DB 更新に失敗しても新しい access_token は使える（次回また refresh されるだけ）
    console.error(`[getValidAccessToken] Failed to save new token to DB:`, err);
  }

  return newAccessToken;
}
