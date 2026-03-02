"use client";

import type { Task } from "@prisma/client";
import { CalendarDays, Clock, ChevronRight } from "lucide-react";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskProgressBar from "./TaskProgressBar";

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: Task["status"]) => void;
  onClick: () => void; // 詳細シートを開く
}

// 優先度ごとの左ボーダー色と点の色
const priorityConfig = {
  HIGH:   { border: "border-rose-400",   dot: "bg-rose-500" },
  MEDIUM: { border: "border-yellow-400", dot: "bg-yellow-400" },
  LOW:    { border: "border-slate-300",  dot: "bg-slate-300" },
};

// 締切日時を「3月15日 14:30」のような形式に変換
function formatDeadline(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 締切が今日以内かチェック（警告表示用）
function isUrgent(date: Date | null) {
  if (!date) return false;
  const now = new Date();
  const deadline = new Date(date);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 24 && diffHours > 0; // 24時間以内
}

// 分を「2時間30分」のような形式に変換
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export default function TaskCard({ task, onStatusChange, onClick }: TaskCardProps) {
  const { border, dot } = priorityConfig[task.priority];
  const urgent = isUrgent(task.deadline);

  return (
    <div
      className={`
        bg-white/80 backdrop-blur-sm rounded-xl
        border border-white/60 border-l-4 ${border}
        shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        hover:shadow-md transition-shadow duration-200
        ${urgent ? "bg-rose-50/50" : ""}
        ${task.status === "DONE" ? "opacity-60" : ""}
      `}
    >
      {/* カード上部：タイトルと詳細ボタン */}
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
          </button>

          {/* 詳細を開く矢印ボタン */}
          <button
            onClick={onClick}
            className="flex-shrink-0 p-1 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 進捗バー（IN_PROGRESS のときのみ表示） */}
        {task.status === "IN_PROGRESS" && (
          <div className="mt-2.5 ml-4">
            <TaskProgressBar value={task.progressPct} />
          </div>
        )}
      </div>

      {/* カード下部：メタ情報 */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        {/* ステータスバッジ */}
        <TaskStatusBadge status={task.status} />

        {/* 締切日時 */}
        {task.deadline && (
          <span
            className={`flex items-center gap-1 text-[10px] font-medium ${
              urgent ? "text-rose-600" : "text-slate-400"
            }`}
          >
            <CalendarDays className="w-3 h-3" />
            {formatDeadline(task.deadline)}
          </span>
        )}

        {/* 予想所要時間 */}
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <Clock className="w-3 h-3" />
          {formatMinutes(task.estimatedMinutes)}
        </span>

        {/* ステータス変更セレクト（右端に配置） */}
        <div className="ml-auto">
          <select
            value={task.status}
            onChange={(e) =>
              onStatusChange(task.id, e.target.value as Task["status"])
            }
            onClick={(e) => e.stopPropagation()} // カードのクリックイベントを止める
            className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 cursor-pointer hover:border-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="PENDING">未着手</option>
            <option value="IN_PROGRESS">進行中</option>
            <option value="DONE">完了</option>
            <option value="CANCELLED">キャンセル</option>
          </select>
        </div>
      </div>
    </div>
  );
}
