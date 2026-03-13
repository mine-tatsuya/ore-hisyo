"use client";

// RecurringTaskDetailSheet（全面改修版）
// Sheet から Dialog に変更し、繰り返しパターン・希望時間帯を含む全フィールドを編集できるようにした。
// RecurringTaskCreateDialog と同じ構造で、現在値を初期値としてセットする。

import { useState, useEffect } from "react";
import type { RecurringTask } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

interface RecurringTaskDetailSheetProps {
  task: RecurringTask;    // 呼び出し側（RecurringTaskList）が条件レンダリングで null を排除する
  onClose: () => void;
  onUpdate: (task: RecurringTask) => void;
  onDelete: (id: string) => void;
}

// 曜日ラベル（1=月〜7=日）
const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 7, label: "日" },
];

type RecurrenceType    = "DAILY" | "WEEKLY" | "INTERVAL" | "MONTHLY";
type PreferredTimeType = "MORNING" | "NOON" | "EVENING" | "SPECIFIC";

export default function RecurringTaskDetailSheet({
  task,
  onClose,
  onUpdate,
  onDelete,
}: RecurringTaskDetailSheetProps) {
  // ── フォーム状態 ──
  const [editTitle,              setEditTitle]              = useState(task.title);
  const [editDescription,        setEditDescription]        = useState(task.description ?? "");
  const [editHours,              setEditHours]              = useState(Math.floor(task.estimatedMinutes / 60));
  const [editMins,               setEditMins]               = useState(task.estimatedMinutes % 60);
  const [editPriority,           setEditPriority]           = useState<"HIGH" | "MEDIUM" | "LOW">(task.priority as "HIGH" | "MEDIUM" | "LOW");
  const [editIsActive,           setEditIsActive]           = useState(task.isActive);
  const [editRecurrenceType,     setEditRecurrenceType]     = useState<RecurrenceType>(task.recurrenceType as RecurrenceType);
  const [editSelectedDays,       setEditSelectedDays]       = useState<number[]>(() => {
    if (task.recurrenceType !== "WEEKLY" || !task.daysOfWeek) return [];
    try { return JSON.parse(task.daysOfWeek); } catch { return []; }
  });
  const [editIntervalDays,       setEditIntervalDays]       = useState<number>(task.intervalDays ?? 3);
  const [editDayOfMonth,         setEditDayOfMonth]         = useState<number>(task.dayOfMonth ?? 1);
  const [editPreferredTimeType,  setEditPreferredTimeType]  = useState<PreferredTimeType | null>(
    (task.preferredTimeType as PreferredTimeType | null) ?? null
  );
  const [editPreferredStartTime, setEditPreferredStartTime] = useState(task.preferredStartTime ?? "");

  // ── UI 状態 ──
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [apiError,          setApiError]          = useState<string | null>(null);

  // ── task が変わるたびに全フィールドを再セット ──
  useEffect(() => {
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditHours(Math.floor(task.estimatedMinutes / 60));
    setEditMins(task.estimatedMinutes % 60);
    setEditPriority(task.priority as "HIGH" | "MEDIUM" | "LOW");
    setEditIsActive(task.isActive);
    setEditRecurrenceType(task.recurrenceType as RecurrenceType);
    if (task.recurrenceType === "WEEKLY" && task.daysOfWeek) {
      try { setEditSelectedDays(JSON.parse(task.daysOfWeek)); } catch { setEditSelectedDays([]); }
    } else {
      setEditSelectedDays([]);
    }
    setEditIntervalDays(task.intervalDays ?? 3);
    setEditDayOfMonth(task.dayOfMonth ?? 1);
    setEditPreferredTimeType((task.preferredTimeType as PreferredTimeType | null) ?? null);
    setEditPreferredStartTime(task.preferredStartTime ?? "");
    setShowDeleteConfirm(false);
    setApiError(null);
  }, [task]);

  // ── 曜日トグル ──
  const toggleDay = (day: number) => {
    setEditSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // ── 更新 ──
  const handleUpdate = async () => {
    if (!editTitle.trim()) {
      setApiError("タスク名を入力してください");
      return;
    }
    if (editRecurrenceType === "WEEKLY" && editSelectedDays.length === 0) {
      setApiError("曜日を1つ以上選択してください");
      return;
    }
    const totalMins = editHours * 60 + editMins;
    if (totalMins < 1) {
      setApiError("所要時間は1分以上で入力してください");
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const payload: Record<string, unknown> = {
        title:            editTitle.trim(),
        description:      editDescription || null,
        estimatedMinutes: totalMins,
        priority:         editPriority,
        isActive:         editIsActive,
        recurrenceType:   editRecurrenceType,
        // null を明示的に送ることで「指定なし」にリセットできる
        preferredTimeType: editPreferredTimeType || null,
      };

      // 繰り返しタイプ別の追加フィールド
      if (editRecurrenceType === "WEEKLY") {
        payload.daysOfWeek = JSON.stringify(editSelectedDays);
      } else if (editRecurrenceType === "INTERVAL") {
        payload.intervalDays = editIntervalDays;
      } else if (editRecurrenceType === "MONTHLY") {
        payload.dayOfMonth = editDayOfMonth;
      }

      // SPECIFIC のとき開始時刻を送る（それ以外は null でリセット）
      payload.preferredStartTime =
        editPreferredTimeType === "SPECIFIC" ? (editPreferredStartTime || null) : null;

      const res = await fetch(`/api/recurring-tasks/${task.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "更新に失敗しました");
        return;
      }

      const json = await res.json();
      onUpdate(json.recurringTask);
      onClose();
    } catch {
      setApiError("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 削除 ──
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recurring-tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "削除に失敗しました");
        setIsDeleting(false);
        return;
      }
      onDelete(task.id);
    } catch {
      setApiError("通信エラーが発生しました");
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            定期タスクを編集
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          {/* タスク名 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              タスク名 *
            </Label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-slate-50 border-slate-200"
            />
          </div>

          {/* 繰り返し */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              繰り返し *
            </Label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { value: "DAILY",    label: "毎日" },
                  { value: "WEEKLY",   label: "毎週" },
                  { value: "INTERVAL", label: "N日ごと" },
                  { value: "MONTHLY",  label: "毎月" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditRecurrenceType(opt.value)}
                  className={`
                    flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium
                    transition-all duration-150
                    ${editRecurrenceType === opt.value
                      ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* WEEKLY: 曜日チェックボックス */}
          {editRecurrenceType === "WEEKLY" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                実施する曜日 *
              </Label>
              <div className="flex gap-2">
                {DAY_LABELS.map(({ value, label }) => {
                  const isSelected = editSelectedDays.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleDay(value)}
                      className={`
                        w-9 h-9 rounded-full text-xs font-bold transition-all duration-150
                        ${isSelected
                          ? "bg-[#0052FF] text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* INTERVAL: 何日ごとか */}
          {editRecurrenceType === "INTERVAL" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                間隔（日数） *
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={editIntervalDays}
                  onChange={(e) =>
                    setEditIntervalDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))
                  }
                  className="bg-slate-50 border-slate-200 w-20 text-center"
                />
                <span className="text-sm text-slate-600">日ごと</span>
              </div>
            </div>
          )}

          {/* MONTHLY: 何日か */}
          {editRecurrenceType === "MONTHLY" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                実施日（日付） *
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">毎月</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={editDayOfMonth}
                  onChange={(e) =>
                    setEditDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value) || 1)))
                  }
                  className="bg-slate-50 border-slate-200 w-20 text-center"
                />
                <span className="text-sm text-slate-600">日</span>
              </div>
            </div>
          )}

          {/* 希望時間帯 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              希望時間帯（任意）
            </Label>
            <div className="flex gap-2 flex-wrap">
              {/* 指定なし */}
              <button
                type="button"
                onClick={() => setEditPreferredTimeType(null)}
                className={`
                  flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium
                  transition-all duration-150
                  ${!editPreferredTimeType
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }
                `}
              >
                指定なし
              </button>
              {(
                [
                  { value: "MORNING",  label: "朝" },
                  { value: "NOON",     label: "昼" },
                  { value: "EVENING",  label: "夜" },
                  { value: "SPECIFIC", label: "時刻指定" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditPreferredTimeType(opt.value)}
                  className={`
                    flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium
                    transition-all duration-150
                    ${editPreferredTimeType === opt.value
                      ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* SPECIFIC 選択時: 時刻入力 */}
            {editPreferredTimeType === "SPECIFIC" && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="time"
                  value={editPreferredStartTime}
                  onChange={(e) => setEditPreferredStartTime(e.target.value)}
                  className="bg-slate-50 border-slate-200 w-32"
                />
                <span className="text-xs text-slate-500">から開始を希望</span>
              </div>
            )}
          </div>

          {/* 所要時間 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              所要時間 *
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={editHours}
                  onChange={(e) => setEditHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
                  className="bg-slate-50 border-slate-200 w-16 text-center tabular-nums"
                />
                <span className="text-sm text-slate-600 whitespace-nowrap">時間</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={editMins}
                  onChange={(e) => setEditMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                  className="bg-slate-50 border-slate-200 w-16 text-center tabular-nums"
                />
                <span className="text-sm text-slate-600 whitespace-nowrap">分</span>
              </div>
              <span className="text-[11px] text-slate-400 ml-auto">
                合計 {editHours * 60 + editMins} 分
              </span>
            </div>
          </div>

          {/* 優先度 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              優先度
            </Label>
            <div className="flex gap-2">
              {(
                [
                  {
                    value: "HIGH"   as const,
                    label: "高",
                    selected:   "bg-rose-500   text-white border-rose-500   shadow-sm",
                    unselected: "bg-white text-rose-500   border-rose-200   hover:bg-rose-50",
                  },
                  {
                    value: "MEDIUM" as const,
                    label: "中",
                    selected:   "bg-yellow-400 text-white border-yellow-400 shadow-sm",
                    unselected: "bg-white text-yellow-600 border-yellow-200 hover:bg-yellow-50",
                  },
                  {
                    value: "LOW"    as const,
                    label: "低",
                    selected:   "bg-slate-400  text-white border-slate-400  shadow-sm",
                    unselected: "bg-white text-slate-500  border-slate-200  hover:bg-slate-100",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditPriority(opt.value)}
                  className={`
                    flex-1 py-2 rounded-xl border text-xs font-bold transition-all duration-150
                    ${editPriority === opt.value ? opt.selected : opt.unselected}
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 有効 / 停止 トグル */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              状態
            </Label>
            <button
              type="button"
              onClick={() => setEditIsActive((v) => !v)}
              className={`
                px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-150
                ${editIsActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                }
              `}
            >
              {editIsActive ? "✓ 有効中（ON）" : "停止中（OFF）"}
            </button>
          </div>

          {/* メモ */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              メモ（任意・Gemini への補足情報）
            </Label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="bg-slate-50 border-slate-200 resize-none"
            />
          </div>

          {/* API エラー表示 */}
          {apiError && (
            <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{apiError}</p>
          )}

          {/* キャンセル / 更新するボタン */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="flex-1 bg-[#0052FF] hover:bg-blue-700 text-white"
            >
              {isSubmitting ? "更新中..." : "更新する"}
            </Button>
          </div>

          {/* 削除リンク（確認 UI 内蔵） */}
          <div className="pt-2 border-t border-slate-100">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                削除する
              </button>
            ) : (
              <div className="bg-rose-50 rounded-xl p-3 space-y-2">
                <p className="text-xs text-rose-600 font-medium">
                  この定期タスクを削除しますか？この操作は取り消せません。
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white border-0"
                  >
                    {isDeleting ? "削除中..." : "削除する"}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
