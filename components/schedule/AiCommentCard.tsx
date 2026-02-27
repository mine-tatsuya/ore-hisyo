import { Sparkles, AlertTriangle } from "lucide-react";

interface AiCommentCardProps {
  summary: string;
  warnings: string[];
}

export function AiCommentCard({ summary, warnings }: AiCommentCardProps) {
  return (
    <div className="space-y-3">
      {/* AIコメント */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-blue-800">{summary}</p>
      </div>

      {/* 警告 */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-700 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-yellow-800">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
