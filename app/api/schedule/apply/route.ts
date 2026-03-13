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

  // ── フェーズ1: 対象日の俺秘書イベントをすべて削除 ──
  //
  // イベント作成時に extendedProperties.private.source = "ore-hisyo" を付けているので、
  // この目印で「俺秘書が追加したイベント全件」を検索できる。
  //
  // 旧方式（DBのcalendarEventIdを使う）では「今回のスケジュールに含まれるタスクの
  // 旧イベント」しか削除できず、前回スケジュールにあって今回はないタスク・睡眠ブロック・
  // 誤って追加された休憩イベントなどが残り続けてしまう。
  // → 対象日の source=ore-hisyo を全削除してから新規追加することで、この問題を解決する。
  {
    const dayStart = new Date(`${date}T00:00:00+09:00`);
    const dayEnd   = new Date(`${date}T23:59:59+09:00`);
    try {
      const existingRes = await calendar.events.list({
        calendarId: "primary",
        timeMin:    dayStart.toISOString(),
        timeMax:    dayEnd.toISOString(),
        privateExtendedProperty: ["source=ore-hisyo"],
      });
      for (const event of existingRes.data.items ?? []) {
        if (event.id) {
          try {
            await calendar.events.delete({ calendarId: "primary", eventId: event.id });
          } catch {
            // 手動削除済みなどの場合は無視して続行
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

      // SLEEP_BLOCK と RECURRING_ プレフィックスのタスクは Task/Log テーブルに存在しないので DB 操作をスキップ
      // RECURRING_ は定期タスク（RecurringTask モデル）であり、Task モデルには存在しない
      const isRecurring = item.taskId.startsWith("RECURRING_");
      if (item.taskId !== "SLEEP_BLOCK" && !isRecurring) {
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
