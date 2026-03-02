// 設定ページ（Step 4 で本実装予定）
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="pt-2">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <h2 className="text-sm font-bold text-slate-800 mb-5">設定</h2>
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <Settings className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">設定画面は準備中です</p>
        </div>
      </div>
    </div>
  );
}
