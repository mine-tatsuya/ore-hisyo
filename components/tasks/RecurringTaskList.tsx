"use client";

// RecurringTaskList
// 定期タスクの一覧を表示するコンポーネント。
// 空状態のメッセージ表示も担当します。

import type { RecurringTask } from "@prisma/client";
import { RefreshCw } from "lucide-react";
import RecurringTaskCard from "./RecurringTaskCard";
import RecurringTaskDetailSheet from "./RecurringTaskDetailSheet";
import { useState } from "react";

interface RecurringTaskListProps {
  tasks: RecurringTask[];
  onUpdate: (updated: RecurringTask) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export default function RecurringTaskList({
  tasks,
  onUpdate,
  onDelete,
  onToggleActive,
}: RecurringTaskListProps) {
  // 詳細シートで開くタスク
  const [selectedTask, setSelectedTask] = useState<RecurringTask | null>(null);

  // 空状態
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
          <RefreshCw className="w-6 h-6 text-blue-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">定期タスクはまだありません</p>
        <p className="text-xs text-slate-400 mt-1">
          「+ 定期タスクを追加」から繰り返しタスクを登録しましょう
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((task) => (
          <RecurringTaskCard
            key={task.id}
            task={task}
            onToggleActive={onToggleActive}
            onClick={() => setSelectedTask(task)}
          />
        ))}
      </div>

      {/* 詳細・編集シート */}
      {selectedTask && (
        <RecurringTaskDetailSheet
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            onUpdate(updated);
            setSelectedTask(updated); // シートの中身も更新
          }}
          onDelete={(id) => {
            onDelete(id);
            setSelectedTask(null);
          }}
        />
      )}
    </>
  );
}
