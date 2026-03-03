// ドラッグ・リサイズのロジックをまとめたカスタムフック
//
// 責任: 「いつ・どのくらい動かしたか」を計算してスケジュールを更新するだけ
// 見た目には関与しない（それは DraggableBlock.tsx と ScheduleTimeline.tsx の仕事）

import { useState, useEffect, useRef, useCallback } from "react";
import type { ScheduleItem } from "@/app/api/schedule/generate/route";

// ドラッグの種類
// "move"   = ブロック本体をつかんで移動
// "top"    = 上端ハンドルをドラッグして開始時刻を変更
// "bottom" = 下端ハンドルをドラッグして終了時刻を変更
export type DragMode = "move" | "top" | "bottom";

// ドラッグ開始時に記録する情報
type DragState = {
  mode:             DragMode;
  itemIndex:        number;
  startClientY:     number; // ドラッグ開始時のマウスY座標
  originalStartMin: number; // ドラッグ開始時のタスク開始時刻（分）
  originalEndMin:   number; // ドラッグ開始時のタスク終了時刻（分）
};

// ── ユーティリティ関数 ──

// "HH:MM" → 分数 （例: "09:30" → 570）
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// 分数 → "HH:MM" （例: 570 → "09:30"）
function toHHMM(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 15分単位にスナップ（例: 572 → 570, 577 → 570, 578 → 585）
function snapTo15(mins: number): number {
  return Math.round(mins / 15) * 15;
}

// 指定範囲内にクランプ（例: clamp(150, 0, 100) → 100）
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── フック本体 ──

export function useDragSchedule({
  schedule,
  workStartMin,
  workEndMin,
  totalMinutes,
  onScheduleChange,
}: {
  schedule:          ScheduleItem[];
  workStartMin:      number;
  workEndMin:        number;
  totalMinutes:      number;
  onScheduleChange?: (schedule: ScheduleItem[]) => void;
}) {
  // 編集中のスケジュール（ドラッグで変わっていく）
  const [localSchedule, setLocalSchedule] = useState<ScheduleItem[]>(schedule);

  // ドラッグ終了時に「最新のスケジュール」を確実に参照するための ref
  // ※ useState は非同期なので、イベントリスナー内から直接参照できない
  const localScheduleRef = useRef<ScheduleItem[]>(schedule);

  // 親の onScheduleChange が毎レンダーで変わっても問題ないように ref で保持
  const onScheduleChangeRef = useRef(onScheduleChange);
  useEffect(() => {
    onScheduleChangeRef.current = onScheduleChange;
  }, [onScheduleChange]);

  // 選択中のブロックのインデックス（null = 未選択）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // AIが新しいスケジュールを生成したら編集状態・選択状態をリセット
  useEffect(() => {
    localScheduleRef.current = schedule;
    setLocalSchedule(schedule);
    setSelectedIdx(null);
  }, [schedule]);

  // ドラッグ中の状態（再レンダー不要なので useRef で管理）
  const dragState = useRef<DragState | null>(null);

  // ドラッグ中かどうか（カーソルのスタイルを変えるために useState で管理）
  const [isDragging, setIsDragging] = useState(false);

  // タイムラインコンテナへの参照（高さを取得してpx→分変換に使う）
  const containerRef = useRef<HTMLDivElement>(null);

  // state と ref を同時に更新するヘルパー
  // （ref は即時更新、state は React のスケジュールに従い更新）
  const updateLocalSchedule = useCallback(
    (updater: (prev: ScheduleItem[]) => ScheduleItem[]) => {
      setLocalSchedule((prev) => {
        const next = updater(prev);
        localScheduleRef.current = next; // ref を即時同期
        return next;
      });
    },
    []
  );

  // ドラッグ開始（DraggableBlock から呼ばれる）
  const handleDragStart = useCallback(
    (mode: DragMode, itemIndex: number, clientY: number) => {
      const item = localScheduleRef.current[itemIndex];
      dragState.current = {
        mode,
        itemIndex,
        startClientY:     clientY,
        originalStartMin: toMinutes(item.start),
        originalEndMin:   toMinutes(item.end),
      };
      setIsDragging(true);
    },
    []
  );

  // document レベルでポインターイベントを監視
  // ブロックの外に出てもドラッグが追従するよう、コンテナではなく document に登録する
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState.current || !containerRef.current) return;

      const {
        mode,
        itemIndex,
        startClientY,
        originalStartMin,
        originalEndMin,
      } = dragState.current;

      // ── ピクセル差分 → 分数差分 に変換 ──
      // コンテナの高さ全体が totalMinutes 分に相当する
      const containerHeight = containerRef.current.getBoundingClientRect().height;
      const dy       = e.clientY - startClientY;
      const deltaMin = (dy / containerHeight) * totalMinutes;
      const duration = originalEndMin - originalStartMin;

      updateLocalSchedule((prev) =>
        prev.map((item, i) => {
          if (i !== itemIndex) return item; // 対象外のブロックはそのまま

          let newStartMin: number;
          let newEndMin:   number;

          if (mode === "move") {
            // 移動: 長さを保ったまま全体をスライド
            newStartMin = snapTo15(clamp(originalStartMin + deltaMin, workStartMin, workEndMin - duration));
            newEndMin   = newStartMin + duration;
          } else if (mode === "bottom") {
            // 下端リサイズ: 終了時刻だけ変更（最短15分を保証）
            newStartMin = originalStartMin;
            newEndMin   = snapTo15(clamp(originalEndMin + deltaMin, originalStartMin + 15, workEndMin));
          } else {
            // 上端リサイズ: 開始時刻だけ変更（最短15分を保証）
            newStartMin = snapTo15(clamp(originalStartMin + deltaMin, workStartMin, originalEndMin - 15));
            newEndMin   = originalEndMin;
          }

          return { ...item, start: toHHMM(newStartMin), end: toHHMM(newEndMin) };
        })
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragState.current) return;
      const { startClientY, itemIndex, mode } = dragState.current;
      dragState.current = null;
      setIsDragging(false);

      // ── タップ判定（縦移動 5px 未満 かつ move モード）──
      // ドラッグせずに離した場合はブロックの選択・選択解除として扱う。
      // top/bottom リサイズハンドルのタップは選択に使わない。
      const moved = Math.abs(e.clientY - startClientY) > 5;
      if (!moved && mode === "move") {
        setSelectedIdx((prev) => (prev === itemIndex ? null : itemIndex));
      } else {
        // ドラッグ完了を親に通知
        onScheduleChangeRef.current?.(localScheduleRef.current);
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup",   handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup",   handlePointerUp);
    };
  }, [totalMinutes, workStartMin, workEndMin, updateLocalSchedule]);

  // ブロック削除（選択中のブロックを localSchedule から取り除く）
  const handleDelete = useCallback(
    (idx: number) => {
      updateLocalSchedule((prev) => prev.filter((_, i) => i !== idx));
      setSelectedIdx(null);
    },
    [updateLocalSchedule]
  );

  return { localSchedule, containerRef, isDragging, handleDragStart, selectedIdx, handleDelete };
}
