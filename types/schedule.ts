export type ScheduleItemType = "TASK" | "BREAK" | "BUFFER";

export interface ScheduleItem {
  taskId: string | null;
  title: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  type: ScheduleItemType;
  notes?: string;
}

export interface GeneratedSchedule {
  scheduleItems: ScheduleItem[];
  summary: string;
  warnings: string[];
}

export interface ScheduleInput {
  settings: {
    wakeUpTime: string;
    bedTime: string;
    lunchStart: string;
    lunchEnd: string;
    focusTimeStart?: string | null;
    focusTimeEnd?: string | null;
    aiPersonality: "STRICT" | "BALANCED" | "RELAXED";
    aiCustomPrompt?: string | null;
  };
  tasks: Array<{
    id: string;
    title: string;
    remainingMinutes: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    deadline?: Date | null;
    progressPct: number;
  }>;
  freeSlots: Array<{
    start: Date;
    end: Date;
    durationMinutes: number;
  }>;
  targetDate: string; // "YYYY-MM-DD"
  logs: Array<{
    plannedMinutes: number;
    actualMinutes: number | null;
    accuracyRatio: number | null;
  }>;
}
