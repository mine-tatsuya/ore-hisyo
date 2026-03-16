// 空き時間計算ロジック
//
// 入力: カレンダーイベント一覧 + ユーザーの設定（作業時間・昼休みなど）
// 出力: 今日の「空き時間スロット」一覧
//
// アルゴリズムのイメージ:
//   [07:00────────────────────────────23:00] ← 作業時間
//      [12:00─13:00]                          ← 昼休み（ブロック）
//            [10:00─11:00]                    ← 会議（ブロック）
//   ↓ ブロックを除いた残りが「空き時間」
//   [07:00─10:00] [11:00─12:00] [13:00─23:00]

import type { Settings } from "@prisma/client";
import type { CalendarEvent } from "./getCalendarEvents";

// 空き時間スロットの型
export interface FreeSlot {
  start:           Date;   // 開始日時
  end:             Date;   // 終了日時
  durationMinutes: number; // 何分間空いているか
}

// 内部処理用の「時間帯」型
interface Interval {
  start: Date;
  end:   Date;
}

/**
 * "HH:MM" 形式の文字列を、指定した日付のその時刻の Date オブジェクトに変換する
 * 例: parseTime(today, "07:30") → today の JST 07:30:00 を表す Date
 *
 * setHours() はサーバーのローカル時間（Vercel は UTC）で動作するため使わない。
 * 日付を JST の "YYYY-MM-DD" 文字列に変換してから "+09:00" オフセットで Date を作る。
 */
function parseTime(date: Date, hhmm: string): Date {
  const jstDateStr = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  return new Date(`${jstDateStr}T${hhmm}:00+09:00`);
}

/**
 * 重なっている（または隣接している）時間帯を1つに結合する
 * 例: [10:00─11:00] と [10:30─12:00] → [10:00─12:00]
 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  // 開始時刻で並べ替え
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Interval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last    = merged[merged.length - 1];
    const current = sorted[i];

    if (current.start <= last.end) {
      // 重なっている → 終了時刻を後ろに延ばす
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      // 重なっていない → 新しい区間として追加
      merged.push(current);
    }
  }

  return merged;
}

/**
 * 空き時間スロットを計算する
 *
 * @param date     - 対象の日付
 * @param settings - ユーザーの設定（作業時間・昼休みなど）
 * @param events   - その日のカレンダーイベント一覧
 * @param minSlotMinutes - この分数未満のスロットは除外する（デフォルト15分）
 * @returns        空き時間スロットの配列
 */
export function getFreeSlots(
  date: Date,
  settings: Settings,
  events: CalendarEvent[],
  minSlotMinutes = 15
): FreeSlot[] {

  // ---- 作業時間の開始・終了を Date に変換 ----
  const workStart = parseTime(date, settings.wakeUpTime);
  const workEnd   = parseTime(date, settings.bedTime);

  // ---- 「ブロック（使えない時間帯）」を集める ----
  const blocked: Interval[] = [];

  // 昼休みをブロックとして追加
  blocked.push({
    start: parseTime(date, settings.lunchStart),
    end:   parseTime(date, settings.lunchEnd),
  });

  // カレンダーイベントをブロックとして追加
  for (const event of events) {
    if (event.isAllDay) {
      // 終日イベント（誕生日・祝日・学校行事など）は実際の時間を占有しない。
      // 「今日は祝日」という情報をAIに知らせるだけで、作業時間はブロックしない。
      // → スキップ
      continue;
    }
    if (event.isOreHisyo) {
      // 俺秘書が追加した📌イベントは空き時間計算から除外する。
      // これにより、スケジュールを再生成するとき前回の計画が「埋まっている」扱いにならない。
      // （表示はするが、AIへの入力には含めない）
      continue;
    }
    blocked.push({ start: event.start, end: event.end });
  }

  // 作業時間外のブロックは無視する（夜中の予定など）
  const filteredBlocked = blocked.filter(
    (b) => b.end > workStart && b.start < workEnd
  );

  // 重なったブロックを1つに結合
  const mergedBlocked = mergeIntervals(filteredBlocked);

  // ---- ブロックの隙間を「空き時間」として収集 ----
  const freeSlots: FreeSlot[] = [];
  let cursor = workStart; // 「今どこまで処理したか」のポインタ

  for (const block of mergedBlocked) {
    // ブロック開始よりも前に空き時間がある場合
    const blockStart = new Date(Math.max(block.start.getTime(), workStart.getTime()));
    const blockEnd   = new Date(Math.min(block.end.getTime(),   workEnd.getTime()));

    if (cursor < blockStart) {
      const durationMinutes = (blockStart.getTime() - cursor.getTime()) / 60_000;
      freeSlots.push({ start: new Date(cursor), end: new Date(blockStart), durationMinutes });
    }

    // ポインタをブロック終了後まで進める
    if (blockEnd > cursor) {
      cursor = blockEnd;
    }
  }

  // 最後のブロックから作業終了時刻までの空き時間
  if (cursor < workEnd) {
    const durationMinutes = (workEnd.getTime() - cursor.getTime()) / 60_000;
    freeSlots.push({ start: new Date(cursor), end: new Date(workEnd), durationMinutes });
  }

  // 短すぎるスロットを除外（15分未満は現実的にタスクを入れられない）
  return freeSlots.filter((s) => s.durationMinutes >= minSlotMinutes);
}
