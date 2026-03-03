"use client";

// 日付選択カレンダーポップアップ

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface DatePickerCalendarProps {
  selectedDate: Date;
  onSelect:     (date: Date) => void;
  onClose:      () => void;
}

export default function DatePickerCalendar({
  selectedDate,
  onSelect,
  onClose,
}: DatePickerCalendarProps) {
  const [viewYear,  setViewYear]  = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  // カレンダーポップアップ自身への参照（外側クリック検知に使う）
  const calendarRef = useRef<HTMLDivElement>(null);

  // ── 外側クリックで閉じる ──
  // fixed オーバーレイの代わりに document レベルでクリックを監視する。
  // 理由: backdrop-filter を持つ親要素は fixed の含有ブロックになるため、
  //       fixed 要素が親要素の範囲内にしか表示されない場合がある。
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // クリックした場所がカレンダーの外なら閉じる
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // mousedown は click より先に発火するので操作感が良い
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // ── カレンダーグリッドの計算 ──
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSelectedDay = (date: Date | null) =>
    date !== null && date.toDateString() === selectedDate.toDateString();

  const isTodayDay = (date: Date | null) =>
    date !== null && date.toDateString() === today.toDateString();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleSelect = (date: Date) => {
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    onSelect(selected);
    onClose();
  };

  return (
    // カレンダー本体（absolute で日付ボタン直下に配置）
    // onMouseDown の stopPropagation で document リスナーに「内側クリック」を伝えない
    <div
      ref={calendarRef}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20
                 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 w-72"
    >
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-slate-700">
          {viewYear}年{viewMonth + 1}月
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[10px] font-medium py-1
              ${i === 0 ? "text-rose-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;

          const selected = isSelectedDay(date);
          const isToday  = isTodayDay(date);
          const isSun    = date.getDay() === 0;
          const isSat    = date.getDay() === 6;

          return (
            <button
              key={date.toISOString()}
              onClick={() => handleSelect(date)}
              className={`
                w-8 h-8 mx-auto flex items-center justify-center
                text-[12px] rounded-full transition-colors
                ${selected  ? "bg-[#0052FF] text-white font-bold"      :
                  isToday   ? "bg-blue-50 text-[#0052FF] font-bold"    :
                              "hover:bg-slate-100 text-slate-700"       }
                ${!selected && isSun ? "text-rose-500"  : ""}
                ${!selected && isSat ? "text-blue-500" : ""}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* 今日に移動ボタン */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => handleSelect(new Date())}
          className="w-full text-[11px] text-[#0052FF] hover:bg-blue-50
                     py-1.5 rounded-lg transition-colors font-medium"
        >
          今日に移動
        </button>
      </div>
    </div>
  );
}
