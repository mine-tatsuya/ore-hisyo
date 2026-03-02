// 進捗率（0〜100）を視覚的なバーで表示するコンポーネント

interface TaskProgressBarProps {
  value: number; // 0〜100
}

export default function TaskProgressBar({ value }: TaskProgressBarProps) {
  // 0〜100 の範囲に収める（念のため）
  const clampedValue = Math.min(100, Math.max(0, value));

  // 進捗率によって色を変える
  const barColor =
    clampedValue === 100
      ? "bg-emerald-500"      // 完了: 緑
      : clampedValue >= 50
      ? "bg-[#0052FF]"        // 半分以上: ブルー
      : "bg-slate-300";       // 少ない: グレー

  return (
    <div className="flex items-center gap-2">
      {/* バーのコンテナ */}
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        {/* 実際のバー（幅を % で指定） */}
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {/* パーセント表示 */}
      <span className="text-[10px] font-bold text-slate-400 tabular-nums w-7 text-right">
        {clampedValue}%
      </span>
    </div>
  );
}
