"use client";

// AIが生成したスケジュールブロック（1件分）
//
// 責任: 見た目の描画 + ドラッグ開始イベントの検知
// ドラッグ中の計算は useDragSchedule.ts に委譲する

import type { ScheduleItem } from "@/app/api/schedule/generate/route";
import type { DragMode } from "./useDragSchedule";

interface DraggableBlockProps {
  item:        ScheduleItem;
  idx:         number;
  topPct:      number;   // タイムライン上端からの位置（%）
  heightPct:   number;   // ブロックの高さ（%）
  color:       { bg: string; text: string };
  isDragging:  boolean;  // 何かドラッグ中かどうか（カーソル制御に使用）
  isSelected:  boolean;  // このブロックが選択中かどうか
  isApplied:   boolean;  // カレンダー追加済み → インタラクションを無効化
  onDragStart: (mode: DragMode, idx: number, clientY: number) => void;
  onDelete:    (idx: number) => void;
}

export default function DraggableBlock({
  item,
  idx,
  topPct,
  heightPct,
  color,
  isDragging,
  isSelected,
  isApplied,
  onDragStart,
  onDelete,
}: DraggableBlockProps) {
  // 所要時間を計算（表示用）
  const [sh, sm] = item.start.split(":").map(Number);
  const [eh, em] = item.end.split(":").map(Number);
  const durationMin = (eh * 60 + em) - (sh * 60 + sm);

  return (
    <div
      className={`
        absolute left-2 right-2 rounded-xl overflow-visible
        ${color.bg} ${color.text}
        shadow-sm select-none
        ${isDragging  ? "shadow-lg opacity-95" : "hover:shadow-md"}
        ${isSelected  ? "ring-2 ring-white ring-offset-1 shadow-lg" : ""}
      `}
      style={{ top: `${topPct}%`, height: `${heightPct}%` }}
      title={item.note}
    >
      {/* ✕ 削除ボタン（選択中 かつ 未適用のみ表示）*/}
      {!isApplied && isSelected && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full
                     flex items-center justify-center z-20 shadow-md text-[10px] font-bold
                     hover:bg-rose-600 transition-colors"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(idx);
          }}
        >
          ✕
        </button>
      )}

      {/* ── 上端リサイズハンドル（未適用のみ表示）── */}
      {!isApplied && (
        <div
          className="absolute top-0 left-0 right-0 h-3 cursor-n-resize z-10
                     flex items-start justify-center pt-1"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStart("top", idx, e.clientY);
          }}
        >
          <div className="w-8 h-0.5 bg-white/50 rounded-full" />
        </div>
      )}

      {/* ── ブロック本体 ── */}
      {/* 未適用: grab カーソル + ドラッグ開始 / 適用済み: default カーソル + 操作なし */}
      <div
        className={`
          w-full h-full px-3 pt-4 pb-4
          ${isApplied ? "cursor-default" : isDragging ? "cursor-grabbing" : "cursor-grab"}
        `}
        onPointerDown={isApplied ? undefined : (e) => {
          e.preventDefault();
          onDragStart("move", idx, e.clientY);
        }}
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

      {/* ── 下端リサイズハンドル（未適用のみ表示）── */}
      {!isApplied && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize z-10
                     flex items-end justify-center pb-1"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStart("bottom", idx, e.clientY);
          }}
        >
          <div className="w-8 h-0.5 bg-white/50 rounded-full" />
        </div>
      )}
    </div>
  );
}
