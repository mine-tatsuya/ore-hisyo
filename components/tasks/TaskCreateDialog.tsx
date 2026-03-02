"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Task } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// フォームのバリデーションスキーマ（APIのスキーマと対応）
const formSchema = z.object({
  title: z
    .string()
    .min(1, "タスク名を入力してください")
    .max(100, "100文字以内で入力してください"),
  description: z.string().max(1000).optional(),
  deadline: z.string().optional(),
  estimatedMinutes: z
    .number({ invalid_type_error: "数値で入力してください" })
    .int()
    .min(1, "合計1分以上で入力してください")
    .max(1440, "最大24時間（1440分）まで設定できます"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

// フォームの型（スキーマから自動生成）
type FormData = z.infer<typeof formSchema>;

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export default function TaskCreateDialog({
  open,
  onClose,
  onCreated,
}: TaskCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- 締切：日付と時刻を別々に管理 ----
  // datetime-local は入力しにくいため、date + time の2フィールドに分割する。
  // 最終的には "2024-03-15T14:30" の形式に合成して form に渡す。
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");

  // ---- 所要時間：時間と分を別々に管理 ----
  // estimatedMinutes（総分数）= hoursInput × 60 + minsInput で計算する。
  // デフォルト 60分 → 1時間 0分
  const [hoursInput, setHoursInput] = useState(1);
  const [minsInput, setMinsInput] = useState(0);

  // react-hook-form の初期化
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue, // フォームの値をプログラムから書き換える関数
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priority: "MEDIUM",
      estimatedMinutes: 60,
    },
  });

  // ---- ダイアログを閉じるときにすべての状態をリセット ----
  // キャンセルでも送信後でも、次に開いたときにクリーンな状態にする
  const handleClose = () => {
    reset();
    setDeadlineDate("");
    setDeadlineTime("");
    setHoursInput(1);
    setMinsInput(0);
    setApiError(null);
    onClose();
  };

  // ---- 締切：日付が変わったとき ----
  const handleDeadlineDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setDeadlineDate(date);
    if (date) {
      // 日付が入力されたら "日付T時刻" の形式で deadline に設定
      // 時刻が未入力の場合は 00:00（その日の午前0時）を使う
      setValue("deadline", `${date}T${deadlineTime || "00:00"}`);
    } else {
      // 日付をクリアしたら締切なし（undefined）にする
      setValue("deadline", undefined);
      setDeadlineTime("");
    }
  };

  // ---- 締切：時刻が変わったとき ----
  const handleDeadlineTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    setDeadlineTime(time);
    if (deadlineDate) {
      setValue("deadline", `${deadlineDate}T${time || "00:00"}`);
    }
  };

  // ---- 所要時間：時間が変わったとき ----
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 0〜24 の範囲に収める（24時間が上限）
    const h = Math.max(0, Math.min(24, Math.floor(Number(e.target.value)) || 0));
    setHoursInput(h);
    // 合算して form に反映。shouldValidate: true でバリデーションも即時実行
    setValue("estimatedMinutes", h * 60 + minsInput, { shouldValidate: true });
  };

  // ---- 所要時間：分が変わったとき ----
  const handleMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 0〜59 の範囲に収める
    const m = Math.max(0, Math.min(59, Math.floor(Number(e.target.value)) || 0));
    setMinsInput(m);
    setValue("estimatedMinutes", hoursInput * 60 + m, { shouldValidate: true });
  };

  // ---- フォーム送信処理 ----
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.errors?.title?.[0] ?? "エラーが発生しました");
        return;
      }

      const json = await res.json();
      onCreated(json.task);
      handleClose(); // 送信成功後にすべてリセットして閉じる
    } catch {
      setApiError("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            タスクを追加
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* タスク名 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              タスク名 *
            </Label>
            <Input
              {...register("title")}
              placeholder="例: レポートを書く"
              className="bg-slate-50 border-slate-200"
            />
            {errors.title && (
              <p className="text-xs text-rose-600">{errors.title.message}</p>
            )}
          </div>

          {/* メモ・説明 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              メモ（任意）
            </Label>
            <Textarea
              {...register("description")}
              placeholder="詳細・メモを入力"
              rows={2}
              className="bg-slate-50 border-slate-200 resize-none"
            />
          </div>

          {/* 締切日時 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              締切（任意）
            </Label>
            {/*
              datetime-local の代わりに date + time の2つに分割。
              - type="date" : 日付を YYYY-MM-DD 形式でキーボード入力できる
              - type="time" : 時刻を HH:MM 形式でキーボード入力できる
              どちらもキーボードで数字を打つだけで入力できる。
            */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={deadlineDate}
                onChange={handleDeadlineDateChange}
                className="bg-slate-50 border-slate-200 text-xs flex-1"
              />
              <Input
                type="time"
                value={deadlineTime}
                onChange={handleDeadlineTimeChange}
                disabled={!deadlineDate} // 日付が未入力なら時刻は入力不可
                className="bg-slate-50 border-slate-200 text-xs w-28 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
            {/* 入力された値のプレビュー */}
            {deadlineDate && (
              <p className="text-[11px] text-slate-400">
                {new Date(`${deadlineDate}T${deadlineTime || "00:00"}`).toLocaleString("ja-JP", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>

          {/* 所要時間 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              所要時間 *
            </Label>
            {/*
              時間（hours）と分（minutes）を別々に入力し、内部では合計分数に変換する。
              例: 1時間30分 → estimatedMinutes = 90
              setValue("estimatedMinutes", ...) でフォームに反映させている。
            */}
            <div className="flex items-center gap-3">
              {/* 時間 */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={hoursInput}
                  onChange={handleHoursChange}
                  className="bg-slate-50 border-slate-200 w-16 text-center tabular-nums"
                />
                <span className="text-sm text-slate-600 whitespace-nowrap">時間</span>
              </div>
              {/* 分 */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minsInput}
                  onChange={handleMinsChange}
                  className="bg-slate-50 border-slate-200 w-16 text-center tabular-nums"
                />
                <span className="text-sm text-slate-600 whitespace-nowrap">分</span>
              </div>
              {/* 合計のプレビュー */}
              <span className="text-[11px] text-slate-400 ml-auto">
                合計 {hoursInput * 60 + minsInput} 分
              </span>
            </div>
            {errors.estimatedMinutes && (
              <p className="text-xs text-rose-600">
                {errors.estimatedMinutes.message}
              </p>
            )}
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
                    selected:   "bg-rose-500   text-white  border-rose-500   shadow-sm",
                    unselected: "bg-white      text-rose-500   border-rose-200   hover:bg-rose-50",
                  },
                  {
                    value: "MEDIUM" as const,
                    label: "中",
                    selected:   "bg-yellow-400 text-white  border-yellow-400 shadow-sm",
                    unselected: "bg-white      text-yellow-600 border-yellow-200 hover:bg-yellow-50",
                  },
                  {
                    value: "LOW"    as const,
                    label: "低",
                    selected:   "bg-slate-400  text-white  border-slate-400  shadow-sm",
                    unselected: "bg-white      text-slate-500  border-slate-200  hover:bg-slate-100",
                  },
                ] as const
              ).map((opt) => {
                const isSelected = watch("priority") === opt.value;
                return (
                  <label key={opt.value} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      {...register("priority")}
                      className="sr-only"
                    />
                    <span
                      className={`
                        flex items-center justify-center py-2 rounded-xl border text-xs font-bold
                        transition-all duration-150 cursor-pointer select-none
                        ${isSelected ? opt.selected : opt.unselected}
                      `}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* APIエラー表示 */}
          {apiError && (
            <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
              {apiError}
            </p>
          )}

          {/* ボタン */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#0052FF] hover:bg-blue-700 text-white"
            >
              {isSubmitting ? "追加中..." : "追加する"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
