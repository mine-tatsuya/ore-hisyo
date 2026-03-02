// ダッシュボードページ
// "use client" なし = サーバーコンポーネント（データ取得はここで行う予定）

import { Sparkles, ListTodo } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-4 pt-2">

      {/* ========== サマリーカード（3列グリッド）========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* カード共通スタイル: bg-white/80 backdrop-blur-xl = ガラスカード */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            未着手タスク
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
          <p className="text-xs text-slate-400 mt-1">件</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            進行中
          </p>
          <p className="text-3xl font-bold text-[#0052FF] mt-2">0</p>
          <p className="text-xs text-slate-400 mt-1">件</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            完了（今日）
          </p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">0</p>
          <p className="text-xs text-slate-400 mt-1">件</p>
        </div>
      </div>

      {/* ========== 今日のスケジュール ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">今日のスケジュール</h2>
          <button className="flex items-center gap-1.5 bg-[#0052FF] text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            スケジュール生成
          </button>
        </div>

        {/* 空状態（スケジュールがない場合） */}
        <div className="flex flex-col items-center justify-center py-12 text-slate-300">
          <Sparkles className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">
            スケジュールはまだ生成されていません
          </p>
          <p className="text-xs text-slate-300 mt-1">
            「スケジュール生成」ボタンを押して始めましょう
          </p>
        </div>
      </div>

      {/* ========== タスク一覧（直近） ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">タスク</h2>
          <button className="text-xs text-[#0052FF] hover:underline">
            すべて見る →
          </button>
        </div>

        {/* 空状態 */}
        <div className="flex flex-col items-center justify-center py-10 text-slate-300">
          <ListTodo className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">
            タスクがありません
          </p>
          <p className="text-xs text-slate-300 mt-1">
            タスク一覧から追加できます
          </p>
        </div>
      </div>
    </div>
  );
}
