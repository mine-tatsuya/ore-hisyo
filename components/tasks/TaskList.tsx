"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, ListTodo } from "lucide-react";
import type { Task } from "@prisma/client";
import { TaskCard } from "./TaskCard";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskDetailSheet } from "./TaskDetailSheet";

type FilterStatus = "ALL" | "PENDING" | "IN_PROGRESS" | "DONE";

const filterTabs: { label: string; value: FilterStatus }[] = [
  { label: "全て", value: "ALL" },
  { label: "未着手", value: "PENDING" },
  { label: "進行中", value: "IN_PROGRESS" },
  { label: "完了", value: "DONE" },
];

interface TaskListProps {
  onReschedule?: () => void;
}

export function TaskList({ onReschedule }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = filter !== "ALL" ? `?status=${filter}` : "";
    const res = await fetch(`/api/tasks${params}`);
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (id: string, status: Task["status"]) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchTasks();
  };

  const handleProgressChange = async (id: string, pct: number) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressPct: pct }),
    });
    await fetchTasks();
  };

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">タスク一覧</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-[#0052FF] text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          タスクを追加
        </button>
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
              filter === tab.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タスク一覧 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ListTodo className="w-10 h-10 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium">タスクがありません</p>
          <p className="text-xs mt-1">「+ タスクを追加」からタスクを登録してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onProgressChange={handleProgressChange}
              onDetailClick={setDetailTask}
            />
          ))}
        </div>
      )}

      {/* ダイアログ・シート */}
      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchTasks}
      />
      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onUpdated={fetchTasks}
        onDeleted={fetchTasks}
        onReschedule={() => {
          setDetailTask(null);
          onReschedule?.();
        }}
      />
    </div>
  );
}
