"use client";

// 設定フォームコンポーネント
// サーバーから取得した初期設定値を受け取り、フォームとして表示・編集・保存する

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Settings } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, Clock, Bot, CalendarClock, Info, MapPin } from "lucide-react";
import { PREFECTURE_LIST } from "@/lib/constants/prefectures";

// ---- バリデーションスキーマ（APIと同じ定義）----
const formSchema = z.object({
  wakeUpTime:     z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  bedTime:        z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  lunchStart:     z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  lunchEnd:       z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  focusTimeStart: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  focusTimeEnd:   z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  aiPersonality:  z.enum(["STRICT", "BALANCED", "RELAXED"]),
  aiCustomPrompt:   z.string().max(500).optional(),
  calendarMode:     z.enum(["MANUAL", "AUTO"]),
  location:         z.enum(PREFECTURE_LIST as unknown as [string, ...string[]]).or(z.literal("")),
  cronTime:         z.string().regex(/^\d{2}:00$/, "HH:00形式で入力してください"),
  cronTargetOffset: z.number().int().min(0).max(7),
});

type FormData = z.infer<typeof formSchema>;

interface SettingsFormProps {
  // サーバーコンポーネント（settings/page.tsx）から渡される初期設定
  initialSettings: Settings;
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
  // 保存中・保存完了の状態管理
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }, // isDirty: 初期値から変更があるかどうか
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      wakeUpTime:     initialSettings.wakeUpTime,
      bedTime:        initialSettings.bedTime,
      lunchStart:     initialSettings.lunchStart,
      lunchEnd:       initialSettings.lunchEnd,
      focusTimeStart: initialSettings.focusTimeStart ?? "",
      focusTimeEnd:   initialSettings.focusTimeEnd   ?? "",
      aiPersonality:  initialSettings.aiPersonality,
      aiCustomPrompt: initialSettings.aiCustomPrompt ?? "",
      calendarMode:     initialSettings.calendarMode,
      location:         initialSettings.location ?? "",
      cronTime:         initialSettings.cronTime         ?? "12:00",
      cronTargetOffset: initialSettings.cronTargetOffset ?? 1,
    },
  });

  // 現在の選択値をリアルタイムに取得（ボタンの選択状態表示に使う）
  const watchPersonality  = watch("aiPersonality");
  const watchCalendarMode = watch("calendarMode");
  const watchBedTime      = watch("bedTime");

  // ---- フォーム送信処理 ----
  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    setSaved(false);
    setApiError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "保存に失敗しました");
        return;
      }

      // 保存成功：「保存しました」を2秒間表示
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setApiError("通信エラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- 共通スタイル ----
  // セクションのタイトル行
  const SectionHeader = ({
    icon,
    title,
    description,
  }: {
    icon: React.ReactNode;
    title: string;
    description: string;
  }) => (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-8 h-8 bg-[#0052FF]/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[#0052FF]">{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );

  // 時刻ラベル + インプットのペア
  const TimeField = ({
    label,
    fieldName,
    required = true,
  }: {
    label: string;
    fieldName: keyof FormData;
    required?: boolean;
  }) => (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {label}{required ? "" : "（任意）"}
      </Label>
      <Input
        type="time"
        {...register(fieldName)}
        className="bg-slate-50 border-slate-200 text-sm w-32"
      />
      {errors[fieldName] && (
        <p className="text-xs text-rose-600">
          {errors[fieldName]?.message as string}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

      {/* ========== セクション①：生活リズム ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <SectionHeader
          icon={<Clock className="w-4 h-4" />}
          title="生活リズム"
          description="AIがスケジュールを組む際に、この時間帯をベースに空き時間を計算します"
        />

        {/* 起床・就寝 */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <TimeField label="起床時間" fieldName="wakeUpTime" />

            {/* 就寝時間 — "24:00以降" ボタン付き特別フィールド */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                就寝時間
              </Label>
              {watchBedTime === "24:00" ? (
                /* "24:00以降" 選択中: バッジ表示 + 解除リンク */
                <div className="flex items-center gap-2">
                  <div className="bg-slate-700 text-white text-sm px-3 py-2 rounded-lg w-32 text-center">
                    深夜0時以降
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue("bedTime", "23:00", { shouldDirty: true })}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                  >
                    時間を指定
                  </button>
                </div>
              ) : (
                /* 通常: 時刻ピッカー + "24:00以降" ボタン */
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    {...register("bedTime")}
                    className="bg-slate-50 border-slate-200 text-sm w-32"
                  />
                  <button
                    type="button"
                    onClick={() => setValue("bedTime", "24:00", { shouldDirty: true })}
                    className="text-[11px] text-[#0052FF] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    24:00以降
                  </button>
                </div>
              )}
              {errors.bedTime && (
                <p className="text-xs text-rose-600">{errors.bedTime.message}</p>
              )}
            </div>
          </div>

          {/* 昼休み */}
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              昼休み
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="time"
                {...register("lunchStart")}
                className="bg-slate-50 border-slate-200 text-sm w-32"
              />
              <span className="text-xs text-slate-400">〜</span>
              <Input
                type="time"
                {...register("lunchEnd")}
                className="bg-slate-50 border-slate-200 text-sm w-32"
              />
            </div>
          </div>

          {/* 集中タイム（任意） */}
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              集中タイム（任意）
            </Label>
            <p className="text-[11px] text-slate-400 mb-1">
              この時間帯には重要度の高いタスクを優先的に配置します
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                {...register("focusTimeStart")}
                className="bg-slate-50 border-slate-200 text-sm w-32"
              />
              <span className="text-xs text-slate-400">〜</span>
              <Input
                type="time"
                {...register("focusTimeEnd")}
                className="bg-slate-50 border-slate-200 text-sm w-32"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========== セクション②：AI設定 ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <SectionHeader
          icon={<Bot className="w-4 h-4" />}
          title="AI設定"
          description="AIがスケジュールを提案するときの口調や姿勢を設定します"
        />

        {/* AIの口調 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              AIの口調
            </Label>
            <div className="flex gap-2">
              {(
                [
                  {
                    value: "STRICT"   as const,
                    label: "厳しめ",
                    desc:  "締切を意識した厳格なスケジュール",
                    selected:   "bg-rose-500 text-white border-rose-500 shadow-sm",
                    unselected: "bg-white text-rose-500 border-rose-200 hover:bg-rose-50",
                  },
                  {
                    value: "BALANCED" as const,
                    label: "バランス",
                    desc:  "無理なく計画的に進める提案",
                    selected:   "bg-[#0052FF] text-white border-[#0052FF] shadow-sm",
                    unselected: "bg-white text-[#0052FF] border-blue-200 hover:bg-blue-50",
                  },
                  {
                    value: "RELAXED"  as const,
                    label: "ゆったり",
                    desc:  "余裕を持った穏やかなスケジュール",
                    selected:   "bg-emerald-500 text-white border-emerald-500 shadow-sm",
                    unselected: "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50",
                  },
                ] as const
              ).map((opt) => {
                const isSelected = watchPersonality === opt.value;
                return (
                  <label key={opt.value} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      {...register("aiPersonality")}
                      className="sr-only"
                    />
                    <div
                      className={`
                        flex flex-col items-center justify-center p-3 rounded-xl border
                        transition-all duration-150 cursor-pointer select-none text-center
                        ${isSelected ? opt.selected : opt.unselected}
                      `}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className={`text-[10px] mt-0.5 leading-tight ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                        {opt.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 追加指示 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              AIへの追加指示（任意）
            </Label>
            <Textarea
              {...register("aiCustomPrompt")}
              placeholder="例：夕方以降は軽めのタスクにしてください"
              rows={3}
              className="bg-slate-50 border-slate-200 resize-none text-sm"
            />
            <p className="text-[11px] text-slate-400">
              スケジュール生成時にAIへ渡す追加の指示を自由に書けます（最大500文字）
            </p>
          </div>
        </div>
      </div>

      {/* ========== セクション③：居住地設定 ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <SectionHeader
          icon={<MapPin className="w-4 h-4" />}
          title="居住地"
          description="天気予報を取得する地域を設定します"
        />
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            都道府県
          </Label>
          {/* ドロップダウン: 気象庁APIが対応する47都道府県のみ選択可能 */}
          <select
            {...register("location")}
            className="bg-slate-50 border border-slate-200 text-sm rounded-md px-3 py-2 max-w-xs w-full focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 focus:border-[#0052FF]"
          >
            <option value="">選択してください</option>
            {PREFECTURE_LIST.map((pref) => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">
            天気条件付きタスクのスケジューリングに使用します。
          </p>
          {errors.location && (
            <p className="text-xs text-rose-600">{errors.location.message}</p>
          )}
        </div>
      </div>

      {/* ========== セクション④：カレンダー設定 ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <SectionHeader
          icon={<CalendarClock className="w-4 h-4" />}
          title="カレンダー設定"
          description="AIが生成したスケジュールをGoogle Calendarに反映する方法を選びます"
        />

        <div className="space-y-3">
          {/* モード切替ボタン */}
          {(
            [
              {
                value: "MANUAL" as const,
                label: "手動モード",
                desc:  "AIがスケジュール案を作成し、あなたが確認してからカレンダーに追加します。内容を自分でチェックしたい方に最適です。",
              },
              {
                value: "AUTO" as const,
                label: "自動モード",
                desc:  "毎朝決まった時刻にAIが自動でスケジュールを生成し、Google Calendarに追加します（定期実行はPhase 2で設定）。",
              },
            ] as const
          ).map((opt) => {
            const isSelected = watchCalendarMode === opt.value;
            return (
              <label key={opt.value} className="cursor-pointer block">
                <input
                  type="radio"
                  value={opt.value}
                  {...register("calendarMode")}
                  className="sr-only"
                />
                <div
                  className={`
                    flex items-start gap-3 p-4 rounded-xl border transition-all duration-150
                    ${isSelected
                      ? "bg-[#0052FF]/5 border-[#0052FF] ring-1 ring-[#0052FF]/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                    }
                  `}
                >
                  {/* 選択インジケーター（丸） */}
                  <div className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                    ${isSelected ? "border-[#0052FF] bg-[#0052FF]" : "border-slate-300"}
                  `}>
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isSelected ? "text-[#0052FF]" : "text-slate-700"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                </div>
              </label>
            );
          })}

          {/* 自動モード選択時：実行タイミングの説明 */}
          {watchCalendarMode === "AUTO" && (
            <div className="flex items-start gap-2 bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl p-3">
              <Info className="w-4 h-4 text-[#0052FF] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#0052FF]/80 leading-relaxed">
                毎日 12:00（正午）に翌日のスケジュールを自動生成し、Google Calendar に追加します。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========== 保存ボタン ========== */}
      <div className="flex items-center justify-end gap-3">
        {apiError && (
          <p className="text-xs text-rose-600">{apiError}</p>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Check className="w-3.5 h-3.5" />
            保存しました
          </span>
        )}
        <Button
          type="submit"
          disabled={isSaving || !isDirty}
          className="bg-[#0052FF] hover:bg-blue-700 text-white px-6"
        >
          {isSaving ? "保存中..." : "設定を保存"}
        </Button>
      </div>
    </form>
  );
}
