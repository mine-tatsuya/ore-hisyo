import type { TaskStatus } from "@prisma/client";

const statusConfig: Record<
  TaskStatus,
  { label: string; textColor: string; bgColor: string; borderColor: string }
> = {
  PENDING: {
    label: "未着手",
    textColor: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  IN_PROGRESS: {
    label: "進行中",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  DONE: {
    label: "完了 ✓",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-100",
  },
  CANCELLED: {
    label: "キャンセル",
    textColor: "text-slate-400",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-100",
  },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold tracking-wider ${cfg.textColor} ${cfg.bgColor} ${cfg.borderColor}`}
    >
      {cfg.label}
    </span>
  );
}
