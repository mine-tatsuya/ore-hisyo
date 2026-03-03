"use client";

// スケジュールのタイムライン表示
//
// 責任: グリッドの描画・ブロックの配置のみ
// ドラッグロジック → useDragSchedule.ts
// ドラッグ可能なブロックの見た目 → DraggableBlock.tsx

import type { ScheduleItem } from "@/app/api/schedule/generate/route";
import { useDragSchedule } from "./useDragSchedule";
import DraggableBlock from "./DraggableBlock";

// Google Calendar の時間指定イベント（グレーで表示、ドラッグ不可）
export interface CalendarEventBlock {
  id:          string;
  title:       string;
  start:       string;  // "HH:MM"
  end:         string;  // "HH:MM"
  isOreHisyo?: boolean;
}

interface ScheduleTimelineProps {
  schedule:         ScheduleItem[];
  calendarEvents?:  CalendarEventBlock[];
  workStart:        string; // "00:00"
  workEnd:          string; // "24:00"
  date:             string;
  onApply:          (schedule: ScheduleItem[]) => void;
  onScheduleChange?: (schedule: ScheduleItem[]) => void;
  isApplying:       boolean;
  isApplied:        boolean;
  // AI生成済みかどうか（true のときだけ「カレンダーに追加」ボタンを表示）
  hasAiSchedule?:   boolean;
}

// "HH:MM" → 分数
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// AIブロックの色（インデックスでローテーション）
const BLOCK_COLORS = [
  { bg: "bg-[#0052FF]",   text: "text-white"     },
  { bg: "bg-violet-500",  text: "text-white"     },
  { bg: "bg-emerald-500", text: "text-white"     },
  { bg: "bg-amber-400",   text: "text-amber-900" },
  { bg: "bg-rose-500",    text: "text-white"     },
];

export default function ScheduleTimeline({
  schedule,
  calendarEvents = [],
  workStart,
  workEnd,
  date,
  onApply,
  onScheduleChange,
  isApplying,
  isApplied,
  hasAiSchedule = false,
}: ScheduleTimelineProps) {
  const workStartMin = toMinutes(workStart); // 0
  const workEndMin   = toMinutes(workEnd);   // 1440
  const totalMinutes = workEndMin - workStartMin;

  // ドラッグロジックをカスタムフックに委譲
  const { localSchedule, containerRef, isDragging, handleDragStart, selectedIdx, handleDelete } = useDragSchedule({
    schedule,
    workStartMin,
    workEndMin,
    totalMinutes,
    onScheduleChange,
  });

  // 時間マーカー（0, 1, 2, ..., 24）
  const startHour = Math.ceil(workStartMin / 60);
  const endHour   = Math.floor(workEndMin  / 60);
  const hourMarkers: number[] = [];
  for (let h = startHour; h <= endHour; h++) hourMarkers.push(h);

  // タイムライン高さ: 24h × 42px = 1008px
  const PX_PER_HOUR    = 42;
  const timelineHeight = (totalMinutes / 60) * PX_PER_HOUR;

  return (
    <div className="space-y-4">

      {/* カレンダー追加ボタン（AI生成後のみ表示）*/}
      {hasAiSchedule && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {localSchedule.length} 件のタスクをスケジュール
          </p>
          <button
            onClick={() => onApply(localSchedule)}
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
            {isApplied  ? "✓ カレンダーに追加済み" :
             isApplying ? "追加中..."              :
                          "📅 Googleカレンダーに追加"}
          </button>
        </div>
      )}

      {/* 凡例 */}
      {calendarEvents.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-slate-200" />
            Googleカレンダーの予定
          </span>
          {localSchedule.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-[#0052FF]" />
              AIが提案したスケジュール（ドラッグで調整可）
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
        {/* containerRef をここに付けることで useDragSchedule がコンテナ高さを取得できる */}
        <div
          ref={containerRef}
          className={`relative flex-1 border-l border-slate-200 ${isDragging ? "cursor-grabbing" : ""}`}
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

          {/* Googleカレンダーの既存イベント（グレー・ドラッグ不可）*/}
          {calendarEvents.map((event) => {
            const eventStartMin = toMinutes(event.start);
            const eventEndMin   = toMinutes(event.end);
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
                <p className="text-[11px] font-bold leading-tight truncate">{event.title}</p>
                {durationMin >= 20 && (
                  <p className="text-[10px] mt-0.5 opacity-70">
                    {event.start}〜{event.end}（{durationMin}分）
                  </p>
                )}
              </div>
            );
          })}

          {/* AIが生成したスケジュールブロック（カラフル・ドラッグ可能）*/}
          {localSchedule.map((item, idx) => {
            const itemStartMin = toMinutes(item.start);
            const itemEndMin   = toMinutes(item.end);
            const topPct       = ((itemStartMin - workStartMin) / totalMinutes) * 100;
            const heightPct    = ((itemEndMin   - itemStartMin) / totalMinutes) * 100;
            // 追加済みなら全ブロックを薄灰色に統一（「適用完了」を視覚的に示す）
            // 未適用なら: 睡眠ブロック=中間グレー、それ以外=カラーローテーション
            const color = isApplied
              ? { bg: "bg-slate-200", text: "text-slate-400" }
              : item.taskId === "SLEEP_BLOCK"
                ? { bg: "bg-slate-400", text: "text-white" }
                : BLOCK_COLORS[idx % BLOCK_COLORS.length];

            return (
              <DraggableBlock
                key={`${item.taskId}-${idx}`}
                item={item}
                idx={idx}
                topPct={topPct}
                heightPct={heightPct}
                color={color}
                isDragging={isDragging}
                isSelected={selectedIdx === idx}
                isApplied={isApplied}
                onDragStart={handleDragStart}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
