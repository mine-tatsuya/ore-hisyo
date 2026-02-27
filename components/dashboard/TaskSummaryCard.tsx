"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, AlertCircle } from "lucide-react";
import type { Task } from "@prisma/client";

export function TaskSummaryCard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks ?? []);
        setLoading(false);
      });
  }, []);

  const high = tasks.filter((t) => t.priority === "HIGH" && t.status !== "DONE" && t.status !== "CANCELLED").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const done = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
      <h2 className="text-sm font-bold text-slate-900 mb-3">今日のタスク</h2>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-5 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" strokeWidth={1.5} />
            <span className="text-xs text-slate-600">高優先度:</span>
            <span className="text-xs font-bold text-slate-900">{high}件</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <span className="text-xs text-slate-600">進行中:</span>
            <span className="text-xs font-bold text-slate-900">{inProgress}件</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-xs text-slate-600">完了:</span>
            <span className="text-xs font-bold text-slate-900">{done}件</span>
          </div>
        </div>
      )}

      <Link
        href="/tasks"
        className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-[#0052FF] border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        タスクを管理
      </Link>
    </div>
  );
}
