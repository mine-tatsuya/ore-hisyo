"use client";

// スケジュールページ
// ページロード時: Googleカレンダーのイベントを取得してタイムラインを表示
// 「生成」ボタン後: AIのスケジュールを同じタイムラインに追加表示

import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import AiCommentCard    from "@/components/schedule/AiCommentCard";
import ScheduleTimeline, { CalendarEventBlock } from "@/components/schedule/ScheduleTimeline";
import type { ScheduleItem } from "@/app/api/schedule/generate/route";

// /api/schedule/generate が返す型
interface GenerateResponse {
  date:             string;
  schedule:         ScheduleItem[];
  comment:          string;
  calendarWarning?: string | null;
}

// /api/calendar/events の allDayEvents の型
interface AllDayEvent {
  id:    string;
  title: string;
}

// ISO 文字列（"2024-03-15T09:00:00.000Z"）→ "HH:MM" 形式に変換
// タイムラインコンポーネントは "HH:MM" 文字列で動いているため変換が必要
function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 今日の日付を "YYYY-MM-DD" 形式で返す
function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function SchedulePage() {

  // ── カレンダーイベントの状態 ──
  const [timedEvents,     setTimedEvents]     = useState<CalendarEventBlock[]>([]);
  const [allDayEvents,    setAllDayEvents]    = useState<AllDayEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError,   setCalendarError]   = useState<string | null>(null);

  // ── AI生成結果の状態 ──
  const [result,    setResult]    = useState<GenerateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── カレンダー適用の状態 ──
  const [isApplying, setIsApplying] = useState(false);
  const [isApplied,  setIsApplied]  = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // ── ページロード時にカレンダーイベントを取得 ──
  // useEffect は「コンポーネントが画面に表示されたあと、1回だけ実行する」という処理に使う。
  // [] を第2引数に渡すと「マウント時のみ実行」という意味になる。
  useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        const res  = await fetch("/api/calendar/events");
        const json = await res.json();

        if (!res.ok) {
          setCalendarError(json.error ?? "カレンダーの取得に失敗しました");
          return;
        }

        // ISO文字列 → "HH:MM" に変換してからセット
        setTimedEvents(
          json.timedEvents.map((e: { id: string; title: string; start: string; end: string }) => ({
            id:    e.id,
            title: e.title,
            start: isoToHHMM(e.start),
            end:   isoToHHMM(e.end),
          }))
        );
        setAllDayEvents(json.allDayEvents);

      } catch {
        setCalendarError("カレンダーの取得に失敗しました");
      } finally {
        setCalendarLoading(false);
      }
    };

    fetchCalendarEvents();
  }, []);

  // ── スケジュール生成 ──
  const generate = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsApplied(false);
    setApplyError(null);

    try {
      const res  = await fetch("/api/schedule/generate");
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "スケジュール生成に失敗しました");
        return;
      }

      setResult(json);
    } catch {
      setError("通信エラーが発生しました。しばらく後に再試行してください。");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google Calendar に適用 ──
  const applyToCalendar = async (schedule: ScheduleItem[]) => {
    if (!result) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      const res  = await fetch("/api/schedule/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date: result.date, schedule }),
      });
      const json = await res.json();

      if (!res.ok) {
        setApplyError(json.error ?? "カレンダーへの追加に失敗しました");
        return;
      }

      setIsApplied(true);
    } catch {
      setApplyError("通信エラーが発生しました");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="pt-2 space-y-4 max-w-2xl">

      {/* ── ヘッダーカード（生成ボタン）── */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-800">今日のスケジュール</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              タスクと空き時間をもとにAIが最適なスケジュールを提案します
            </p>
          </div>
          <button
            onClick={generate}
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#0052FF] text-white text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 shadow-sm"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Sparkles className="w-4 h-4" />
            }
            {isLoading ? "生成中..." : "スケジュール生成"}
          </button>
        </div>

        {/* カレンダー未取得の警告（AI生成時） */}
        {result?.calendarWarning && (
          <div className="flex items-start gap-2 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">{result.calendarWarning}</p>
          </div>
        )}

        {/* AI生成エラー */}
        {error && (
          <div className="flex items-start gap-2 mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-700">{error}</p>
          </div>
        )}
      </div>

      {/* ── 終日イベントバナー ── */}
      {/* 終日イベント（祝日・試験期間など）はタイムラインに入れず、上部にチップで表示 */}
      {allDayEvents.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[10px] font-medium text-slate-400 mb-2">本日の終日イベント</p>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((event) => (
              <span
                key={event.id}
                className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full"
              >
                📅 {event.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── AIのコメント（生成後のみ表示）── */}
      {result && (
        <AiCommentCard
          comment={result.comment}
          onRegenerate={generate}
          isLoading={isLoading}
        />
      )}

      {/* ── タイムライン ── */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">

        {/* カレンダー読み込み中 */}
        {calendarLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p className="text-xs">カレンダーを読み込み中...</p>
          </div>
        )}

        {/* カレンダー取得エラー（警告として表示し、タイムラインは空で表示） */}
        {!calendarLoading && calendarError && (
          <div className="flex items-start gap-2 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">{calendarError}</p>
          </div>
        )}

        {/* カレンダー適用エラー */}
        {applyError && (
          <div className="flex items-start gap-2 mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-700">{applyError}</p>
          </div>
        )}

        {/* タイムライン本体（カレンダー読み込み完了後に表示） */}
        {!calendarLoading && (
          <ScheduleTimeline
            schedule={result?.schedule ?? []}
            calendarEvents={timedEvents}
            workStart="00:00"
            workEnd="24:00"
            date={result?.date ?? todayString()}
            onApply={applyToCalendar}
            isApplying={isApplying}
            isApplied={isApplied}
          />
        )}
      </div>
    </div>
  );
}
