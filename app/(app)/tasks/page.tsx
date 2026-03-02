"use client";

// タスク一覧ページ
// "use client" にしている理由:
//   - タスクの追加・更新・削除をリアルタイムに反映するため useState/useEffect が必要
//   - サーバーコンポーネントは基本的に「静的な HTML をサーバーで生成する」もので、
//     クリックやフォーム送信など動的な操作は扱えない

import { useState, useEffect } from "react";
import type { Task } from "@prisma/client";
import { Plus, Loader2 } from "lucide-react";
import TaskList from "@/components/tasks/TaskList";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";

export default function TasksPage() {
  // ---- State（状態）の定義 ----
  // tasks: 取得したタスクの配列。最初は空配列。
  const [tasks, setTasks] = useState<Task[]>([]);
  // isLoading: API 呼び出し中かどうか（ローディングスピナー表示用）
  const [isLoading, setIsLoading] = useState(true);
  // createOpen: 「タスクを追加」ダイアログが開いているか
  const [createOpen, setCreateOpen] = useState(false);

  // ---- API からタスクを取得 ----
  // useEffect: コンポーネントが「マウント（画面に表示）」された後に実行される
  // [] を依存配列に渡すと「最初の一回だけ実行」という意味になる
  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((json) => {
        setTasks(json.tasks ?? []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // ---- タスク追加後のコールバック ----
  // TaskCreateDialog から「作成成功したタスク」が返ってくる
  // setTasks で配列の先頭に追加することで、画面を再取得せずに即反映できる
  const handleCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
  };

  // ---- タスク更新後のコールバック ----
  // map で ID が一致するタスクだけ新しいデータに差し替える
  const handleUpdate = (updated: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  };

  // ---- タスク削除後のコールバック ----
  // filter で削除対象の ID を除外するだけ
  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // ---- カード上のステータス変更（クイックチェンジ）----
  const handleStatusChange = async (id: string, status: Task["status"]) => {
    // 楽観的更新: API レスポンスを待たず先に UI を更新する
    // → ユーザーには即座に変わったように見える（体感速度が上がる）
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const json = await res.json();
        // API のレスポンスで正確なデータに上書き（例: progressPct が自動変更された場合に備え）
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? json.task : t))
        );
      } else {
        // 失敗したら再取得して元に戻す
        fetch("/api/tasks")
          .then((r) => r.json())
          .then((json) => setTasks(json.tasks ?? []));
      }
    } catch {
      // 通信エラーの場合も再取得
      fetch("/api/tasks")
        .then((r) => r.json())
        .then((json) => setTasks(json.tasks ?? []));
    }
  };

  return (
    <div className="pt-2">
      {/* メインカード */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">

        {/* ヘッダー行 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">タスク一覧</h2>
            {!isLoading && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {tasks.length} 件のタスク
              </p>
            )}
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 bg-[#0052FF] text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            タスクを追加
          </button>
        </div>

        {/* ローディング中 */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : (
          // タスク一覧（フィルタータブ + カード）
          <TaskList
            tasks={tasks}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* タスク作成ダイアログ */}
      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
