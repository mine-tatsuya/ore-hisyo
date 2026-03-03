// GET /api/calendar/events
//
// 指定した日付（省略時は今日）の Google Calendar イベントと空き時間を返す。
// レスポンスは「時間指定イベント」と「終日イベント」を分けて返す。

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getCalendarEvents } from "@/lib/calendar/getCalendarEvents";
import { getFreeSlots } from "@/lib/calendar/getFreeSlots";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  // ---- 認証チェック ----
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.accessToken) {
    return Response.json(
      { error: "Google アクセストークンがありません。再ログインしてください。" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // ---- 日付の解決 ----
  const dateParam  = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();

  if (isNaN(targetDate.getTime())) {
    return Response.json({ error: "date パラメータの形式が不正です（例: ?date=2024-03-15）" }, { status: 400 });
  }

  // ---- ユーザー設定の取得 ----
  const settings = await prisma.settings.upsert({
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
  });

  // ---- Google Calendar からイベント取得 ----
  let events;
  try {
    events = await getCalendarEvents(session.accessToken, targetDate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return Response.json({ error: message }, { status: 502 });
  }

  // ---- 空き時間を計算 ----
  const freeSlots = getFreeSlots(targetDate, settings, events);

  // ---- イベントを「終日」と「時間指定」に分ける ----
  // 終日イベント: 誕生日・祝日・試験期間など（タイムラインには入れない）
  // 時間指定イベント: 授業・会議など（タイムライン上にグレーで表示する）
  const timedEvents  = events.filter((e) => !e.isAllDay);
  const allDayEvents = events.filter((e) =>  e.isAllDay);

  // ---- レスポンス ----
  return Response.json({
    date: targetDate.toISOString().split("T")[0],
    // 時間指定イベント（ISO文字列で返す。フロントで HH:MM に変換）
    timedEvents: timedEvents.map((e) => ({
      id:    e.id,
      title: e.title,
      start: e.start.toISOString(),
      end:   e.end.toISOString(),
    })),
    // 終日イベント（時刻情報は不要なので title のみ）
    allDayEvents: allDayEvents.map((e) => ({
      id:    e.id,
      title: e.title,
    })),
    freeSlots: freeSlots.map((s) => ({
      start:           s.start.toISOString(),
      end:             s.end.toISOString(),
      durationMinutes: s.durationMinutes,
    })),
    totalFreeMinutes: freeSlots.reduce((sum, s) => sum + s.durationMinutes, 0),
  });
}
