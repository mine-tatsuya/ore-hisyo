"use client";

// スケジュールページ
// ページロード時: 選択日のGoogleカレンダーイベントを取得してタイムラインを表示
// 「生成」ボタン後: AIのスケジュールを同じタイムラインに追加表示
// ← → ボタンで日付を移動できる

import { useState, useEffect, useMemo } from "react";
import { Sparkles, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import AiCommentCard       from "@/components/schedule/AiCommentCard";
import ScheduleTimeline, { CalendarEventBlock } from "@/components/schedule/ScheduleTimeline";
import DatePickerCalendar  from "@/components/schedule/DatePickerCalendar";
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

// ── 日付ユーティリティ関数 ──

// Date → "YYYY-MM-DD"（APIのクエリパラメータに使う）
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 指定した日付に n 日を加えた新しい Date を返す
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 与えられた日付が今日かどうか判定
function isTodayDate(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth()    === today.getMonth()    &&
    date.getDate()     === today.getDate()
  );
}

// 日付を日本語で表示（例: "2026年3月4日（水）"）
function formatDateJa(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year:    "numeric",
    month:   "long",
    day:     "numeric",
    weekday: "short",
  });
}

// 設定の起床・就寝時間から睡眠ブロックを生成する
// ・00:00〜wakeUpTime（深夜〜起床）
// ・bedTime〜24:00（就寝〜深夜）※ bedTime が "24:00" のときは追加しない
function createSleepBlocks(wakeUpTime: string, bedTime: string): ScheduleItem[] {
  const blocks: ScheduleItem[] = [];

  // 深夜〜起床（例: 00:00〜07:00）
  if (wakeUpTime > "00:00") {
    blocks.push({
      taskId: "SLEEP_BLOCK",
      title:  "💤 睡眠",
      start:  "00:00",
      end:    wakeUpTime,
      note:   "睡眠時間",
    });
  }

  // 就寝〜深夜（例: 23:00〜24:00）
  // bedTime が "24:00" の場合は既に日付を跨いでいるので不要
  if (bedTime < "24:00") {
    blocks.push({
      taskId: "SLEEP_BLOCK",
      title:  "💤 睡眠",
      start:  bedTime,
      end:    "24:00",
      note:   "就寝時間",
    });
  }

  return blocks;
}

// ISO 文字列 → "HH:MM"
function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SchedulePage() {

  // ── 選択中の日付（初期値: 今日）──
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0); // 時刻をリセット（比較をシンプルにする）
    return d;
  });

  // カレンダーポップアップの表示状態
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  // ── 睡眠ブロック（設定読み込み直後から常時表示）──
  // カレンダーイベント取得時に設定も一緒に受け取り、ここに保存する。
  // generate() とは独立しているため、生成ボタン前後どちらでも表示される。
  const [sleepBlocks, setSleepBlocks] = useState<ScheduleItem[]>([]);

  // ── 日付が変わるたびにカレンダーイベントを再取得 ──
  //
  // 【useEffect の依存配列について】
  // [selectedDate] を渡すと「selectedDate が変わるたびに再実行」という意味になる。
  // [] だと「最初の1回だけ」だったが、日付ナビに対応するためここを変更した。
  //
  // 【cancelled フラグについて】
  // ユーザーが素早く日付を連打した場合、古いリクエストの結果が後から届いて
  // 上書きしてしまう「レースコンディション」が起きる。
  // cancelled = true にすることで、古いリクエストの結果を無視できる。
  useEffect(() => {
    let cancelled = false;

    // 日付が変わった瞬間に画面をリセット（古い日付のデータを消す）
    setCalendarLoading(true);
    setTimedEvents([]);
    setAllDayEvents([]);
    setSleepBlocks([]);
    setCalendarError(null);
    setResult(null);
    setError(null);
    setIsApplied(false);
    setApplyError(null);

    const fetchCalendarEvents = async () => {
      try {
        const dateStr = toDateString(selectedDate);
        const res  = await fetch(`/api/calendar/events?date=${dateStr}`);
        const json = await res.json();

        if (cancelled) return; // すでに別の日付に切り替わっていたら無視

        if (!res.ok) {
          setCalendarError(json.error ?? "カレンダーの取得に失敗しました");
          return;
        }

        setTimedEvents(
          json.timedEvents.map((e: { id: string; title: string; start: string; end: string; isOreHisyo: boolean }) => ({
            id:         e.id,
            title:      e.title,
            start:      isoToHHMM(e.start),
            end:        isoToHHMM(e.end),
            isOreHisyo: e.isOreHisyo,
          }))
        );
        setAllDayEvents(json.allDayEvents);

        // 設定を受け取ったらすぐに睡眠ブロックを生成して保持する
        // → generate() を押す前からタイムラインに睡眠が表示される
        if (json.settings) {
          setSleepBlocks(createSleepBlocks(json.settings.wakeUpTime, json.settings.bedTime));
        }

      } catch {
        if (!cancelled) setCalendarError("カレンダーの取得に失敗しました");
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    };

    fetchCalendarEvents();

    // クリーンアップ: このエフェクトが「古く」なったら cancelled = true にする
    return () => { cancelled = true; };
  }, [selectedDate]); // selectedDate が変わるたびに実行

  // ── スケジュール生成 ──
  const generate = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsApplied(false);
    setApplyError(null);

    try {
      // 選択日を API に渡す
      const dateStr = toDateString(selectedDate);
      const res  = await fetch(`/api/schedule/generate?date=${dateStr}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "スケジュール生成に失敗しました");
        return;
      }

      // AI スケジュールのみをセット（睡眠ブロックは sleepBlocks ステートで管理）
      setResult(json);
    } catch {
      setError("通信エラーが発生しました。しばらく後に再試行してください。");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google Calendar に適用 ──
  // schedule には sleepBlocks + AI スケジュールの両方が含まれる（ScheduleTimeline から渡される）
  const applyToCalendar = async (schedule: ScheduleItem[]) => {
    setIsApplying(true);
    setApplyError(null);

    try {
      const res  = await fetch("/api/schedule/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date: toDateString(selectedDate), schedule }),
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

  // ── タイムラインに渡す表示用スケジュール ──
  // 【useMemo を使う理由】
  // [...sleepBlocks, ...aiSchedule] はスプレッド構文のため、
  // 毎レンダーで「別物の配列」が生成される。
  // useDragSchedule は schedule の参照が変わると localSchedule をリセットするので、
  // setIsApplying(true) などで再レンダーが起きるたびにドラッグ後の位置が元に戻ってしまう。
  // useMemo で依存値（sleepBlocks, result）が変わらない限り同じ参照を返すことで解決する。
  const displaySchedule = useMemo(
    () => [...sleepBlocks, ...(result?.schedule ?? [])],
    [sleepBlocks, result]
  );

  // ページタイトル（今日かどうかで変える）
  const pageTitle = isTodayDate(selectedDate)
    ? "今日のスケジュール"
    : `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日のスケジュール`;

  // 終日イベントバナーのラベル
  const allDayLabel = isTodayDate(selectedDate)
    ? "本日の終日イベント"
    : `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日の終日イベント`;

  return (
    <div className="pt-2 space-y-4 max-w-2xl">

      {/* ── ヘッダーカード ── */}
      {/* relative z-10: このカードのスタッキングコンテキストを timeline より上にする */}
      {/* → 内側のカレンダーポップアップが timeline カードの上に表示される */}
      <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        {/* モバイルでは縦積み、sm以上では横並び */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-slate-800">{pageTitle}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              タスクと空き時間をもとにAIが最適なスケジュールを提案します
            </p>
          </div>
          {/* w-full sm:w-auto でモバイルのみ全幅ボタン */}
          <button
            onClick={generate}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0052FF] text-white text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 shadow-sm"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Sparkles className="w-4 h-4" />
            }
            {isLoading ? "生成中..." : "スケジュール生成"}
          </button>
        </div>

        {/* ── 日付ナビゲーション ── */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          {/* 前の日へ */}
          <button
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800
                       px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            前日
          </button>

          {/* 日付表示（クリックでカレンダーポップアップを開く）*/}
          <div className="relative flex flex-col items-center gap-1">
            <button
              onClick={() => setCalendarOpen((prev) => !prev)}
              className="text-xs font-medium text-slate-700 hover:text-[#0052FF]
                         transition-colors px-2 py-0.5 rounded-lg hover:bg-blue-50"
            >
              {formatDateJa(selectedDate)}
            </button>
            {isTodayDate(selectedDate) ? (
              <span className="text-[10px] text-[#0052FF] font-semibold">今日</span>
            ) : (
              <button
                onClick={() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  setSelectedDate(today);
                }}
                className="text-[10px] text-[#0052FF] hover:underline"
              >
                今日に戻る
              </button>
            )}

            {/* カレンダーポップアップ */}
            {calendarOpen && (
              <DatePickerCalendar
                selectedDate={selectedDate}
                onSelect={(date) => setSelectedDate(date)}
                onClose={() => setCalendarOpen(false)}
              />
            )}
          </div>

          {/* 次の日へ */}
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800
                       px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            翌日
            <ChevronRight className="w-4 h-4" />
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
      {allDayEvents.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[10px] font-medium text-slate-400 mb-2">{allDayLabel}</p>
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

        {/* カレンダー取得エラー */}
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

        {/* タイムライン本体 */}
        {/* schedule = 睡眠ブロック（常時）＋ AI生成スケジュール（生成後） */}
        {!calendarLoading && (
          <ScheduleTimeline
            schedule={displaySchedule}
            calendarEvents={
              result
                ? timedEvents.filter((e) => !e.isOreHisyo)
                : timedEvents
            }
            workStart="00:00"
            workEnd="24:00"
            date={toDateString(selectedDate)}
            onApply={applyToCalendar}
            isApplying={isApplying}
            isApplied={isApplied}
            hasAiSchedule={result !== null}
          />
        )}
      </div>
    </div>
  );
}
