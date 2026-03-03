"use client";

// スケジュールのタイムライン表示
// 1日を縦軸にして2種類のブロックを重ねて表示する：
//   - Googleカレンダーの既存イベント（グレー）
//   - AIが生成したスケジュール（カラフル）

import type { ScheduleItem } from "@/app/api/schedule/generate/route";

// Google Calendar の時間指定イベント（タイムライン上にグレーで表示）
// schedule/page.tsx からもこの型を import して使う
export interface CalendarEventBlock {
  id:    string;
  title: string;
  start: string; // "HH:MM"
  end:   string; // "HH:MM"
}

interface ScheduleTimelineProps {
  schedule:        ScheduleItem[];         // AIが生成したスケジュール
  calendarEvents?: CalendarEventBlock[];   // Googleカレンダーの既存イベント
  workStart:       string; // "00:00"（タイムラインの開始時刻）
  workEnd:         string; // "24:00"（タイムラインの終了時刻）
  date:            string; // "2024-03-15"（カレンダー適用ボタン用）
  onApply:         (schedule: ScheduleItem[]) => void;
  isApplying:      boolean;
  isApplied:       boolean;
}

// "HH:MM" → 分数に変換
// 例: "09:30" → 570, "24:00" → 1440
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// AIスケジュールブロックの色（インデックスでローテーション）
const BLOCK_COLORS = [
  { bg: "bg-[#0052FF]",   text: "text-white",     },
  { bg: "bg-violet-500",  text: "text-white",     },
  { bg: "bg-emerald-500", text: "text-white",     },
  { bg: "bg-amber-400",   text: "text-amber-900", },
  { bg: "bg-rose-500",    text: "text-white",     },
];

export default function ScheduleTimeline({
  schedule,
  calendarEvents = [],
  workStart,
  workEnd,
  date,
  onApply,
  isApplying,
  isApplied,
}: ScheduleTimelineProps) {
  const workStartMin = toMinutes(workStart); // 00:00 → 0
  const workEndMin   = toMinutes(workEnd);   // 24:00 → 1440
  const totalMinutes = workEndMin - workStartMin;

  // 時間マーカーを1時間ごとに生成（0, 1, 2, ..., 24）
  const startHour = Math.ceil(workStartMin / 60);
  const endHour   = Math.floor(workEndMin  / 60);
  const hourMarkers: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hourMarkers.push(h);
  }

  // タイムライン全体の高さ: 24h × 42px = 1008px
  const PX_PER_HOUR    = 42;
  const timelineHeight = (totalMinutes / 60) * PX_PER_HOUR;

  return (
    <div className="space-y-4">

      {/* カレンダー適用ボタン（AIスケジュールが生成されている場合のみ表示）*/}
      {schedule.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {schedule.length} 件のタスクをスケジュール
          </p>
          <button
            onClick={() => onApply(schedule)}
            disabled={isApplying || isApplied}
            className={`
              flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl
              transition-all duration-150
              ${isApplied
                ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                : "bg-[#0052FF] text-white hover:bg-blue-700 disabled:opacity-50"
              }
            `}
          >
            {isApplied   ? "✓ カレンダーに追加済み" :
             isApplying  ? "追加中..."              :
                           "📅 Googleカレンダーに追加"}
          </button>
        </div>
      )}

      {/* 凡例（カレンダーイベントが1件以上あるときのみ表示）*/}
      {calendarEvents.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-slate-200" />
            Googleカレンダーの予定
          </span>
          {schedule.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-[#0052FF]" />
              AIが提案したスケジュール
            </span>
          )}
        </div>
      )}

      {/* タイムライン本体 */}
      <div className="flex gap-3">

        {/* 左側：時刻ラベル列 */}
        <div
          className="relative flex-shrink-0 w-12"
          style={{ height: timelineHeight }}
        >
          {hourMarkers.map((h) => {
            const topPct = ((h * 60 - workStartMin) / totalMinutes) * 100;
            return (
              <div
                key={h}
                className="absolute right-0 -translate-y-2 text-[10px] font-mono text-slate-400"
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
          style={{ height: timelineHeight }}
        >
          {/* 時間グリッド線 */}
          {hourMarkers.map((h) => {
            const topPct = ((h * 60 - workStartMin) / totalMinutes) * 100;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: `${topPct}%` }}
              />
            );
          })}

          {/* ── Googleカレンダーの既存イベント（グレーブロック）── */}
          {calendarEvents.map((event) => {
            const eventStartMin = toMinutes(event.start);
            const eventEndMin   = toMinutes(event.end);

            // タイムライン範囲外のイベントはスキップ
            if (eventEndMin <= workStartMin || eventStartMin >= workEndMin) return null;

            const topPct      = ((eventStartMin - workStartMin) / totalMinutes) * 100;
            const heightPct   = ((eventEndMin   - eventStartMin) / totalMinutes) * 100;
            const durationMin = eventEndMin - eventStartMin;

            return (
              <div
                key={event.id}
                className="absolute left-2 right-2 rounded-xl px-3 py-2 overflow-hidden
                           bg-slate-100 text-slate-600 border border-slate-200 cursor-default"
                style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                title={event.title}
              >
                <p className="text-[11px] font-bold leading-tight truncate">
                  {event.title}
                </p>
                {durationMin >= 20 && (
                  <p className="text-[10px] mt-0.5 opacity-70">
                    {event.start}〜{event.end}（{durationMin}分）
                  </p>
                )}
              </div>
            );
          })}

          {/* ── AIが生成したスケジュールブロック ── */}
          {schedule.map((item, idx) => {
            const itemStartMin = toMinutes(item.start);
            const itemEndMin   = toMinutes(item.end);
            const topPct       = ((itemStartMin - workStartMin) / totalMinutes) * 100;
            const heightPct    = ((itemEndMin   - itemStartMin) / totalMinutes) * 100;
            const color        = BLOCK_COLORS[idx % BLOCK_COLORS.length];
            const durationMin  = itemEndMin - itemStartMin;

            return (
              <div
                key={`${item.taskId}-${item.start}`}
                className={`
                  absolute left-2 right-2 rounded-xl px-3 py-2 overflow-hidden
                  ${color.bg} ${color.text}
                  shadow-sm transition-all hover:shadow-md hover:scale-[1.01]
                  cursor-default
                `}
                style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                title={item.note}
              >
                <p className="text-[11px] font-bold leading-tight truncate">
                  {item.title}
                </p>
                <p className="text-[10px] mt-0.5 opacity-80">
                  {item.start}〜{item.end}（{durationMin}分）
                </p>
                {durationMin >= 45 && (
                  <p className="text-[10px] mt-1 opacity-70 line-clamp-2 leading-relaxed">
                    {item.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
