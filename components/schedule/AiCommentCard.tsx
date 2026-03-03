// AIからのひとことカード
import { Bot, RefreshCw } from "lucide-react";

interface AiCommentCardProps {
  comment:     string;
  onRegenerate: () => void;
  isLoading:   boolean;
}

export default function AiCommentCard({
  comment,
  onRegenerate,
  isLoading,
}: AiCommentCardProps) {
  return (
    <div className="bg-gradient-to-r from-[#0052FF]/5 to-blue-50 border border-[#0052FF]/20 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        {/* AIアイコン */}
        <div className="w-8 h-8 bg-[#0052FF] rounded-xl flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[#0052FF] uppercase tracking-widest mb-1">
            AIより
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {comment}
          </p>
        </div>

        {/* 再生成ボタン */}
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-white transition-all disabled:opacity-40"
          title="スケジュールを再生成"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
