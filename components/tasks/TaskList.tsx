"use client";

import { useState } from "react";
import type { Task } from "@prisma/client";
import { ListTodo } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskDetailSheet from "./TaskDetailSheet";

// フィルタータブの定義
// "ALL" は全件表示、それ以外は Task["status"] と一致させる
type FilterTab = "ALL" | Task["status"];

const TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL",         label: "すべて"   },
  { value: "PENDING",     label: "未着手"   },
  { value: "IN_PROGRESS", label: "進行中"   },
  { value: "DONE",        label: "完了"     },
  { value: "CANCELLED",   label: "キャンセル" },
];

interface TaskListProps {
  tasks: Task[];                          // 親から渡されるタスク配列
  onUpdate: (updated: Task) => void;      // 更新後に親の state を書き換える
  onDelete: (id: string) => void;         // 削除後に親の state から除去する
  onStatusChange: (id: string, status: Task["status"]) => void; // カード上のセレクトから変更
}

export default function TaskList({
  tasks,
  onUpdate,
  onDelete,
  onStatusChange,
}: TaskListProps) {
  // どのタブを選択中か
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  // 詳細シートに表示するタスク（null = 閉じている）
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // フィルタリング：選択中のタブに合わせてタスクを絞り込む
  const filtered =
    activeTab === "ALL"
      ? tasks
      : tasks.filter((t) => t.status === activeTab);

  return (
    <>
      {/* フィルタータブ */}
      <div className="flex gap-1 mb-4 border-b border-slate-100 pb-1 overflow-x-auto">
        {TABS.map((tab) => {
          // タブごとの件数をバッジ表示
          const count =
            tab.value === "ALL"
              ? tasks.length
              : tasks.filter((t) => t.status === tab.value).length;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                whitespace-nowrap transition-all duration-150
                ${
                  activeTab === tab.value
                    ? "bg-[#0052FF] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100"
                }
              `}
            >
              {tab.label}
              {/* 件数バッジ（0件のタブは薄く表示） */}
              <span
                className={`
                  text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${
                    activeTab === tab.value
                      ? "bg-white/20 text-white"
                      : count > 0
                      ? "bg-slate-200 text-slate-600"
                      : "bg-slate-100 text-slate-300"
                  }
                `}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* タスクカード一覧 */}
      {filtered.length === 0 ? (
        // 空状態
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <ListTodo className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">
            {activeTab === "ALL" ? "タスクがありません" : `${TABS.find(t => t.value === activeTab)?.label}のタスクがありません`}
          </p>
          {activeTab === "ALL" && (
            <p className="text-xs text-slate-300 mt-1">
              「+ タスクを追加」からタスクを登録してください
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onClick={() => setSelectedTask(task)} // タイトルクリックで詳細を開く
            />
          ))}
        </div>
      )}

      {/* 編集ダイアログ（task が null のとき閉じる、null でないとき開く） */}
      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={(updated) => {
          onUpdate(updated);
          // 更新後はダイアログが閉じるので setSelectedTask は呼ばない
        }}
        onDelete={(id) => {
          onDelete(id);
          setSelectedTask(null);
        }}
      />
    </>
  );
}
