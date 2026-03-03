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
  const [settings, tasks, recentLogs, calendarEvents] = await Promise.all([

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

    // ② 未着手・進行中タスクのみ（完了・キャンセルは除外）
    //    優先度高 → 期限が近い順で並べてAIに渡す
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      orderBy: [
        { priority: "asc" },   // HIGH=1 < MEDIUM=2 < LOW=3 の辞書順になる
        { deadline: "asc" },   // 期限が早いほど前に
      ],
    }),

    // ③ 過去5日分の実績ログ（計画 vs 実績の傾向をAIに教える）
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

    // ④ Google Calendar の当日イベント取得
    //    失敗しても空配列にして処理を続行（カレンダーなしでも生成できるように）
    getCalendarEvents(session.accessToken, targetDate).catch((err) => {
      console.warn("[schedule/generate] カレンダー取得失敗（空配列で続行）:", err.message);
      return [];
    }),
  ]);

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

  // タスクがゼロ = 何もスケジュールするものがない
  if (tasks.length === 0) {
    return Response.json(
      { error: "未着手・進行中のタスクがありません。タスクを追加してください。" },
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
    freeSlots,
    settings,
    recentLogs,
    timedEvents,
  });

  // ── Gemini API 呼び出し ──
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model  = genAI.getGenerativeModel({
    // gemini-1.5-flash は旧世代で現在の API では利用不可
    // gemini-2.0-flash が 2025〜2026年現在の推奨モデル
    // （高速・低コスト・高性能のバランス型）
    model: "gemini-2.5-flash",
    generationConfig: {
      // responseMimeType: "application/json" を指定することで
      // Gemini が必ず JSON のみを返すようになる（```json ... ``` の余計な装飾なし）
      responseMimeType: "application/json",
      temperature: 0.7, // 0=確実性重視, 1=創造性重視。0.7はバランス型
    } as any,
  });

  let rawText: string;
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
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
