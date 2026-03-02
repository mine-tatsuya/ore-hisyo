// タスク一覧ページ（Step 4 で本実装予定）
import { ListTodo } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="pt-2">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">タスク一覧</h2>
          <button className="flex items-center gap-1.5 bg-[#0052FF] text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + タスクを追加
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <ListTodo className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">タスクがありません</p>
          <p className="text-xs text-slate-300 mt-1">「+ タスクを追加」からタスクを登録してください</p>
        </div>
      </div>
    </div>
  );
}
