"use client";

// タスク一覧ページ
// 「タスク」タブ（期日ありの一度完了型）と
// 「定期タスク」タブ（繰り返し型）の2種類をタブで切り替えて表示します。

import { useState, useEffect } from "react";
import type { Task, RecurringTask } from "@prisma/client";
import { Plus, Loader2 } from "lucide-react";
import TaskList from "@/components/tasks/TaskList";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";
import RecurringTaskList from "@/components/tasks/RecurringTaskList";
import RecurringTaskCreateDialog from "@/components/tasks/RecurringTaskCreateDialog";

// 表示するタブの種類
type TabType = "tasks" | "recurring";

export default function TasksPage() {
  // ---- 通常タスクの状態 ----
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // ---- 定期タスクの状態 ----
  const [recurringTasks, setRecurringTasks]       = useState<RecurringTask[]>([]);
  const [recurringLoading, setRecurringLoading]   = useState(true);
  const [createRecurringOpen, setCreateRecurringOpen] = useState(false);

  // ---- 現在のタブ ----
  const [activeTab, setActiveTab] = useState<TabType>("tasks");

  // ---- 通常タスクの取得 ----
  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((json) => setTasks(json.tasks ?? []))
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, []);

  // ---- 定期タスクの取得（?active=false で全件取得） ----
  useEffect(() => {
    fetch("/api/recurring-tasks?active=false")
      .then((res) => res.json())
      .then((json) => setRecurringTasks(json.recurringTasks ?? []))
      .catch(console.error)
      .finally(() => setRecurringLoading(false));
  }, []);

  // ---- コールバック：通常タスク ----
  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
  };
  const handleTaskUpdate = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };
  const handleTaskDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };
  const handleStatusChange = async (id: string, status: Task["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (res.ok) {
        const json = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? json.task : t)));
      } else {
        fetch("/api/tasks").then((r) => r.json()).then((j) => setTasks(j.tasks ?? []));
      }
    } catch {
      fetch("/api/tasks").then((r) => r.json()).then((j) => setTasks(j.tasks ?? []));
    }
  };

  // ---- コールバック：定期タスク ----
  const handleRecurringCreated = (task: RecurringTask) => {
    setRecurringTasks((prev) => [task, ...prev]);
  };
  const handleRecurringUpdate = (updated: RecurringTask) => {
    setRecurringTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };
  const handleRecurringDelete = (id: string) => {
    setRecurringTasks((prev) => prev.filter((t) => t.id !== id));
  };
  const handleToggleActive = async (id: string, isActive: boolean) => {
    // 楽観的更新
    setRecurringTasks((prev) => prev.map((t) => (t.id === id ? { ...t, isActive } : t)));
    try {
      const res = await fetch(`/api/recurring-tasks/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isActive }),
      });
      if (res.ok) {
        const json = await res.json();
        setRecurringTasks((prev) => prev.map((t) => (t.id === id ? json.recurringTask : t)));
      }
    } catch {
      // 失敗時はリロード
      fetch("/api/recurring-tasks?active=false")
        .then((r) => r.json())
        .then((j) => setRecurringTasks(j.recurringTasks ?? []));
    }
  };

  // タブのカウント表示
  const activeTaskCount     = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length;
  const activeRecurringCount = recurringTasks.filter((t) => t.isActive).length;

  return (
    <div className="pt-2">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60 overflow-hidden">

        {/* ── タブヘッダー ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          {/* タブボタン */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`
                relative px-4 py-2 text-xs font-semibold rounded-t-lg transition-all duration-150
                ${activeTab === "tasks"
                  ? "text-[#0052FF] bg-blue-50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              タスク
              {!tasksLoading && activeTaskCount > 0 && (
                <span className={`
                  ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  ${activeTab === "tasks" ? "bg-[#0052FF] text-white" : "bg-slate-100 text-slate-500"}
                `}>
                  {activeTaskCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("recurring")}
              className={`
                relative px-4 py-2 text-xs font-semibold rounded-t-lg transition-all duration-150
                ${activeTab === "recurring"
                  ? "text-[#0052FF] bg-blue-50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              定期タスク
              {!recurringLoading && activeRecurringCount > 0 && (
                <span className={`
                  ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  ${activeTab === "recurring" ? "bg-[#0052FF] text-white" : "bg-slate-100 text-slate-500"}
                `}>
                  {activeRecurringCount}
                </span>
              )}
            </button>
          </div>

          {/* 追加ボタン（タブに応じて変わる） */}
          <button
            onClick={() => {
              if (activeTab === "tasks") setCreateTaskOpen(true);
              else setCreateRecurringOpen(true);
            }}
            className="flex items-center gap-1.5 bg-[#0052FF] text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {activeTab === "tasks" ? "タスクを追加" : "定期タスクを追加"}
          </button>
        </div>

        {/* タブの下線 */}
        <div className="h-px bg-slate-100 mx-6" />

        {/* ── タブコンテンツ ── */}
        <div className="p-6">

          {/* タスクタブ */}
          {activeTab === "tasks" && (
            <>
              {tasksLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                </div>
              ) : (
                <TaskList
                  tasks={tasks}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                  onStatusChange={handleStatusChange}
                />
              )}
            </>
          )}

          {/* 定期タスクタブ */}
          {activeTab === "recurring" && (
            <>
              {recurringLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                </div>
              ) : (
                <RecurringTaskList
                  tasks={recurringTasks}
                  onUpdate={handleRecurringUpdate}
                  onDelete={handleRecurringDelete}
                  onToggleActive={handleToggleActive}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* 通常タスク作成ダイアログ */}
      <TaskCreateDialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onCreated={handleTaskCreated}
      />

      {/* 定期タスク作成ダイアログ */}
      <RecurringTaskCreateDialog
        open={createRecurringOpen}
        onClose={() => setCreateRecurringOpen(false)}
        onCreated={handleRecurringCreated}
      />
    </div>
  );
}
