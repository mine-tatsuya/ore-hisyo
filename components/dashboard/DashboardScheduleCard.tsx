"use client";

// ダッシュボード用「今日のスケジュール」カード
//
// "use client" が必要な理由:
//   - useEffect / useRef / useState など React Hooks を使うから
//   - Server Component (dashboard/page.tsx) の中に配置できる
//
// 責任:
//   - Google Calendar の本日の予定を API から取得してタイムライン表示
//   - 起動時に現在時刻付近に自動スクロール
//   - 現在時刻ライン（赤いバー）を1分ごとに更新

import { useEffect, useRef, useState } from "react";
import { Sparkles, CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import type { CalendarEventBlock } from "@/components/schedule/ScheduleTimeline";

// --------------------------------------------------------
// 型定義
// --------------------------------------------------------

// 睡眠ブロック用の最小 ScheduleItem（インポートが複雑なので inline で定義）
interface SleepBlock {
  taskId:  string; // "SLEEP_BLOCK"
  title:   string;
  start:   string; // "HH:MM"
  end:     string; // "HH:MM"
  duration: number;
}

// --------------------------------------------------------
// 定数
// --------------------------------------------------------

// 1時間あたりのピクセル数（ScheduleTimeline.tsx と合わせる）
const PX_PER_HOUR    = 42;
// 24 時間分の高さ
const TIMELINE_HEIGHT = 24 * PX_PER_HOUR; // 1008px

// --------------------------------------------------------
// ユーティリティ関数
// --------------------------------------------------------

/** ISO 文字列 → "HH:MM"（ローカル時間） */
function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** "HH:MM" → 分数 */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * 設定の起床・就寝時間から「睡眠ブロック」を生成
 * 例: 起床 07:00, 就寝 23:00 → 0:00〜7:00 と 23:00〜24:00 をグレーで表示
 */
function createSleepBlocks(wakeUpTime: string, bedTime: string): SleepBlock[] {
  const blocks: SleepBlock[] = [];
  if (wakeUpTime !== "00:00") {
    blocks.push({
      taskId:   "SLEEP_BLOCK",
      title:    "睡眠",
      start:    "00:00",
      end:      wakeUpTime,
      duration: toMinutes(wakeUpTime),
    });
  }
  if (bedTime !== "24:00" && bedTime !== "00:00") {
    blocks.push({
      taskId:   "SLEEP_BLOCK",
      title:    "睡眠",
      start:    bedTime,
      end:      "24:00",
      duration: 1440 - toMinutes(bedTime),
    });
  }
  return blocks;
}

// --------------------------------------------------------
// メインコンポーネント
// --------------------------------------------------------

export default function DashboardScheduleCard() {
  // ----- State -----
  const [events,       setEvents]       = useState<CalendarEventBlock[]>([]);
  const [sleepBlocks,  setSleepBlocks]  = useState<SleepBlock[]>([]);
  const [allDayEvents, setAllDayEvents] = useState<{ id: string; title: string }[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // 現在時刻（1分ごとに更新）
  const [now, setNow] = useState(() => new Date());

  // スクロールコンテナの参照
  const scrollRef = useRef<HTMLDivElement>(null);

  // ----- useEffect ① カレンダーイベント取得（マウント時1回）-----
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    fetch(`/api/calendar/events?date=${todayStr}`)
      .then((res) => {
        if (!res.ok) return Promise.reject(res);
        return res.json();
      })
      .then((json) => {
        // timedEvents の start/end は ISO 文字列 → "HH:MM" に変換
        setEvents(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (json.timedEvents ?? []).map((e: any) => ({
            id:         e.id,
            title:      e.title,
            start:      isoToHHMM(e.start),
            end:        isoToHHMM(e.end),
            isOreHisyo: e.isOreHisyo ?? false,
          }))
        );
        setAllDayEvents(json.allDayEvents ?? []);

        if (json.settings) {
          setSleepBlocks(
            createSleepBlocks(json.settings.wakeUpTime, json.settings.bedTime)
          );
        }
      })
      .catch(() => setError("カレンダーの取得に失敗しました"))
      .finally(() => setIsLoading(false));
  }, []);

  // ----- useEffect ② 現在時刻への自動スクロール（ロード完了後1回）-----
  useEffect(() => {
    if (isLoading || !scrollRef.current) return;

    const nowMin   = now.getHours() * 60 + now.getMinutes();
    const topPx    = (nowMin / 1440) * TIMELINE_HEIGHT;
    const visible  = scrollRef.current.clientHeight;

    // 現在時刻がスクロールコンテナの中央に来るようにする
    scrollRef.current.scrollTop = Math.max(0, topPx - visible / 2);
  // isLoading が false になったときのみ実行（nowは依存させない）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ----- useEffect ③ 現在時刻の1分ごと更新 -----
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ----- 現在時刻の位置計算 -----
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTopPct  = (nowMinutes / 1440) * 100; // % for absolute positioning

  // ----- 時刻ラベル（0〜24時）-----
  const hourMarkers: number[] = Array.from({ length: 25 }, (_, i) => i);

  // ----- 日付表示（日本語フォーマット）-----
  const todayLabel = now.toLocaleDateString("ja-JP", {
    month: "numeric",
    day:   "numeric",
    weekday: "short",
  });

  // --------------------------------------------------------
  // レンダリング
  // --------------------------------------------------------

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">

      {/* ヘッダー行 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">今日のスケジュール</h2>
          <p className="text-xs text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <Link
          href="/schedule"
          className="flex items-center gap-1.5 text-xs text-[#0052FF] font-medium hover:underline"
        >
          スケジュールを開く →
        </Link>
      </div>

      {/* 終日イベントバナー */}
      {allDayEvents.length > 0 && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {allDayEvents.map((ev) => (
            <span
              key={ev.id}
              className="flex-shrink-0 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full"
            >
              {ev.title}
            </span>
          ))}
        </div>
      )}

      {/* ローディング */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">カレンダーを読み込み中...</span>
        </div>
      )}

      {/* エラー */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Sparkles className="w-8 h-8 mb-2 stroke-1" />
          <p className="text-xs text-slate-500">{error}</p>
          <Link href="/schedule" className="text-xs text-[#0052FF] mt-2 hover:underline">
            スケジュールページで確認する
          </Link>
        </div>
      )}

      {/* タイムライン本体 */}
      {!isLoading && !error && (
        /*
         * スクロールコンテナ
         * h-80 = 320px の可視領域、内側の div が 1008px で縦スクロール可能
         */
        <div
          ref={scrollRef}
          className="h-80 overflow-y-auto rounded-xl"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* タイムライン本体（高さ固定: 1008px）*/}
          <div className="flex gap-3" style={{ height: TIMELINE_HEIGHT }}>

            {/* 左側：時刻ラベル列 */}
            <div className="relative flex-shrink-0 w-12" style={{ height: TIMELINE_HEIGHT }}>
              {hourMarkers.map((h) => {
                const topPct = (h / 24) * 100;
                return (
                  <div
                    key={h}
                    className="absolute right-0 -translate-y-2 text-[10px] font-mono text-slate-400 select-none"
                    style={{ top: `${topPct}%` }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                );
              })}
            </div>

            {/* 右側：グリッド + ブロック */}
            <div
              className="relative flex-1 border-l border-slate-200"
              style={{ height: TIMELINE_HEIGHT }}
            >
              {/* 時間グリッド線（各時刻の横線）*/}
              {hourMarkers.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-slate-100"
                  style={{ top: `${(h / 24) * 100}%` }}
                />
              ))}

              {/* 現在時刻ライン（赤いバー）*/}
              <div
                className="absolute left-0 right-0 flex items-center z-10 pointer-events-none"
                style={{ top: `${nowTopPct}%` }}
              >
                {/* 赤いドット */}
                <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 flex-shrink-0" />
                {/* 赤いライン */}
                <div className="flex-1 border-t-2 border-rose-500" />
              </div>

              {/* 睡眠ブロック（ダークグレー）*/}
              {sleepBlocks.map((block, idx) => {
                const startMin  = toMinutes(block.start);
                const endMin    = toMinutes(block.end);
                const topPct    = (startMin / 1440) * 100;
                const heightPct = ((endMin - startMin) / 1440) * 100;
                return (
                  <div
                    key={`sleep-${idx}`}
                    className="absolute left-2 right-2 rounded-xl px-3 py-2 overflow-hidden
                               bg-slate-400 text-white"
                    style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                  >
                    <p className="text-[11px] font-bold leading-tight truncate">
                      {block.title}
                    </p>
                  </div>
                );
              })}

              {/* Google Calendar のイベント */}
              {events.map((event) => {
                const startMin  = toMinutes(event.start);
                const endMin    = toMinutes(event.end);
                const topPct    = (startMin / 1440) * 100;
                const heightPct = ((endMin - startMin) / 1440) * 100;
                const durationMin = endMin - startMin;

                // isOreHisyo=true: ブルー系、false: グレー系
                const blockClass = event.isOreHisyo
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200";

                return (
                  <div
                    key={event.id}
                    className={`absolute left-2 right-2 rounded-xl px-3 py-2 overflow-hidden cursor-default ${blockClass}`}
                    style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                    title={event.title}
                  >
                    <p className="text-[11px] font-bold leading-tight truncate">
                      {event.title}
                    </p>
                    {durationMin >= 20 && (
                      <p className="text-[10px] mt-0.5 opacity-70">
                        {event.start}〜{event.end}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 凡例（ロード完了後）*/}
      {!isLoading && !error && (
        <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-slate-200 border border-slate-300" />
            Googleカレンダー
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
            俺秘書の予定
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-rose-500" />
            現在時刻
          </span>
        </div>
      )}
    </div>
  );
}
