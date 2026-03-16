"use client";

// TaskDetailSheet（全面改修版）
// Sheet から Dialog に変更し、全フィールド（タイトル・メモ・締切・所要時間・優先度・ステータス・進捗）を編集できるようにした。
// 「更新する」ボタンで全変更を一括 PATCH 送信する。

import { useState, useEffect } from "react";
import type { Task } from "@prisma/client";
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
import TaskProgressBar from "./TaskProgressBar";
import { Trash2 } from "lucide-react";

interface TaskDetailSheetProps {
  task: Task | null;       // null のとき Dialog は閉じる
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskDetailSheet({
  task,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailSheetProps) {
  // ── フォーム状態 ──
  const [editTitle,        setEditTitle]        = useState("");
  const [editDescription,  setEditDescription]  = useState("");
  const [editDeadlineDate, setEditDeadlineDate] = useState("");
  const [editDeadlineTime, setEditDeadlineTime] = useState("");
  const [editHours,        setEditHours]        = useState(1);
  const [editMins,         setEditMins]         = useState(0);
  const [editPriority,     setEditPriority]     = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [editStatus,       setEditStatus]       = useState<Task["status"]>("PENDING");
  const [editProgressPct,  setEditProgressPct]  = useState(0);

  // ── UI 状態 ──
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [apiError,          setApiError]          = useState<string | null>(null);

  // ── task が変わるたびに全フィールドを現在値で初期化する ──
  // これにより「別のタスクを開いたとき前の値が残る」問題を防ぐ。
  useEffect(() => {
    if (!task) return;

    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority as "HIGH" | "MEDIUM" | "LOW");
    setEditStatus(task.status);
    setEditProgressPct(task.progressPct);
    setEditHours(Math.floor(task.estimatedMinutes / 60));
    setEditMins(task.estimatedMinutes % 60);

    // 締切日時を date / time の2フィールドに分解する
    if (task.deadline) {
      const d = new Date(task.deadline);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day   = String(d.getDate()).padStart(2, "0");
      const hh    = String(d.getHours()).padStart(2, "0");
      const mm    = String(d.getMinutes()).padStart(2, "0");
      setEditDeadlineDate(`${year}-${month}-${day}`);
      setEditDeadlineTime(`${hh}:${mm}`);
    } else {
      setEditDeadlineDate("");
      setEditDeadlineTime("");
    }

    setShowDeleteConfirm(false);
    setApiError(null);
  }, [task]);

  // ── 更新 ──
  const handleUpdate = async () => {
    if (!task) return;
    if (!editTitle.trim()) {
      setApiError("タスク名を入力してください");
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
      // 日付 + 時刻を ISO 文字列に合成（日付が空なら null = 締切なし）
      const deadline = editDeadlineDate
        ? `${editDeadlineDate}T${editDeadlineTime || "00:00"}`
        : null;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:            editTitle.trim(),
          description:      editDescription || null,
          deadline,
          estimatedMinutes: totalMins,
          priority:         editPriority,
          status:           editStatus,
          progressPct:      editProgressPct,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "更新に失敗しました");
        return;
      }

      const json = await res.json();
      onUpdate(json.task);
      onClose();
    } catch {
      setApiError("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 削除 ──
  const handleDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        // 204 以外でエラー
        const text = await res.text();
        setApiError(text ? JSON.parse(text).error : "削除に失敗しました");
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
    // task が null のとき open=false でダイアログが閉じる
    <Dialog open={task !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            タスクを編集
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

          {/* メモ */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              メモ（任意）
            </Label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="bg-slate-50 border-slate-200 resize-none"
            />
          </div>

          {/* 締切 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              締切（任意）
            </Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={editDeadlineDate}
                onChange={(e) => {
                  setEditDeadlineDate(e.target.value);
                  // 日付をクリアしたら時刻もリセット
                  if (!e.target.value) setEditDeadlineTime("");
                }}
                className="bg-slate-50 border-slate-200 text-xs flex-1"
              />
              <Input
                type="time"
                value={editDeadlineTime}
                onChange={(e) => setEditDeadlineTime(e.target.value)}
                disabled={!editDeadlineDate}
                className="bg-slate-50 border-slate-200 text-xs w-28 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
            {editDeadlineDate && (
              <p className="text-[11px] text-slate-400">
                {new Date(`${editDeadlineDate}T${editDeadlineTime || "00:00"}`).toLocaleString("ja-JP", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>

          {/* 合計作業時間 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              合計作業時間 *
            </Label>
            <p className="text-[11px] text-slate-400">
              期限までに必要な総作業時間。AIが毎日適切な量に分割します。
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={editHours}
                  onChange={(e) => setEditHours(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
                  className="bg-slate-50 border-slate-200 w-20 text-center tabular-nums"
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

          {/* ステータス */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              ステータス
            </Label>
            {/*
              クリックで editStatus state を変更するだけ（即時 API は呼ばない）。
              「更新する」ボタンで他のフィールドと一緒に一括送信する。
            */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "PENDING",     label: "未着手" },
                  { value: "IN_PROGRESS", label: "進行中" },
                  { value: "DONE",        label: "完了" },
                  { value: "CANCELLED",   label: "キャンセル" },
                ] as const
              ).map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setEditStatus(s.value)}
                  className={`
                    py-2 rounded-xl text-xs font-medium border transition-all
                    ${editStatus === s.value
                      ? "bg-[#0052FF] text-white border-[#0052FF]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                    }
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 進捗スライダー（IN_PROGRESS のときのみ表示） */}
          {editStatus === "IN_PROGRESS" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                進捗
              </Label>
              <TaskProgressBar value={editProgressPct} />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={editProgressPct}
                onChange={(e) => setEditProgressPct(Number(e.target.value))}
                className="w-full mt-2 accent-[#0052FF]"
              />
              <p className="text-[11px] text-slate-400 text-right">{editProgressPct}%</p>
            </div>
          )}

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
                タスクを削除
              </button>
            ) : (
              <div className="bg-rose-50 rounded-xl p-3 space-y-2">
                <p className="text-xs text-rose-600 font-medium">
                  このタスクを削除しますか？この操作は取り消せません。
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
