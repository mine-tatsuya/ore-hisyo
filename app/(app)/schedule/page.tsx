// スケジュールページ（Step 5 で本実装予定）
import { CalendarDays, Sparkles } from "lucide-react";

export default function SchedulePage() {
  return (
    <div className="pt-2">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">スケジュール生成</h2>
          <button className="flex items-center gap-1.5 bg-[#0052FF] text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            生成する
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <CalendarDays className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">スケジュールを生成してください</p>
          <p className="text-xs text-slate-300 mt-1">Gemini AI がタスクと空き時間から最適なスケジュールを作ります</p>
        </div>
      </div>
    </div>
  );
}
