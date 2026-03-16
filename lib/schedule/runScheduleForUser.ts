// セッションなしでスケジュール生成 → Google Calendar 反映を行う共通関数
//
// 【なぜこのファイルが必要か？】
// generate/route.ts と apply/route.ts は「ユーザーが画面から操作するとき」用に
// NextAuth のセッション（session.accessToken）を使っている。
// しかし Cron 実行時はセッションが存在しないため、直接 accessToken を受け取る
// 別の関数が必要になる。
//
// 【この関数が行うこと】
// 1. DB からタスク・設定・ログを取得
// 2. Google Calendar から当日イベントを取得
// 3. 空き時間を計算し Gemini にプロンプトを送る
// 4. 旧「俺秘書」イベントを削除 → 新イベントを作成
// 5. Task・Log テーブルを更新

import { prisma } from "@/lib/prisma";
import { getCalendarEvents } from "@/lib/calendar/getCalendarEvents";
import { getFreeSlots } from "@/lib/calendar/getFreeSlots";
import { buildSchedulePrompt } from "@/lib/ai/buildSchedulePrompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SCHEDULE_TOOL_DECLARATIONS, createToolHandlers } from "@/lib/ai/scheduleTools";
import { google } from "googleapis";
import { z } from "zod";

// ---- 型定義 ----

export interface RunScheduleOptions {
  userId:      string;  // 対象ユーザーのID
  accessToken: string;  // 有効な Google アクセストークン
  targetDate:  Date;    // スケジュールを生成する対象日
}

export interface RunScheduleResult {
  success:      boolean;
  appliedCount: number;  // 成功したイベント作成数
  error?:       string;  // エラー時のメッセージ
}

// Gemini が返すスケジュール1件の型（generate/route.ts と同じ）
const scheduleItemSchema = z.object({
  taskId: z.string(),
  title:  z.string(),
  start:  z.string().regex(/^\d{2}:\d{2}$/),
  end:    z.string().regex(/^\d{2}:\d{2}$/),
  note:   z.string(),
});

const scheduleResponseSchema = z.object({
  schedule: z.array(scheduleItemSchema),
  comment:  z.string(),
});

// "2024-03-15" + "09:00" → Date オブジェクト（apply/route.ts と同じ）
function toDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`);
}

// ---- メイン関数 ----

export async function runScheduleForUser(
  opts: RunScheduleOptions
): Promise<RunScheduleResult> {
  const { userId, accessToken, targetDate } = opts;

  // ── 1. DB から全データを並列取得 ──
  const [settings, tasks, recurringTasks, recentLogs, calendarEvents] = await Promise.all([

    // ユーザー設定
    prisma.settings.upsert({
      where:  { userId },
      update: {},
      create: {
        userId,
        wakeUpTime:       "07:00",
        bedTime:          "23:00",
        lunchStart:       "12:00",
        lunchEnd:         "13:00",
        aiPersonality:    "BALANCED",
        calendarMode:     "AUTO",
        cronTime:         "12:00",
        cronTargetOffset: 1,
      },
    }),

    // 進行中タスク（優先度高・期限近い順）
    prisma.task.findMany({
      where:   { userId, status: "IN_PROGRESS" },
      orderBy: [{ priority: "asc" }, { deadline: "asc" }],
    }),

    // アクティブな定期タスク
    prisma.recurringTask.findMany({
      where:   { userId, isActive: true },
      orderBy: { priority: "asc" },
    }),

    // 過去5日分の実績ログ
    prisma.log.findMany({
      where: {
        userId,
        createdAt:     { gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        actualMinutes: { not: null },
      },
      include: { task: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take:    10,
    }),

    // Google Calendar の当日イベント
    getCalendarEvents(accessToken, targetDate).catch((err) => {
      console.warn(`[runScheduleForUser] カレンダー取得失敗（userId=${userId}）:`, err.message);
      return [];
    }),
  ]);

  // ── 2. 定期タスクの適用判定（generate/route.ts と同じロジック）──
  function isRecurringTaskApplicable(
    task: (typeof recurringTasks)[0],
    date: Date
  ): boolean {
    const jsDay  = date.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    switch (task.recurrenceType) {
      case "DAILY":
        return true;

      case "WEEKLY": {
        if (!task.daysOfWeek) return false;
        try {
          const days: number[] = JSON.parse(task.daysOfWeek);
          return days.includes(isoDay);
        } catch {
          return false;
        }
      }

      case "INTERVAL": {
        if (!task.intervalDays) return false;
        const start = new Date(task.startDate);
        start.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
          (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= 0 && diffDays % task.intervalDays === 0;
      }

      case "MONTHLY":
        return task.dayOfMonth === date.getDate();

      default:
        return false;
    }
  }

  const applicableRecurringTasks = recurringTasks.filter((t) =>
    isRecurringTaskApplicable(t, targetDate)
  );

  // ── 3. スキップ条件チェック ──
  const freeSlots = getFreeSlots(targetDate, settings, calendarEvents);

  if (freeSlots.length === 0) {
    console.log(`[runScheduleForUser] 空き時間なし: userId=${userId}`);
    return { success: false, appliedCount: 0, error: "空き時間がありません" };
  }

  if (tasks.length === 0 && applicableRecurringTasks.length === 0) {
    console.log(`[runScheduleForUser] タスクなし: userId=${userId}`);
    return { success: false, appliedCount: 0, error: "タスクがありません" };
  }

  // ── 4. Gemini API 呼び出し ──
  const timedEvents = calendarEvents.filter((e) => !e.isAllDay && !e.isOreHisyo);

  const prompt = buildSchedulePrompt({
    targetDate,
    tasks,
    recurringTasks: applicableRecurringTasks,
    freeSlots,
    settings,
    recentLogs,
    timedEvents,
  });

  const toolHandlers = createToolHandlers(
    accessToken,
    settings.location ?? "",
  );

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model  = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [{ functionDeclarations: SCHEDULE_TOOL_DECLARATIONS as any }],
    generationConfig: { temperature: 0.7 },
  });

  let rawText: string;
  try {
    const chat = model.startChat();
    let result = await chat.sendMessage(prompt);

    for (let i = 0; i < 5; i++) {
      const calls = result.response.functionCalls();
      if (!calls?.length) break;

      const toolResponses = await Promise.all(
        calls.map(async (call) => {
          const handler = toolHandlers[call.name as keyof typeof toolHandlers];
          if (!handler) {
            return {
              functionResponse: {
                name:     call.name,
                response: { error: `Unknown tool: ${call.name}` },
              },
            };
          }
          const response = await handler(call.args as never);
          return {
            functionResponse: {
              name:     call.name,
              response: response ?? { error: "No result" },
            },
          };
        })
      );

      result = await chat.sendMessage(toolResponses);
    }

    rawText = result.response.text().trim();
    if (rawText.startsWith("```")) {
      rawText = rawText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

  } catch (err) {
    console.error(`[runScheduleForUser] Gemini API error (userId=${userId}):`, err);
    return { success: false, appliedCount: 0, error: "Gemini API エラー" };
  }

  // ── 5. レスポンスのパース・バリデーション ──
  let scheduleData: z.infer<typeof scheduleResponseSchema>;
  try {
    const parsed = JSON.parse(rawText);
    const validation = scheduleResponseSchema.safeParse(parsed);
    if (!validation.success) {
      console.error(`[runScheduleForUser] Schema error (userId=${userId}):`, validation.error.flatten());
      return { success: false, appliedCount: 0, error: "AI レスポンスの形式エラー" };
    }
    scheduleData = validation.data;
  } catch {
    console.error(`[runScheduleForUser] JSON parse error (userId=${userId}). Raw:`, rawText.slice(0, 200));
    return { success: false, appliedCount: 0, error: "AI レスポンスの JSON パースエラー" };
  }

  // ── 6. Google Calendar クライアント設定 ──
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const dateStr = targetDate.toISOString().split("T")[0]; // "2024-03-15"

  // ── 7. 旧「俺秘書」イベントを削除（apply/route.ts と同じロジック）──
  {
    const dayStart = new Date(`${dateStr}T00:00:00+09:00`);
    const dayEnd   = new Date(`${dateStr}T23:59:59+09:00`);
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
            // 手動削除済みなどは無視
          }
        }
      }
    } catch {
      // 削除失敗は無視して新規追加を優先
    }
  }

  // ── 8. 新イベントを作成 + DB 更新 ──
  let appliedCount = 0;
  const taskEventIds = new Map<string, string[]>();

  for (const item of scheduleData.schedule) {
    const startDt = toDateTime(dateStr, item.start);
    const endDt   = toDateTime(dateStr, item.end);

    try {
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

      const isRecurring = item.taskId.startsWith("RECURRING_");
      if (item.taskId !== "SLEEP_BLOCK" && !isRecurring) {
        const ids = taskEventIds.get(item.taskId) ?? [];
        ids.push(calendarEventId);
        taskEventIds.set(item.taskId, ids);

        await prisma.task.update({
          where: { id: item.taskId },
          data: {
            scheduledStart:  startDt,
            scheduledEnd:    endDt,
            calendarEventId: JSON.stringify(taskEventIds.get(item.taskId)),
            status:          "IN_PROGRESS",
          },
        });

        const todayStart = new Date(dateStr);
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

      appliedCount++;

    } catch (err) {
      console.error(`[runScheduleForUser] Calendar insert error (taskId=${item.taskId}):`, err);
    }
  }

  console.log(`[runScheduleForUser] 完了: userId=${userId}, applied=${appliedCount}/${scheduleData.schedule.length}`);
  return { success: true, appliedCount };
}
