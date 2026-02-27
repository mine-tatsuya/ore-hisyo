"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { X, Trash2, RefreshCw } from "lucide-react";
import type { Task } from "@prisma/client";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { PriorityBadge } from "./PriorityDot";
import { TaskProgressBar } from "./TaskProgressBar";

interface TaskDetailSheetProps {
  task: Task | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onReschedule: () => void;
}

export function TaskDetailSheet({
  task,
  onClose,
  onUpdated,
  onDeleted,
  onReschedule,
}: TaskDetailSheetProps) {
  const [progress, setProgress] = useState(task?.progressPct ?? 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!task) return null;

  const handleProgressSave = async () => {
    setSaving(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressPct: progress }),
    });
    setSaving(false);
    onUpdated();
  };

  const handleDelete = async () => {
    if (!confirm("このタスクを削除しますか？")) return;
    setDeleting(true);
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setDeleting(false);
    onDeleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-900 truncate pr-2">{task.title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 shrink-0">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* バッジ群 */}
          <div className="flex items-center gap-2 flex-wrap">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>

          {/* 基本情報 */}
          <dl className="space-y-2.5">
            {task.description && (
              <div>
                <dt className="text-[10px] font-bold text-slate-400 tracking-widest mb-0.5">説明</dt>
                <dd className="text-xs text-slate-600 whitespace-pre-wrap">{task.description}</dd>
              </div>
            )}
            {task.deadline && (
              <div>
                <dt className="text-[10px] font-bold text-slate-400 tracking-widest mb-0.5">締切</dt>
                <dd className="text-xs text-slate-700 font-medium">
                  {format(new Date(task.deadline), "yyyy/M/d HH:mm (E)", { locale: ja })}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-[10px] font-bold text-slate-400 tracking-widest mb-0.5">所要時間</dt>
                <dd className="text-xs text-slate-700">{task.estimatedMinutes}分</dd>
              </div>
              {task.scheduledStart && task.scheduledEnd && (
                <div>
                  <dt className="text-[10px] font-bold text-slate-400 tracking-widest mb-0.5">予定時間</dt>
                  <dd className="text-xs text-slate-700">
                    {format(new Date(task.scheduledStart), "HH:mm")} –{" "}
                    {format(new Date(task.scheduledEnd), "HH:mm")}
                  </dd>
                </div>
              )}
            </div>
          </dl>

          {/* 進捗編集 */}
          {(task.status === "IN_PROGRESS" || task.status === "PENDING") && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-2">
                進捗を更新
              </label>
              <TaskProgressBar pct={progress} />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full mt-2 accent-[#0052FF]"
              />
              <button
                onClick={handleProgressSave}
                disabled={saving}
                className="mt-2 w-full py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {saving ? "保存中..." : "進捗を保存"}
              </button>
            </div>
          )}

          {/* リスケジュール */}
          {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
            <button
              onClick={onReschedule}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[#0052FF] border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
              リスケジュール
            </button>
          )}

          {/* 作成日時 */}
          <p className="text-[10px] text-slate-400">
            作成: {format(new Date(task.createdAt), "yyyy/M/d HH:mm", { locale: ja })}
          </p>

          {/* 削除ボタン */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-rose-600 border border-rose-100 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            {deleting ? "削除中..." : "タスクを削除"}
          </button>
        </div>
      </aside>
    </div>
  );
}
