"use client";

import { useState } from "react";
import type { Task } from "@prisma/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskProgressBar from "./TaskProgressBar";
import { CalendarDays, Clock, Trash2, RefreshCw } from "lucide-react";

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}

function formatDatetime(date: Date | null) {
  if (!date) return "なし";
  return new Date(date).toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export default function TaskDetailSheet({
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailSheetProps) {
  const [progressInput, setProgressInput] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sheet が開くたびに進捗値をタスクの値で初期化
  if (task && progressInput !== task.progressPct && !isUpdating) {
    setProgressInput(task.progressPct);
  }

  if (!task) return null;

  // 進捗を更新する
  const handleProgressUpdate = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPct: progressInput }),
      });
      if (res.ok) {
        const json = await res.json();
        onUpdate(json.task);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // ステータスを更新する
  const handleStatusChange = async (status: Task["status"]) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const json = await res.json();
        onUpdate(json.task);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // タスクを削除する
  const handleDelete = async () => {
    if (!confirm(`「${task.title}」を削除しますか？`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(task.id);
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    // shadcn Sheet: 画面右からスライドして出るパネル
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-base font-bold text-slate-900 text-left leading-snug">
            {task.title}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <TaskStatusBadge status={task.status} />
            <span className="text-[10px] text-slate-400">
              作成: {new Date(task.createdAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          {/* メタ情報 */}
          <div className="grid grid-cols-2 gap-3">
            <InfoItem
              icon={<CalendarDays className="w-3.5 h-3.5" />}
              label="締切"
              value={formatDatetime(task.deadline)}
            />
            <InfoItem
              icon={<Clock className="w-3.5 h-3.5" />}
              label="所要時間"
              value={formatMinutes(task.estimatedMinutes)}
            />
          </div>

          {/* 説明 */}
          {task.description && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                メモ
              </p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* ステータス変更 */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              ステータス
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "PENDING",     label: "未着手" },
                  { value: "IN_PROGRESS", label: "進行中" },
                  { value: "DONE",        label: "完了"   },
                  { value: "CANCELLED",   label: "キャンセル" },
                ] as const
              ).map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={task.status === s.value || isUpdating}
                  className={`
                    py-2 rounded-xl text-xs font-medium border transition-all
                    ${task.status === s.value
                      ? "bg-[#0052FF] text-white border-[#0052FF]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                    }
                    disabled:opacity-50
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 進捗更新（IN_PROGRESS のときのみ） */}
          {task.status === "IN_PROGRESS" && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                進捗を更新
              </p>
              <TaskProgressBar value={progressInput} />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progressInput}
                onChange={(e) => setProgressInput(Number(e.target.value))}
                className="w-full mt-3 accent-[#0052FF]"
              />
              <Button
                size="sm"
                onClick={handleProgressUpdate}
                disabled={isUpdating}
                className="w-full mt-2 bg-[#0052FF] hover:bg-blue-700 text-white"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {progressInput}% で更新
              </Button>
            </div>
          )}

          {/* 削除ボタン */}
          <div className="pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {isDeleting ? "削除中..." : "タスクを削除"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// 小さな情報表示コンポーネント（Sheet内でのみ使う）
function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}
