import type { ScheduleItem } from "@/types/schedule";
import { Sparkles, Coffee } from "lucide-react";

const blockStyles: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  TASK: {
    bg: "bg-blue-50",
    border: "border-l-2 border-blue-400",
    text: "text-slate-800",
  },
  BUFFER: {
    bg: "bg-slate-50",
    border: "border-l-2 border-slate-200",
    text: "text-slate-400",
  },
  BREAK: {
    bg: "bg-slate-50",
    border: "",
    text: "text-slate-400",
  },
  EXISTING: {
    bg: "bg-slate-100",
    border: "border-l-2 border-slate-300",
    text: "text-slate-500",
  },
};

export function ScheduleBlock({ item }: { item: ScheduleItem }) {
  const style = blockStyles[item.type] ?? blockStyles.TASK;

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-md ${style.bg} ${style.border}`}
    >
      <div className="w-16 shrink-0">
        <span className={`text-[10px] font-bold tabular-nums ${style.text}`}>
          {item.start}
        </span>
        <span className="text-[10px] text-slate-300 mx-0.5">–</span>
        <span className={`text-[10px] font-bold tabular-nums ${style.text}`}>
          {item.end}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.type === "TASK" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold tracking-wider">
              <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
              AI生成
            </span>
          )}
          {(item.type === "BREAK" || item.type === "BUFFER") && (
            <Coffee className="w-3 h-3 text-slate-400" strokeWidth={1.5} />
          )}
          <span className={`text-[13px] font-semibold ${style.text}`}>
            {item.title}
          </span>
        </div>
        {item.notes && (
          <p className="text-[10px] text-slate-400 mt-0.5">{item.notes}</p>
        )}
      </div>
    </div>
  );
}
