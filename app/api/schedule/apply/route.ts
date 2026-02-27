import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import type { GeneratedSchedule } from "@/types/schedule";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.accessToken) return Response.json({ error: "No access token" }, { status: 401 });

  const { schedule, targetDate }: { schedule: GeneratedSchedule; targetDate: string } =
    await req.json();

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const results: Array<{ taskId: string | null; eventId: string }> = [];

  for (const item of schedule.scheduleItems) {
    if (item.type !== "TASK") continue;

    const [startH, startM] = item.start.split(":").map(Number);
    const [endH, endM] = item.end.split(":").map(Number);

    const startDateTime = new Date(`${targetDate}T00:00:00`);
    startDateTime.setHours(startH, startM, 0, 0);
    const endDateTime = new Date(`${targetDate}T00:00:00`);
    endDateTime.setHours(endH, endM, 0, 0);

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `[俺秘書] ${item.title}`,
        description: item.notes ?? "",
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
        colorId: "1", // ブルー
      },
    });

    const eventId = event.data.id!;
    results.push({ taskId: item.taskId, eventId });

    // Task に eventId を保存
    if (item.taskId) {
      await prisma.task.update({
        where: { id: item.taskId },
        data: { calendarEventId: eventId },
      });
    }
  }

  return Response.json({ results });
}
