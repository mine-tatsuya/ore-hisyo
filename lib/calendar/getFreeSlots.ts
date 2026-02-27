import { google } from "googleapis";

export interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export async function getFreeSlotsFromCalendar(
  accessToken: string,
  targetDate: string,
  cutoffTime?: Date
): Promise<FreeSlot[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  const dayStart = new Date(`${targetDate}T00:00:00`);
  const dayEnd = new Date(`${targetDate}T23:59:59`);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = res.data.items ?? [];

  // 稼働時間内のブロック済みスロットを整理
  const busySlots = events
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      start: new Date(e.start!.dateTime!),
      end: new Date(e.end!.dateTime!),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // 稼働時間を 07:00〜23:00 に設定（設定値があれば使うべきだが、ここでは固定）
  const workStart = new Date(`${targetDate}T07:00:00`);
  const workEnd = new Date(`${targetDate}T23:00:00`);
  const effectiveStart = cutoffTime
    ? new Date(Math.max(workStart.getTime(), cutoffTime.getTime()))
    : workStart;

  const freeSlots: FreeSlot[] = [];
  let current = effectiveStart;

  for (const busy of busySlots) {
    if (busy.start > current && busy.start < workEnd) {
      const end = busy.start < workEnd ? busy.start : workEnd;
      const durationMs = end.getTime() - current.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      if (durationMinutes >= 15) {
        freeSlots.push({ start: current, end, durationMinutes });
      }
    }
    if (busy.end > current) {
      current = new Date(Math.min(busy.end.getTime(), workEnd.getTime()));
    }
  }

  // 最後のイベント以降
  if (current < workEnd) {
    const durationMs = workEnd.getTime() - current.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    if (durationMinutes >= 15) {
      freeSlots.push({ start: current, end: workEnd, durationMinutes });
    }
  }

  return freeSlots;
}
