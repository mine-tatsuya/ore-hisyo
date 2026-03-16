// 日付範囲指定でカレンダーイベントを取得するユーティリティ
//
// 既存の getCalendarEvents.ts が「1日分の空き時間計算」用なのに対し、
// このファイルは「指定期間に何の予定があったか」をそのまま返す。
//
// Function Calling の getCalendarEvents ツールから呼ばれる。
// 例:「先週火曜日に掃除機をかけたか」→ AI が startDate/endDate を指定して呼ぶ

import { google } from "googleapis";

// 返り値の型
export interface CalendarEventSummary {
  id:       string;
  title:    string;
  start:    string; // ISO 8601 文字列（AI が読みやすい形）
  end:      string;
  isAllDay: boolean;
}

/**
 * 指定した日付範囲の Google Calendar イベントを取得する
 *
 * @param accessToken - ユーザーの Google アクセストークン
 * @param startDate   - 開始日 "YYYY-MM-DD" 形式（その日の 00:00:00 以降）
 * @param endDate     - 終了日 "YYYY-MM-DD" 形式（その日の 23:59:59 まで）
 * @returns           イベントの配列（AIが読みやすいシンプルな形）
 */
export async function getEventsByRange(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<CalendarEventSummary[]> {

  // Google API クライアントの初期化（getCalendarEvents.ts と同じパターン）
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  // 開始日の 00:00:00 ～ 終了日の 23:59:59 の範囲を設定
  const timeMin = new Date(startDate);
  timeMin.setHours(0, 0, 0, 0);

  const timeMax = new Date(endDate);
  timeMax.setHours(23, 59, 59, 999);

  // 日付が不正な場合はエラー
  if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) {
    throw new Error(`getEventsByRange: invalid date range "${startDate}" to "${endDate}"`);
  }

  try {
    const response = await calendar.events.list({
      calendarId:   "primary",
      timeMin:      timeMin.toISOString(),
      timeMax:      timeMax.toISOString(),
      singleEvents: true,       // 繰り返しイベントを個別に展開する
      orderBy:      "startTime",
      maxResults:   100,        // 上限を設けてレスポンスサイズを制限
    });

    const items = response.data.items ?? [];

    return items
      .map((item) => {
        const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
        const startRaw = item.start?.dateTime ?? item.start?.date ?? "";
        const endRaw   = item.end?.dateTime   ?? item.end?.date   ?? "";
        const start    = new Date(startRaw);
        const end      = new Date(endRaw);

        // Invalid Date のものは除外するため、先に変換してフィルタ
        return {
          id:       item.id      ?? "",
          title:    item.summary ?? "（タイトルなし）",
          start:    start.toISOString(),
          end:      end.toISOString(),
          isAllDay,
          _valid:   !isNaN(start.getTime()) && !isNaN(end.getTime()),
        };
      })
      .filter((e) => e._valid)
      .map(({ _valid: _, ...e }) => e);

  } catch (error) {
    console.error("[getEventsByRange] Google Calendar API error:", error);
    throw new Error("Google Calendar の取得に失敗しました。再ログインが必要な場合があります。");
  }
}
