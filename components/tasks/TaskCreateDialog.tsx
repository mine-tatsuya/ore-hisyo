"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100, "100文字以内で入力してください"),
  description: z.string().max(1000).optional(),
  deadline: z.string().optional(),
  estimatedMinutes: z
    .number()
    .int()
    .min(1, "1分以上")
    .max(1440, "1440分（24時間）以内"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

type FormData = z.infer<typeof schema>;

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function TaskCreateDialog({ open, onClose, onCreated }: TaskCreateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM", estimatedMinutes: 60 },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("タスクの作成に失敗しました");
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">タスクを追加</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-50 text-slate-400">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">
              タイトル <span className="text-rose-500">*</span>
            </label>
            <input
              {...register("title")}
              placeholder="例: 企画書を書く"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            />
            {errors.title && (
              <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">
              説明
            </label>
            <textarea
              {...register("description")}
              placeholder="詳細メモ（任意）"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 resize-none"
            />
          </div>

          {/* 締切 + 所要時間 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">
                締切日時
              </label>
              <input
                type="datetime-local"
                {...register("deadline")}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">
                所要時間（分）<span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                {...register("estimatedMinutes", { valueAsNumber: true })}
                min={1}
                max={1440}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
              {errors.estimatedMinutes && (
                <p className="text-[10px] text-rose-600 mt-1">{errors.estimatedMinutes.message}</p>
              )}
            </div>
          </div>

          {/* 優先度 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">
              優先度 <span className="text-rose-500">*</span>
            </label>
            <select
              {...register("priority")}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            >
              <option value="HIGH">HIGH - 高優先度</option>
              <option value="MEDIUM">MEDIUM - 中優先度</option>
              <option value="LOW">LOW - 低優先度</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-[#0052FF] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "作成中..." : (<><Plus className="w-4 h-4" strokeWidth={2} />追加</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
