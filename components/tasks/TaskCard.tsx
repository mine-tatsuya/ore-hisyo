"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar, ChevronRight } from "lucide-react";
import type { Task } from "@prisma/client";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { PriorityDot, PriorityBadge } from "./PriorityDot";
import { TaskProgressBar } from "./TaskProgressBar";

const borderColors = {
  HIGH: "border-rose-500",
  MEDIUM: "border-yellow-400",
  LOW: "border-slate-300",
};

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: Task["status"]) => Promise<void>;
  onProgressChange: (id: string, pct: number) => Promise<void>;
  onDetailClick: (task: Task) => void;
}

export function TaskCard({
  task,
  onStatusChange,
  onProgressChange,
  onDetailClick,
}: TaskCardProps) {
  const [changing, setChanging] = useState(false);

  const isDeadlineToday =
    task.deadline &&
    new Date(task.deadline).toDateString() === new Date().toDateString();
  const isOverdue =
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== "DONE";

  const handleStatusChange = async (status: Task["status"]) => {
    setChanging(true);
    await onStatusChange(task.id, status);
    setChanging(false);
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 border-l-4 ${borderColors[task.priority]} shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-md transition-shadow duration-200 p-4 ${
        isDeadlineToday ? "bg-rose-50" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <PriorityDot priority={task.priority} />

        <div className="flex-1 min-w-0">
          {/* タイトル行 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[13px] font-semibold ${
                isDeadlineToday || isOverdue ? "text-rose-600" : "text-slate-800"
              }`}
            >
              {task.title}
            </span>
            <PriorityBadge priority={task.priority} />
            {task.calendarEventId && (
              <span className="text-slate-400">
                <Calendar className="w-3 h-3 inline" strokeWidth={1.5} />
              </span>
            )}
          </div>

          {/* 締切・所要時間 */}
          <div className="flex items-center gap-3 mt-1">
            {task.deadline && (
              <span
                className={`text-[10px] font-bold ${
                  isOverdue ? "text-rose-600" : "text-slate-500"
                }`}
              >
                締切: {format(new Date(task.deadline), "M/d HH:mm", { locale: ja })}
                {isOverdue && " ⚠"}
              </span>
            )}
            <span className="text-[10px] text-slate-400">
              所要: {task.estimatedMinutes}分
            </span>
          </div>

          {/* 進捗バー（IN_PROGRESS のみ） */}
          {task.status === "IN_PROGRESS" && (
            <div className="mt-2">
              <TaskProgressBar pct={task.progressPct} />
            </div>
          )}

          {/* ステータス変更 + 詳細ボタン */}
          <div className="flex items-center gap-2 mt-2.5">
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as Task["status"])}
              disabled={changing}
              className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-50"
            >
              <option value="PENDING">未着手</option>
              <option value="IN_PROGRESS">進行中</option>
              <option value="DONE">完了</option>
              <option value="CANCELLED">キャンセル</option>
            </select>

            <TaskStatusBadge status={task.status} />

            <button
              onClick={() => onDetailClick(task)}
              className="ml-auto flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              詳細
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
