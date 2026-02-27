import type { GeneratedSchedule } from "@/types/schedule";
import { ScheduleBlock } from "./ScheduleBlock";
import { AiCommentCard } from "./AiCommentCard";

interface ScheduleTimelineProps {
  schedule: GeneratedSchedule;
}

export function ScheduleTimeline({ schedule }: ScheduleTimelineProps) {
  return (
    <div className="space-y-4">
      <AiCommentCard summary={schedule.summary} warnings={schedule.warnings} />

      <div className="space-y-2">
        {schedule.scheduleItems.map((item, i) => (
          <ScheduleBlock key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
