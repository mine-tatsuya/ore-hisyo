// GET /api/schedule/generate
//
// タスク + カレンダー空き時間 + 設定 + 実績ログを Gemini に渡し、
// 今日のスケジュール（JSON）を生成して返す。

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getCalendarEvents } from "@/lib/calendar/getCalendarEvents";
import { getFreeSlots } from "@/lib/calendar/getFreeSlots";
import { buildSchedulePrompt } from "@/lib/ai/buildSchedulePrompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SCHEDULE_TOOL_DECLARATIONS, createToolHandlers } from "@/lib/ai/scheduleTools";
import { z } from "zod";
import { NextRequest } from "next/server";

// Gemini が返すスケジュールの1件分の型定義
const scheduleItemSchema = z.object({
  taskId: z.string(),
  title:  z.string(),
  start:  z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式である必要があります"),
  end:    z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式である必要があります"),
  note:   z.string(),
});

// Gemini のレスポンス全体の型定義
const scheduleResponseSchema = z.object({
  schedule: z.array(scheduleItemSchema),
  comment:  z.string(),
});

export type ScheduleItem    = z.infer<typeof scheduleItemSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

export async function GET(req: NextRequest) {
  // ── 認証チェック ──
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (!session.accessToken) {
    return Response.json(
      { error: "Google アクセストークンがありません。再ログインしてください。" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // ── 対象日付の解決（?date=2024-03-15、省略時は今日）──
  const dateParam  = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(targetDate.getTime())) {
    return Response.json({ error: "日付の形式が不正です（例: ?date=2024-03-15）" }, { status: 400 });
  }

  // ── 全データを並列取得（Promise.all で同時実行し、待ち時間を最小化）──
  const [settings, tasks, recurringTasks, recentLogs, calendarEvents] = await Promise.all([

    // ① ユーザー設定（なければデフォルト作成）
    prisma.settings.upsert({
      where:  { userId },
      update: {},
      create: {
        userId,
        wakeUpTime:    "07:00",
        bedTime:       "23:00",
        lunchStart:    "12:00",
        lunchEnd:      "13:00",
        aiPersonality: "BALANCED",
        calendarMode:  "MANUAL",
      },
    }),

    // ② 進行中タスクのみ（未着手・完了・キャンセルは除外）
    //    優先度高 → 期限が近い順で並べてAIに渡す
    prisma.task.findMany({
      where: {
        userId,
        status: "IN_PROGRESS",
      },
      orderBy: [
        { priority: "asc" },   // HIGH=1 < MEDIUM=2 < LOW=3 の辞書順になる
        { deadline: "asc" },   // 期限が早いほど前に
      ],
    }),

    // ③ アクティブな定期タスクを全件取得
    prisma.recurringTask.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: "asc" },
    }),

    // ④ 過去5日分の実績ログ（計画 vs 実績の傾向をAIに教える）
    prisma.log.findMany({
      where: {
        userId,
        createdAt: {
          // 5日前の00:00以降
          gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        actualMinutes: { not: null }, // 実績が記録されたログのみ
      },
      include: { task: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take:    10, // 最大10件（多すぎるとプロンプトが長くなる）
    }),

    // ⑤ Google Calendar の当日イベント取得
    //    失敗しても空配列にして処理を続行（カレンダーなしでも生成できるように）
    getCalendarEvents(session.accessToken, targetDate).catch((err) => {
      console.warn("[schedule/generate] カレンダー取得失敗（空配列で続行）:", err.message);
      return [];
    }),
  ]);

  // ── 定期タスクの適用判定 ──
  // 対象日に「今日やるべき定期タスク」かどうかを判定する関数
  // recurrenceType（繰り返しタイプ）ごとにロジックが異なります
  function isRecurringTaskApplicable(
    task: (typeof recurringTasks)[0],
    date: Date
  ): boolean {
    // 曜日：1=月曜, 2=火曜, ... 7=日曜（ISO 8601 準拠）
    // JavaScript の getDay() は 0=日曜なので変換が必要
    const jsDay  = date.getDay(); // 0=日〜6=土
    const isoDay = jsDay === 0 ? 7 : jsDay; // 1=月〜7=日

    switch (task.recurrenceType) {
      case "DAILY":
        // 毎日なので常に true
        return true;

      case "WEEKLY": {
        // daysOfWeek は "[1,3,5]" のような JSON 文字列
        if (!task.daysOfWeek) return false;
        try {
          const days: number[] = JSON.parse(task.daysOfWeek);
          return days.includes(isoDay);
        } catch {
          return false;
        }
      }

      case "INTERVAL": {
        // startDate から何日経ったかを計算し、intervalDays で割り切れる日が実施日
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
        // dayOfMonth と今日の日付が一致するか
        return task.dayOfMonth === date.getDate();

      default:
        return false;
    }
  }

  // 今日適用される定期タスクを絞り込む
  const applicableRecurringTasks = recurringTasks.filter((t) =>
    isRecurringTaskApplicable(t, targetDate)
  );

  // ── 空き時間の計算 ──
  const freeSlots = getFreeSlots(targetDate, settings, calendarEvents);

  // デバッグ用ログ（開発中のみ）
  if (process.env.NODE_ENV === "development") {
    console.log("[schedule/generate] カレンダーイベント数:", calendarEvents.length);
    calendarEvents.forEach(e =>
      console.log(`  - ${e.isAllDay ? "[終日]" : ""} ${e.title} ${e.start.toLocaleTimeString("ja-JP")}〜${e.end.toLocaleTimeString("ja-JP")}`)
    );
    console.log("[schedule/generate] 空き時間スロット数:", freeSlots.length);
    freeSlots.forEach(s =>
      console.log(`  - ${s.start.toLocaleTimeString("ja-JP")}〜${s.end.toLocaleTimeString("ja-JP")} (${Math.round(s.durationMinutes)}分)`)
    );
  }

  // 空き時間がゼロ = スケジュールを組む余地がない
  if (freeSlots.length === 0) {
    return Response.json(
      {
        error: "今日は空き時間がありません（カレンダーが埋まっているか、作業時間外です）",
        // デバッグ情報（開発中のみ表示）
        _debug: process.env.NODE_ENV === "development" ? {
          calendarEventCount: calendarEvents.length,
          events: calendarEvents.map(e => ({
            title: e.title,
            isAllDay: e.isAllDay,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
          })),
          workStart: settings.wakeUpTime,
          workEnd: settings.bedTime,
        } : undefined,
      },
      { status: 400 }
    );
  }

  // タスクも定期タスクもゼロ = 何もスケジュールするものがない
  if (tasks.length === 0 && applicableRecurringTasks.length === 0) {
    return Response.json(
      { error: "進行中のタスクも本日の定期タスクもありません。タスクを「進行中」に変更するか、定期タスクを追加してからスケジュールを生成してください。" },
      { status: 400 }
    );
  }

  // ── プロンプト組み立て ──
  // 時間指定イベントのうち「俺秘書が追加したもの以外」をAIに渡す
  // （終日イベント・自分が入れた📌イベントはAIの参考情報として不要なので除外）
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

  // ── Gemini API 呼び出し（Function Calling 対応）──
  //
  // Function Calling の仕組み:
  // 1. プロンプト + ツール一覧を送る
  // 2. AI が「ツールを呼びたい」と判断 → functionCalls() に配列が入る
  // 3. こちらがツールを実行して結果を返す
  // 4. AI がまたツールを呼ぶ or 最終 JSON を返す
  // 5. 最大5回ループして無限ループを防止

  // ツールハンドラーを生成（クロージャで accessToken と location を束縛）
  const toolHandlers = createToolHandlers(
    session.accessToken,
    settings.location ?? "",
  );

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model  = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    // ツール定義を渡すことで Gemini が Function Calling を使えるようになる
    tools: [{ functionDeclarations: SCHEDULE_TOOL_DECLARATIONS as any }],
    generationConfig: {
      // ※ Function Calling 中間レスポンスと干渉するため responseMimeType は除去。
      //    代わりにプロンプトで「最終回答は必ず JSON 形式で」と明示する。
      temperature: 0.7,
    },
  });

  let rawText: string;
  try {
    // startChat() でチャット形式にする（Function Calling はチャット形式が必須）
    const chat = model.startChat();
    let result = await chat.sendMessage(prompt);

    // ── Function Calling ループ ──
    // AI がツールを呼びたいとき → functionCalls() に配列が入る
    // ツール結果を返す → AI がまたツールを呼ぶ or 最終回答を返す
    for (let i = 0; i < 5; i++) {
      const calls = result.response.functionCalls();
      if (!calls?.length) break; // ツール呼び出しなし → ループ終了

      // 全ツール呼び出しを並列実行（複数ある場合に効率化）
      const toolResponses = await Promise.all(
        calls.map(async (call) => {
          const handler = toolHandlers[call.name as keyof typeof toolHandlers];
          if (!handler) {
            // 未知のツール名が来た場合はエラーを返す
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

      // ツール実行結果を AI に返して次のターンへ
      result = await chat.sendMessage(toolResponses);
    }

    rawText = result.response.text();

    // Gemini が ```json ... ``` で囲って返してくることがあるので除去する
    rawText = rawText.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

  } catch (error) {
    console.error("[schedule/generate] Gemini API error:", error);
    return Response.json(
      { error: "AI の呼び出しに失敗しました。しばらく後に再試行してください。" },
      { status: 502 }
    );
  }

  // ── レスポンスのパース・バリデーション ──
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("[schedule/generate] JSON parse error. Raw:", rawText.slice(0, 200));
    return Response.json(
      { error: "AI の返答を解析できませんでした。再試行してください。" },
      { status: 500 }
    );
  }

  const validation = scheduleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    console.error("[schedule/generate] Schema validation error:", validation.error.flatten());
    return Response.json(
      { error: "AI の返答の形式が不正でした。再試行してください。" },
      { status: 500 }
    );
  }

  // ── 正常レスポンス ──
  return Response.json({
    date:     targetDate.toISOString().split("T")[0],
    schedule: validation.data.schedule,
    comment:  validation.data.comment,
    // カレンダーが取得できなかった場合の警告フラグ
    calendarWarning: calendarEvents.length === 0
      ? "Google Calendar の取得に失敗したため、カレンダーの予定は考慮されていません"
      : null,
  });
}
