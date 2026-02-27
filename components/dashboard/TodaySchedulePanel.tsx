"use client";

import Link from "next/link";
import { Sparkles, CalendarCheck, Calendar } from "lucide-react";
import type { GeneratedSchedule } from "@/types/schedule";
import { ScheduleBlock } from "@/components/schedule/ScheduleBlock";

interface TodaySchedulePanelProps {
  schedule: GeneratedSchedule | null;
  loading: boolean;
  onGenerate: () => void;
  onApply: () => void;
  applying: boolean;
  applied: boolean;
}

export function TodaySchedulePanel({
  schedule,
  loading,
  onGenerate,
  onApply,
  applying,
  applied,
}: TodaySchedulePanelProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-900">今日のスケジュール</h2>
        {schedule && (
          <Link
            href="/schedule"
            className="text-[10px] font-bold text-[#0052FF] hover:underline"
          >
            詳細を見る →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : schedule ? (
        <div className="space-y-2">
          {schedule.scheduleItems.slice(0, 5).map((item, i) => (
            <ScheduleBlock key={i} item={item} />
          ))}
          {schedule.scheduleItems.length > 5 && (
            <p className="text-[10px] text-slate-400 text-center py-1">
              他 {schedule.scheduleItems.length - 5} 件...
            </p>
          )}

          {!applied && (
            <button
              onClick={onApply}
              disabled={applying}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#0052FF] border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <CalendarCheck className="w-3.5 h-3.5" strokeWidth={2} />
              {applying ? "反映中..." : "カレンダーに反映"}
            </button>
          )}
          {applied && (
            <p className="text-xs text-emerald-600 text-center py-1">
              ✓ カレンダーに反映済み
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-slate-400">
          <Calendar className="w-8 h-8 mb-2" strokeWidth={1} />
          <p className="text-xs mb-3">スケジュールが未生成です</p>
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#0052FF] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            生成する
          </button>
        </div>
      )}
    </div>
  );
}
