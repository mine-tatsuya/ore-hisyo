// Google Calendar API からイベントを取得するロジック
// このファイルは「APIを叩く」部分だけを担当する。計算ロジックは getFreeSlots.ts で行う。

import { google } from "googleapis";

// カレンダーイベントの型定義（APIレスポンスから必要な部分だけ抜き出す）
export interface CalendarEvent {
  id:       string;
  title:    string;
  start:    Date;   // 開始日時
  end:      Date;   // 終了日時
  isAllDay: boolean; // 終日イベントかどうか
}

/**
 * 指定した日付の Google Calendar イベントを取得する
 *
 * @param accessToken - ユーザーの Google アクセストークン（session.accessToken）
 * @param date        - 取得したい日付（デフォルト: 今日）
 * @returns           カレンダーイベントの配列
 */
export async function getCalendarEvents(
  accessToken: string,
  date: Date = new Date()
): Promise<CalendarEvent[]> {

  // Google API クライアントの初期化
  // OAuth2 クライアントに「このユーザーのアクセストークン」をセットする
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  // 取得する日付の 00:00:00 ～ 23:59:59 の範囲を設定
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const response = await calendar.events.list({
      calendarId:  "primary", // "primary" = ユーザーのメインカレンダー
      timeMin:     startOfDay.toISOString(), // 開始以降
      timeMax:     endOfDay.toISOString(),   // 終了以前
      singleEvents: true,       // 繰り返しイベントを個別に展開する
      orderBy:     "startTime", // 開始時刻順に並べる
    });

    const items = response.data.items ?? [];

    // APIレスポンスを扱いやすい形に変換する
    return items
      // 俺秘書が追加したイベントは除外する（二重ブロック防止）
      // apply/route.ts で extendedProperties.private.source = "ore-hisyo" を付けている
      .filter((item) => item.extendedProperties?.private?.["source"] !== "ore-hisyo")
      .map((item) => {
        // 終日イベントは start.date、時刻指定イベントは start.dateTime が入っている
        const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);

        const startRaw = item.start?.dateTime ?? item.start?.date ?? "";
        const endRaw   = item.end?.dateTime   ?? item.end?.date   ?? "";

        // 日付のみ（"2024-03-15"）の場合は 00:00 として解釈する
        const start = new Date(startRaw);
        const end   = new Date(endRaw);

        return {
          id:       item.id      ?? "",
          title:    item.summary ?? "（タイトルなし）",
          start,
          end,
          isAllDay,
        };
      })
      // 日時の変換に失敗したものを除外（Invalid Date 対策）
      .filter((e) => !isNaN(e.start.getTime()) && !isNaN(e.end.getTime()));

  } catch (error) {
    // トークン期限切れなどのエラーをわかりやすく再スロー
    console.error("[getCalendarEvents] Google Calendar API error:", error);
    throw new Error("Google Calendar の取得に失敗しました。再ログインが必要な場合があります。");
  }
}
