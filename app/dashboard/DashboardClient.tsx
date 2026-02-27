"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TaskSummaryCard } from "@/components/dashboard/TaskSummaryCard";
import { TodaySchedulePanel } from "@/components/dashboard/TodaySchedulePanel";
import type { GeneratedSchedule } from "@/types/schedule";

export function DashboardClient() {
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const targetDate = format(new Date(), "yyyy-MM-dd");

  const handleGenerate = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate }),
      });
      const data = await res.json();
      if (res.ok) setSchedule(data.schedule);
    } finally {
      setScheduleLoading(false);
    }
  }, [targetDate]);

  const handleApply = useCallback(async () => {
    if (!schedule) return;
    if (!confirm("Googleカレンダーに反映しますか？")) return;
    setApplying(true);
    try {
      const res = await fetch("/api/schedule/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule, targetDate }),
      });
      if (res.ok) setApplied(true);
    } finally {
      setApplying(false);
    }
  }, [schedule, targetDate]);

  return (
    <div>
      <DashboardHeader />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskSummaryCard />
        <TodaySchedulePanel
          schedule={schedule}
          loading={scheduleLoading}
          onGenerate={handleGenerate}
          onApply={handleApply}
          applying={applying}
          applied={applied}
        />
      </div>
    </div>
  );
}
