"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Sparkles, RefreshCw, CalendarCheck } from "lucide-react";
import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import type { GeneratedSchedule } from "@/types/schedule";

export function ScheduleClient() {
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [targetDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const today = format(new Date(), "M/d (E)", { locale: ja });

  const generateSchedule = async (isReschedule = false) => {
    setLoading(true);
    setError("");
    setApplied(false);
    try {
      const endpoint = isReschedule ? "/api/schedule/reschedule" : "/api/schedule/generate";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "スケジュール生成に失敗しました");
      setSchedule(data.schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const applyToCalendar = async () => {
    if (!schedule) return;
    if (!confirm("生成したスケジュールをGoogleカレンダーに反映しますか？")) return;
    setApplying(true);
    setError("");
    try {
      const res = await fetch("/api/schedule/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule, targetDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "カレンダー反映に失敗しました");
      setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setApplying(false);
    }
  };

  // URL パラメータで reschedule モードが指定されている場合
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "reschedule") {
      generateSchedule(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            スケジュール生成
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{today}</p>
        </div>
        {schedule && (
          <button
            onClick={() => generateSchedule(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
            再生成
          </button>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* 成功メッセージ */}
      {applied && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4" strokeWidth={1.5} />
          Googleカレンダーへの反映が完了しました
        </div>
      )}

      {/* スケジュール未生成の初期状態 */}
      {!schedule && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Sparkles className="w-12 h-12 mb-4" strokeWidth={1} />
          <p className="text-sm font-medium text-slate-600 mb-1">
            今日のスケジュールを生成しましょう
          </p>
          <p className="text-xs mb-6">
            タスクとGoogleカレンダーを元にAIが最適なスケジュールを提案します
          </p>
          <button
            onClick={() => generateSchedule(false)}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-[#0052FF] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" strokeWidth={2} />
            スケジュールを生成する
          </button>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Sparkles className="w-10 h-10 mb-3 animate-pulse text-blue-400" strokeWidth={1} />
          <p className="text-sm font-medium text-slate-600">AIがスケジュールを作成中...</p>
          <p className="text-xs mt-1">しばらくお待ちください</p>
        </div>
      )}

      {/* スケジュール表示 */}
      {schedule && !loading && (
        <div className="space-y-4">
          <ScheduleTimeline schedule={schedule} />

          {/* カレンダー反映ボタン */}
          {!applied && (
            <button
              onClick={applyToCalendar}
              disabled={applying}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-[#0052FF] text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <CalendarCheck className="w-4 h-4" strokeWidth={2} />
              {applying ? "カレンダーに反映中..." : "カレンダーに反映する →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
