"use client";

// RecurringTaskCreateDialog
// 定期タスクを新規作成するダイアログ。
// 繰り返しタイプ（毎日/毎週/N日ごと/毎月）によってフォームが動的に変わります。

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { RecurringTask } from "@prisma/client";
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

// ── フォームスキーマ ──
const formSchema = z.object({
  title: z.string().min(1, "タスク名を入力してください").max(100, "100文字以内で入力してください"),
  description: z.string().max(1000).optional(),
  estimatedMinutes: z
    .number()
    .int()
    .min(1, "1分以上で入力してください")
    .max(1440, "最大24時間まで設定できます"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  recurrenceType: z.enum(["DAILY", "WEEKLY", "INTERVAL", "MONTHLY"]),
  // WEEKLY 用
  daysOfWeek: z.array(z.number()).optional(),
  // INTERVAL 用
  intervalDays: z.number().int().min(1).max(365).optional(),
  // MONTHLY 用
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  // 希望時間帯
  preferredTimeType: z.enum(["MORNING", "NOON", "EVENING", "SPECIFIC"]).optional(),
  preferredStartTime: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RecurringTaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (task: RecurringTask) => void;
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

export default function RecurringTaskCreateDialog({
  open,
  onClose,
  onCreated,
}: RecurringTaskCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 所要時間：時間と分を別管理
  const [hoursInput, setHoursInput] = useState(0);
  const [minsInput, setMinsInput] = useState(30);

  // 曜日の選択（WEEKLY 用）
  // チェックボックスの状態を useState で管理します
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priority:        "MEDIUM",
      recurrenceType:  "DAILY",
      estimatedMinutes: 30,
    },
  });

  const recurrenceType    = watch("recurrenceType");
  const preferredTimeType = watch("preferredTimeType");

  // ダイアログを閉じてリセット
  const handleClose = () => {
    reset();
    setHoursInput(0);
    setMinsInput(30);
    setSelectedDays([]);
    setApiError(null);
    onClose();
  };

  // 所要時間の時間が変わったとき
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Math.max(0, Math.min(24, Math.floor(Number(e.target.value)) || 0));
    setHoursInput(h);
    setValue("estimatedMinutes", h * 60 + minsInput, { shouldValidate: true });
  };

  // 所要時間の分が変わったとき
  const handleMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = Math.max(0, Math.min(59, Math.floor(Number(e.target.value)) || 0));
    setMinsInput(m);
    setValue("estimatedMinutes", hoursInput * 60 + m, { shouldValidate: true });
  };

  // 曜日チェックボックスのトグル（WEEKLY 用）
  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // フォーム送信
  const onSubmit = async (data: FormData) => {
    // WEEKLY のバリデーション（曜日が1つも選択されていない場合）
    if (data.recurrenceType === "WEEKLY" && selectedDays.length === 0) {
      setApiError("曜日を1つ以上選択してください");
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      // API に送信するデータを組み立てる
      const payload: Record<string, unknown> = {
        title:            data.title,
        description:      data.description || undefined,
        estimatedMinutes: data.estimatedMinutes,
        priority:         data.priority,
        recurrenceType:   data.recurrenceType,
      };

      // 繰り返しタイプ別の追加フィールド
      if (data.recurrenceType === "WEEKLY") {
        payload.daysOfWeek = JSON.stringify(selectedDays);
      } else if (data.recurrenceType === "INTERVAL") {
        payload.intervalDays = data.intervalDays;
      } else if (data.recurrenceType === "MONTHLY") {
        payload.dayOfMonth = data.dayOfMonth;
      }

      // 希望時間帯（未選択の場合は送らない）
      if (data.preferredTimeType) {
        payload.preferredTimeType = data.preferredTimeType;
        if (data.preferredTimeType === "SPECIFIC") {
          payload.preferredStartTime = data.preferredStartTime;
        }
      }

      const res = await fetch("/api/recurring-tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "エラーが発生しました");
        return;
      }

      const json = await res.json();
      onCreated(json.recurringTask);
      handleClose();
    } catch {
      setApiError("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            定期タスクを追加
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
              placeholder="例: 洗濯、ストレッチ、英語学習"
              className="bg-slate-50 border-slate-200"
            />
            {errors.title && (
              <p className="text-xs text-rose-600">{errors.title.message}</p>
            )}
          </div>

          {/* 繰り返しタイプ */}
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
              ).map((opt) => {
                const isSelected = watch("recurrenceType") === opt.value;
                return (
                  <label key={opt.value} className="cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      {...register("recurrenceType")}
                      className="sr-only"
                    />
                    <span
                      className={`
                        flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium
                        transition-all duration-150 cursor-pointer select-none
                        ${isSelected
                          ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }
                      `}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* WEEKLY: 曜日チェックボックス */}
          {recurrenceType === "WEEKLY" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                実施する曜日 *
              </Label>
              <div className="flex gap-2">
                {DAY_LABELS.map(({ value, label }) => {
                  const isSelected = selectedDays.includes(value);
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
          {recurrenceType === "INTERVAL" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                間隔（日数） *
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  {...register("intervalDays", { valueAsNumber: true })}
                  className="bg-slate-50 border-slate-200 w-20 text-center"
                  placeholder="3"
                />
                <span className="text-sm text-slate-600">日ごと</span>
              </div>
              {errors.intervalDays && (
                <p className="text-xs text-rose-600">{errors.intervalDays.message}</p>
              )}
            </div>
          )}

          {/* MONTHLY: 何日か */}
          {recurrenceType === "MONTHLY" && (
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
                  {...register("dayOfMonth", { valueAsNumber: true })}
                  className="bg-slate-50 border-slate-200 w-20 text-center"
                  placeholder="1"
                />
                <span className="text-sm text-slate-600">日</span>
              </div>
              {errors.dayOfMonth && (
                <p className="text-xs text-rose-600">{errors.dayOfMonth.message}</p>
              )}
            </div>
          )}

          {/* 希望時間帯 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              希望時間帯（任意）
            </Label>
            <div className="flex gap-2 flex-wrap">
              {/* 未指定オプション */}
              <button
                type="button"
                onClick={() => setValue("preferredTimeType", undefined)}
                className={`
                  flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium
                  transition-all duration-150 cursor-pointer select-none
                  ${!preferredTimeType
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
              ).map((opt) => {
                const isSelected = preferredTimeType === opt.value;
                return (
                  <label key={opt.value} className="cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      {...register("preferredTimeType")}
                      className="sr-only"
                    />
                    <span
                      className={`
                        flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium
                        transition-all duration-150 cursor-pointer select-none
                        ${isSelected
                          ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }
                      `}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* SPECIFIC 選択時: 時刻入力 */}
            {preferredTimeType === "SPECIFIC" && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="time"
                  {...register("preferredStartTime")}
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
                  value={hoursInput}
                  onChange={handleHoursChange}
                  className="bg-slate-50 border-slate-200 w-16 text-center tabular-nums"
                />
                <span className="text-sm text-slate-600 whitespace-nowrap">時間</span>
              </div>
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
              <span className="text-[11px] text-slate-400 ml-auto">
                合計 {hoursInput * 60 + minsInput} 分
              </span>
            </div>
            {errors.estimatedMinutes && (
              <p className="text-xs text-rose-600">{errors.estimatedMinutes.message}</p>
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

          {/* メモ */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              メモ（任意・Gemini への補足情報）
            </Label>
            <Textarea
              {...register("description")}
              placeholder="例: 雨の日は避けてほしい、なるべく午前中に入れてほしい"
              rows={2}
              className="bg-slate-50 border-slate-200 resize-none"
            />
          </div>

          {/* APIエラー */}
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
