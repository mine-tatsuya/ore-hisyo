// POST /api/schedule/apply
//
// Gemini が生成したスケジュールを Google Calendar に書き込む。
// 同時に Task テーブルの scheduledStart/End を更新し、Log レコードを作成する。
// Log は将来の「計画 vs 実績」の精度向上に使われる。

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { z } from "zod";
import { NextRequest } from "next/server";

const applySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // "2024-03-15"
  schedule: z.array(
    z.object({
      taskId: z.string(),
      title:  z.string(),
      start:  z.string().regex(/^\d{2}:\d{2}$/),
      end:    z.string().regex(/^\d{2}:\d{2}$/),
      note:   z.string(),
    })
  ),
});

// "2024-03-15" + "09:00" → Date オブジェクト
function toDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`);
}

// calendarEventId は JSON 配列（複数IDあり）または単一ID文字列で保存される。
// どちらにも対応するためのパースヘルパー。
//
// 例:
//   '["id1","id2"]'  → ["id1", "id2"]  （分割タスク）
//   '"id1"'          → ["id1"]          （通常タスク、旧形式）
//   'id1'            → ["id1"]          （さらに旧い形式）
function parseEventIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    // JSON でなければ単一IDとして扱う
    return [raw];
  }
}

export async function POST(req: NextRequest) {
  // ── 認証チェック ──
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body   = await req.json();

  // バリデーション
  const result = applySchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: "入力形式が不正です", issues: result.error.flatten() }, { status: 400 });
  }

  const { date, schedule } = result.data;

  // ── Google Calendar クライアント設定 ──
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: session.accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  // ── フェーズ1: 既存のカレンダーイベントをまとめて削除 ──
  //
  // 【なぜループの外で削除するのか？】
  // 同じタスクが 9:00-10:00 と 14:00-15:00 の2ブロックに分割されている場合、
  // ループ内で削除すると「1回目のループで作った 9:00-10:00 のイベント」を
  // 「2回目のループが誤って削除」してしまう。
  // → ループ前にまとめて削除することで、この問題を回避する。

  // 1-a. 通常タスクの既存イベントを DB 経由で削除
  // SLEEP_BLOCK は Task テーブルに存在しないので除外する
  const uniqueTaskIds = [...new Set(schedule.map((i) => i.taskId))].filter((id) => id !== "SLEEP_BLOCK");

  const tasksWithEvents = await prisma.task.findMany({
    where: { id: { in: uniqueTaskIds }, calendarEventId: { not: null } },
    select: { id: true, calendarEventId: true },
  });

  for (const task of tasksWithEvents) {
    for (const eventId of parseEventIds(task.calendarEventId)) {
      try {
        await calendar.events.delete({ calendarId: "primary", eventId });
      } catch {
        // 手動削除済みなどの場合は無視して続行
      }
    }
  }

  // 1-b. 睡眠ブロックの既存イベントを Google Calendar から直接検索して削除
  //
  // SLEEP_BLOCK は DB に保存しないため、前回追加したイベントIDを追跡できない。
  // 代わりに Google Calendar API の privateExtendedProperty フィルターを使い、
  // 「source=ore-hisyo かつ taskId=SLEEP_BLOCK」のイベントを対象日から検索して削除する。
  if (schedule.some((i) => i.taskId === "SLEEP_BLOCK")) {
    // 対象日の 00:00〜翌日 00:00（UTC）を timeMin/timeMax に設定
    const dayStart = new Date(`${date}T00:00:00+09:00`);
    const dayEnd   = new Date(`${date}T23:59:59+09:00`);

    try {
      const existingSleepRes = await calendar.events.list({
        calendarId: "primary",
        timeMin:    dayStart.toISOString(),
        timeMax:    dayEnd.toISOString(),
        privateExtendedProperty: ["source=ore-hisyo", "taskId=SLEEP_BLOCK"],
      });

      for (const event of existingSleepRes.data.items ?? []) {
        if (event.id) {
          try {
            await calendar.events.delete({ calendarId: "primary", eventId: event.id });
          } catch {
            // 手動削除済みの場合は無視
          }
        }
      }
    } catch {
      // 検索失敗時は無視して続行（重複が残るより追加を優先）
    }
  }

  // ── フェーズ2: イベントを新規作成 ──
  const appliedItems: { taskId: string; calendarEventId: string }[] = [];
  const errors: { taskId: string; error: string }[] = [];

  // 同じタスクが複数ブロックある場合、そのタスクに紐づくイベントIDを蓄積するMap
  // 例: { "taskId-abc": ["event1", "event2"] }
  const taskEventIds = new Map<string, string[]>();

  for (const item of schedule) {
    const startDt = toDateTime(date, item.start);
    const endDt   = toDateTime(date, item.end);

    try {
      // ── Google Calendar に新しいイベントを作成 ──
      // （削除ロジックはフェーズ1で完了しているので、ここでは作成のみ）
      const event = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary:     `📌 ${item.title}`,
          description: item.note,
          start: { dateTime: startDt.toISOString(), timeZone: "Asia/Tokyo" },
          end:   { dateTime: endDt.toISOString(),   timeZone: "Asia/Tokyo" },
          extendedProperties: {
            private: { source: "ore-hisyo", taskId: item.taskId },
          },
        },
      });

      const calendarEventId = event.data.id ?? "";
      const plannedMinutes  = Math.round((endDt.getTime() - startDt.getTime()) / 60_000);

      // SLEEP_BLOCK は Task/Log テーブルに存在しないので DB 操作をスキップ
      if (item.taskId !== "SLEEP_BLOCK") {
        // このタスクのイベントIDリストに追加（分割タスク対応）
        const ids = taskEventIds.get(item.taskId) ?? [];
        ids.push(calendarEventId);
        taskEventIds.set(item.taskId, ids);

        // ── Task テーブルを更新 ──
        // calendarEventId は JSON 配列で保存（複数ブロック対応）
        // 例: '["event1","event2"]'
        await prisma.task.update({
          where: { id: item.taskId },
          data: {
            scheduledStart:  startDt,
            scheduledEnd:    endDt,
            calendarEventId: JSON.stringify(taskEventIds.get(item.taskId)),
            status: "IN_PROGRESS",
          },
        });

        // ── Log レコードを作成（今日分の重複は削除してから再作成）──
        const todayStart = new Date(date);
        todayStart.setHours(0, 0, 0, 0);
        await prisma.log.deleteMany({
          where: {
            taskId:       item.taskId,
            plannedStart: { gte: todayStart },
          },
        });
        await prisma.log.create({
          data: {
            userId,
            taskId:         item.taskId,
            plannedStart:   startDt,
            plannedEnd:     endDt,
            plannedMinutes: plannedMinutes,
          },
        });
      }

      appliedItems.push({ taskId: item.taskId, calendarEventId });

    } catch (err) {
      console.error(`[schedule/apply] Failed for taskId=${item.taskId}:`, err);
      errors.push({
        taskId: item.taskId,
        error:  err instanceof Error ? err.message : "不明なエラー",
      });
    }
  }

  return Response.json({
    appliedCount: appliedItems.length,
    errorCount:   errors.length,
    applied: appliedItems,
    errors,
  });
}
