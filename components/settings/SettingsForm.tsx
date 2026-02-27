"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  wakeUpTime: z.string().regex(/^\d{2}:\d{2}$/),
  bedTime: z.string().regex(/^\d{2}:\d{2}$/),
  lunchStart: z.string().regex(/^\d{2}:\d{2}$/),
  lunchEnd: z.string().regex(/^\d{2}:\d{2}$/),
  focusTimeStart: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  focusTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  aiPersonality: z.enum(["STRICT", "BALANCED", "RELAXED"]),
  aiCustomPrompt: z.string().max(500).optional(),
  calendarMode: z.enum(["AUTO", "MANUAL"]),
});

type FormData = z.infer<typeof schema>;

export function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      wakeUpTime: "07:00",
      bedTime: "23:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
      aiPersonality: "BALANCED",
      calendarMode: "MANUAL",
    },
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) reset(data.settings);
        setLoading(false);
      });
  }, [reset]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          focusTimeStart: data.focusTimeStart || null,
          focusTimeEnd: data.focusTimeEnd || null,
          aiCustomPrompt: data.aiCustomPrompt || null,
        }),
      });
      if (!res.ok) throw new Error("設定の保存に失敗しました");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";
  const sectionClass = "bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-6">設定</h1>

      {/* 生活リズム */}
      <div className={sectionClass}>
        <h2 className="text-sm font-bold text-slate-900 mb-4">生活リズム</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">起床時間</label>
            <input type="time" {...register("wakeUpTime")} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">就寝時間</label>
            <input type="time" {...register("bedTime")} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">昼休憩 開始</label>
            <input type="time" {...register("lunchStart")} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">昼休憩 終了</label>
            <input type="time" {...register("lunchEnd")} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">集中タイム 開始（任意）</label>
            <input type="time" {...register("focusTimeStart")} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">集中タイム 終了（任意）</label>
            <input type="time" {...register("focusTimeEnd")} className={inputClass} />
          </div>
        </div>
      </div>

      {/* AI スタイル */}
      <div className={sectionClass}>
        <h2 className="text-sm font-bold text-slate-900 mb-4">AIのスタイル</h2>
        <div className="space-y-2 mb-4">
          {([
            ["STRICT", "厳しめ", "タスクをぎっしり詰めて締切を最優先"],
            ["BALANCED", "バランス型", "適度な休憩を挟みながら無理のないペース"],
            ["RELAXED", "ゆったり", "余裕を持った計画でバッファ時間を多めに"],
          ] as const).map(([value, label, desc]) => (
            <label
              key={value}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <input
                type="radio"
                value={value}
                {...register("aiPersonality")}
                className="mt-0.5 accent-[#0052FF]"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-400">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-1">
            追加指示（任意）
          </label>
          <textarea
            {...register("aiCustomPrompt")}
            placeholder="例: 夕方は集中力が落ちるので、重要なタスクは午前中に配置してください"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* カレンダー連携 */}
      <div className={sectionClass}>
        <h2 className="text-sm font-bold text-slate-900 mb-4">カレンダー連携</h2>
        <div className="space-y-2">
          {([
            ["MANUAL", "手動承認", "生成後に確認してからカレンダーに反映"],
            ["AUTO", "自動反映", "生成後に自動でカレンダーに書き込む（Cron使用時）"],
          ] as const).map(([value, label, desc]) => (
            <label
              key={value}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <input
                type="radio"
                value={value}
                {...register("calendarMode")}
                className="mt-0.5 accent-[#0052FF]"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-400">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      {saved && (
        <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          ✓ 設定を保存しました
        </p>
      )}

      {/* エラーがあれば表示 */}
      {Object.keys(errors).length > 0 && (
        <p className="text-xs text-rose-600">入力内容を確認してください</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 text-sm font-medium bg-[#0052FF] text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {saving ? "保存中..." : "変更を保存"}
      </button>
    </form>
  );
}
