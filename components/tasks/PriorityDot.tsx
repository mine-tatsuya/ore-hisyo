import type { Priority } from "@prisma/client";

const colors: Record<Priority, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-slate-300",
};

const labels: Record<Priority, string> = {
  HIGH: "HIGH",
  MEDIUM: "MED",
  LOW: "LOW",
};

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${colors[priority]}`} title={labels[priority]} />
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const colorClass: Record<Priority, string> = {
    HIGH: "text-rose-600 bg-rose-50 border-rose-100",
    MEDIUM: "text-yellow-700 bg-yellow-50 border-yellow-100",
    LOW: "text-slate-500 bg-slate-50 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wider ${colorClass[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}
