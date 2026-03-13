"use client";

// RecurringTaskCard
// 定期タスク1件を表示するカードコンポーネント。
// TaskCard と同じデザイン言語を使い、繰り返しパターン・希望時間帯を追加表示します。

import type { RecurringTask } from "@prisma/client";
import { Clock, RefreshCw, ChevronRight, Power } from "lucide-react";

interface RecurringTaskCardProps {
  task: RecurringTask;
  onToggleActive: (id: string, isActive: boolean) => void;
  onClick: () => void;
}

// 優先度ごとのスタイル（TaskCard と同じ）
const priorityConfig = {
  HIGH:   { border: "border-rose-400",   dot: "bg-rose-500" },
  MEDIUM: { border: "border-yellow-400", dot: "bg-yellow-400" },
  LOW:    { border: "border-slate-300",  dot: "bg-slate-300" },
};

// 繰り返しパターンを日本語で表示する
// daysOfWeek は "[1,3,5]" のような JSON 文字列（1=月〜7=日）
function formatRecurrence(task: RecurringTask): string {
  const dayLabels = ["", "月", "火", "水", "木", "金", "土", "日"];
  switch (task.recurrenceType) {
    case "DAILY":
      return "毎日";
    case "WEEKLY": {
      if (!task.daysOfWeek) return "毎週";
      try {
        const days: number[] = JSON.parse(task.daysOfWeek);
        return `毎週 ${days.map((d) => dayLabels[d]).join("・")}`;
      } catch {
        return "毎週";
      }
    }
    case "INTERVAL":
      return `${task.intervalDays}日ごと`;
    case "MONTHLY":
      return `毎月${task.dayOfMonth}日`;
    default:
      return "";
  }
}

// 希望時間帯を日本語で表示する
function formatPreferredTime(task: RecurringTask): string | null {
  if (!task.preferredTimeType) return null;
  switch (task.preferredTimeType) {
    case "MORNING":  return "朝（6:00〜10:00）";
    case "NOON":     return "昼（11:00〜14:00）";
    case "EVENING":  return "夜（18:00〜22:00）";
    case "SPECIFIC": return task.preferredStartTime ?? "";
    default:         return null;
  }
}

// 分を「1時間30分」形式に変換
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export default function RecurringTaskCard({
  task,
  onToggleActive,
  onClick,
}: RecurringTaskCardProps) {
  const { border, dot } = priorityConfig[task.priority];
  const recurrenceLabel  = formatRecurrence(task);
  const preferredTime    = formatPreferredTime(task);

  return (
    <div
      className={`
        bg-white/80 backdrop-blur-sm rounded-xl
        border border-white/60 border-l-4 ${border}
        shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        hover:shadow-md transition-shadow duration-200
        ${!task.isActive ? "opacity-50" : ""}
      `}
    >
      {/* カード上部 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-2">
          {/* 優先度ドット */}
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />

          {/* タイトル（クリックで詳細を開く） */}
          <button
            onClick={onClick}
            className="flex-1 text-left text-[13px] font-semibold text-slate-800 hover:text-[#0052FF] transition-colors leading-snug"
          >
            {task.title}
            {!task.isActive && (
              <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                停止中
              </span>
            )}
          </button>

          {/* 詳細を開く矢印ボタン */}
          <button
            onClick={onClick}
            className="flex-shrink-0 p-1 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* カード下部：メタ情報 */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        {/* 繰り返しパターン */}
        <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-blue-50 px-2 py-0.5 rounded-full">
          <RefreshCw className="w-3 h-3 text-blue-400" />
          {recurrenceLabel}
        </span>

        {/* 希望時間帯 */}
        {preferredTime && (
          <span className="text-[10px] text-slate-400">
            {preferredTime}
          </span>
        )}

        {/* 所要時間 */}
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <Clock className="w-3 h-3" />
          {formatMinutes(task.estimatedMinutes)}
        </span>

        {/* isActive トグル（右端） */}
        <div className="ml-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive(task.id, !task.isActive);
            }}
            className={`
              flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded
              border transition-colors
              ${task.isActive
                ? "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                : "text-slate-400 border-slate-200 bg-slate-50 hover:bg-slate-100"
              }
            `}
            title={task.isActive ? "クリックして停止" : "クリックして有効化"}
          >
            <Power className="w-3 h-3" />
            {task.isActive ? "有効" : "停止"}
          </button>
        </div>
      </div>
    </div>
  );
}
