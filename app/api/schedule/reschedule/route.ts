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
  const now = new Date();

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

  // 現在時刻以降の空きスロットのみ取得
  let freeSlots: import("@/lib/calendar/getFreeSlots").FreeSlot[] = [];
  try {
    if (session.accessToken) {
      freeSlots = await getFreeSlotsFromCalendar(session.accessToken, targetDate, now);
    }
  } catch {
    const workEnd = new Date(`${targetDate}T${settings.bedTime}:00`);
    if (now < workEnd) {
      freeSlots = [{
        start: now,
        end: workEnd,
        durationMinutes: Math.floor((workEnd.getTime() - now.getTime()) / 60000),
      }];
    }
  }

  const tasksWithRemaining = tasks.map((task) => ({
    ...task,
    remainingMinutes: Math.max(
      1,
      Math.ceil(task.estimatedMinutes * (1 - task.progressPct / 100))
    ),
  }));

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
      { error: "リスケジュールに失敗しました", detail: lastError?.message },
      { status: 500 }
    );
  }

  return Response.json({ schedule });
}
