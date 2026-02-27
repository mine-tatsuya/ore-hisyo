import type { ScheduleInput } from "@/types/schedule";
import type { Log } from "@prisma/client";
import { calcAverageAccuracy, summarizeLogPattern } from "./analyzeUserLogs";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  return format(d, "EEEE", { locale: ja });
}

function formatDateTime(d: Date): string {
  return format(d, "M/d HH:mm");
}

function formatTime(d: Date): string {
  return format(d, "HH:mm");
}

export function buildSchedulePrompt(
  input: ScheduleInput,
  logs: Log[] = []
): string {
  const { settings, tasks, freeSlots, targetDate } = input;

  const personalityGuide = {
    STRICT: "タスクをぎっしり詰めて、休憩は最小限に。締切を最優先に管理してください。",
    BALANCED: "適度な休憩を挟みながら、無理のないペースでタスクを配置してください。",
    RELAXED: "余裕を持った計画を立て、バッファ時間を多めに取ってください。",
  };

  return `
あなたはプロフェッショナルなスケジュール管理AIです。
以下の情報をもとに、${targetDate}（${getDayOfWeek(targetDate)}）の最適な1日スケジュールを生成してください。

## ユーザーの生活リズム
- 起床時間: ${settings.wakeUpTime}
- 就寝時間: ${settings.bedTime}
- 昼休憩: ${settings.lunchStart} 〜 ${settings.lunchEnd}
${settings.focusTimeStart ? `- 集中タイム: ${settings.focusTimeStart} 〜 ${settings.focusTimeEnd}` : ""}
- スケジュールスタイル: ${personalityGuide[settings.aiPersonality]}
${settings.aiCustomPrompt ? `- 追加指示: ${settings.aiCustomPrompt}` : ""}

## 未完了タスク一覧
${
  tasks.length === 0
    ? "（タスクなし）"
    : tasks
        .map(
          (t, i) => `
${i + 1}. ID: ${t.id}
   タイトル: ${t.title}
   残り所要時間: ${t.remainingMinutes}分
   優先度: ${t.priority}
   締切: ${t.deadline ? formatDateTime(t.deadline) : "なし"}
   現在の進捗: ${t.progressPct}%`
        )
        .join("")
}

## 本日の空き時間スロット（Googleカレンダーの既存予定を除いた時間）
${
  freeSlots.length === 0
    ? "（空きスロットなし）"
    : freeSlots
        .map(
          (slot) =>
            `- ${formatTime(slot.start)} 〜 ${formatTime(slot.end)}（${slot.durationMinutes}分）`
        )
        .join("\n")
}
${
  logs.length > 0
    ? `
## このユーザーの過去の見積もり傾向（参考情報）
- 平均見積もり精度: ${calcAverageAccuracy(logs)}%
  （100%を超える場合は実際の作業が見積もりより長い傾向）
- 直近のズレパターン: ${summarizeLogPattern(logs)}`
    : ""
}

## 出力形式（必ずJSONで返すこと）
以下のJSON形式で出力してください。他のテキストは一切含めないこと。

{
  "scheduleItems": [
    {
      "taskId": "タスクのID（新規イベントはnull）",
      "title": "イベントタイトル",
      "start": "HH:MM",
      "end": "HH:MM",
      "type": "TASK | BREAK | BUFFER",
      "notes": "AIからのメモ（任意）"
    }
  ],
  "summary": "今日のスケジュール全体へのコメント（100文字以内）",
  "warnings": ["注意事項があれば記載（締切が厳しいタスクなど）"]
}
  `.trim();
}
