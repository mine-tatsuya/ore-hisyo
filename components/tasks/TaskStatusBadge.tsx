// タスクのステータスをバッジ（小さなラベル）で表示するコンポーネント
// 「単純な表示だけ」なのでサーバーコンポーネントでOK（"use client" なし）

type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

// ステータスごとのスタイルと表示テキストを定義
const statusConfig: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "未着手",
    className: "bg-slate-50 text-slate-600 border-slate-200",
  },
  IN_PROGRESS: {
    label: "進行中",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  DONE: {
    label: "完了 ✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  CANCELLED: {
    label: "キャンセル",
    className: "bg-slate-50 text-slate-400 border-slate-100",
  },
};

export default function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const { label, className } = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-[9px] font-bold tracking-wider rounded
        border ${className}
      `}
    >
      {label}
    </span>
  );
}
