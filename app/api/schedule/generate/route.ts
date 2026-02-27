import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/gemini";
import { buildSchedulePrompt } from "@/lib/ai/buildSchedulePrompt";
import { getFreeSlotsFromCalendar } from "@/lib/calendar/getFreeSlots";
import type { GeneratedSchedule } from "@/types/schedule";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { targetDate } = await req.json();
  if (!targetDate) return Response.json({ error: "targetDate is required" }, { status: 400 });

  const userId = session.user.id;

  const [settings, tasks, logs] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.task.findMany({
      where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    }),
    prisma.log.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!settings) {
    return Response.json({ error: "Settings not found" }, { status: 404 });
  }

  // Google Calendar から空き時間を取得
  let freeSlots: import("@/lib/calendar/getFreeSlots").FreeSlot[] = [];
  try {
    if (session.accessToken) {
      freeSlots = await getFreeSlotsFromCalendar(session.accessToken, targetDate);
    }
  } catch {
    // カレンダー取得失敗時は空きスロットとして全稼働時間を使う
    const workStart = new Date(`${targetDate}T${settings.wakeUpTime}:00`);
    const workEnd = new Date(`${targetDate}T${settings.bedTime}:00`);
    freeSlots = [{
      start: workStart,
      end: workEnd,
      durationMinutes: Math.floor((workEnd.getTime() - workStart.getTime()) / 60000),
    }];
  }

  // タスクの残り時間を計算
  const tasksWithRemaining = tasks.map((task) => ({
    ...task,
    remainingMinutes: Math.max(
      1,
      Math.ceil(task.estimatedMinutes * (1 - task.progressPct / 100))
    ),
  }));

  // プロンプト生成
  const prompt = buildSchedulePrompt(
    {
      settings: {
        ...settings,
        aiPersonality: settings.aiPersonality as "STRICT" | "BALANCED" | "RELAXED",
      },
      tasks: tasksWithRemaining,
      freeSlots,
      targetDate,
      logs,
    },
    logs
  );

  // Gemini API 呼び出し（リトライ最大2回）
  let schedule: GeneratedSchedule | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const model = getGeminiModel("gemini-1.5-flash");
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      schedule = JSON.parse(cleaned);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (!schedule) {
    return Response.json(
      { error: "スケジュール生成に失敗しました", detail: lastError?.message },
      { status: 500 }
    );
  }

  // Log レコードを作成（計画値記録）
  const targetDay = new Date(targetDate);
  for (const item of schedule.scheduleItems) {
    if (!item.taskId) continue;
    const task = tasks.find((t) => t.id === item.taskId);
    if (!task) continue;

    const [startH, startM] = item.start.split(":").map(Number);
    const [endH, endM] = item.end.split(":").map(Number);
    const plannedStart = new Date(targetDay);
    plannedStart.setHours(startH, startM, 0, 0);
    const plannedEnd = new Date(targetDay);
    plannedEnd.setHours(endH, endM, 0, 0);
    const plannedMinutes = (plannedEnd.getTime() - plannedStart.getTime()) / 60000;

    await prisma.log.create({
      data: {
        userId,
        taskId: task.id,
        plannedStart,
        plannedEnd,
        plannedMinutes,
      },
    });

    // Task のスケジュール情報を更新
    await prisma.task.update({
      where: { id: task.id },
      data: { scheduledStart: plannedStart, scheduledEnd: plannedEnd },
    });
  }

  return Response.json({ schedule, freeSlots: freeSlots.map(s => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    durationMinutes: s.durationMinutes,
  })) });
}
