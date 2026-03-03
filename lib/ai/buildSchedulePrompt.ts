// Gemini に渡すプロンプトを組み立てる関数
//
// 「AIに何を伝えるか」が出力品質を左右する最重要部分。
// タスクの期限・進捗・優先度、空き時間、過去の実績をすべて含めることで
// AIが文脈を理解したスケジューリングができる。

import type { Task, Settings, Log } from "@prisma/client";
import type { FreeSlot } from "@/lib/calendar/getFreeSlots";

// recentLogs には task.title を JOIN して取得する
type LogWithTask = Log & { task: { title: string } };

interface BuildPromptOptions {
  targetDate:  Date;
  tasks:       Task[];        // PENDING + IN_PROGRESS のみ渡す
  freeSlots:   FreeSlot[];
  settings:    Settings;
  recentLogs:  LogWithTask[]; // 過去の実績ログ（最大10件程度）
}

/**
 * Date オブジェクトを "HH:MM" 形式の文字列に変換する
 */
function toHHMM(date: Date): string {
  return date.toLocaleTimeString("ja-JP", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Gemini に渡すスケジューリングプロンプトを生成する
 */
export function buildSchedulePrompt({
  targetDate,
  tasks,
  freeSlots,
  settings,
  recentLogs,
}: BuildPromptOptions): string {

  // ── 今日の日付（曜日付き日本語形式）──
  const dateStr = targetDate.toLocaleDateString("ja-JP", {
    year:    "numeric",
    month:   "long",
    day:     "numeric",
    weekday: "long",
  });

  // ── AIモードの説明文 ──
  const personalityDesc = {
    STRICT:   "厳しめ（締切を最優先、隙間なくスケジューリング）",
    BALANCED: "バランス型（無理なく計画的に、休憩も確保）",
    RELAXED:  "ゆったり（余裕を持たせ、穏やかに進める）",
  }[settings.aiPersonality];

  // ── 集中タイムの説明（設定されている場合のみ）──
  const focusSection =
    settings.focusTimeStart && settings.focusTimeEnd
      ? `- 集中タイム: ${settings.focusTimeStart}〜${settings.focusTimeEnd}` +
        `（この時間帯に優先度「高」のタスクを配置すること）`
      : null;

  // ── 追加指示（設定されている場合のみ）──
  const customSection = settings.aiCustomPrompt
    ? `\n【ユーザーからの追加指示】\n${settings.aiCustomPrompt}`
    : "";

  // ── 空き時間の箇条書き ──
  const totalFreeMinutes = Math.round(
    freeSlots.reduce((sum, s) => sum + s.durationMinutes, 0)
  );
  const freeSlotsLines = freeSlots
    .map((s) => `  - ${toHHMM(s.start)}〜${toHHMM(s.end)}（${Math.round(s.durationMinutes)}分）`)
    .join("\n");

  // ── タスク一覧の箇条書き（詳細情報を全て含める）──
  const tasksLines = tasks
    .map((t, i) => {
      const priority = { HIGH: "高 🔴", MEDIUM: "中 🟡", LOW: "低 🟢" }[t.priority];
      const status   = t.status === "PENDING" ? "未着手" : "進行中";

      // 期限の表示（期限あり・なし、今日以降かどうか）
      let deadlineStr = "なし";
      if (t.deadline) {
        const dl = new Date(t.deadline);
        deadlineStr = dl.toLocaleDateString("ja-JP", {
          month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
        // 今日が期限の場合は強調
        const isToday = dl.toDateString() === targetDate.toDateString();
        if (isToday) deadlineStr += " ⚠️ 今日が期限！";
      }

      const lines = [
        `${i + 1}. 【${t.title}】（タスクID: ${t.id}）`,
        `   - 優先度: ${priority}`,
        `   - ステータス: ${status}`,
        `   - 推定所要時間: ${t.estimatedMinutes}分`,
        `   - 現在の進捗: ${t.progressPct}%`,
        `   - 期限: ${deadlineStr}`,
      ];

      if (t.description) {
        lines.push(`   - メモ: ${t.description}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  // ── 過去の実績ログ（あれば）──
  let logsSection = "";
  if (recentLogs.length > 0) {
    const logLines = recentLogs.map((log) => {
      const dateLabel = new Date(log.createdAt).toLocaleDateString("ja-JP", {
        month: "long", day: "numeric",
      });
      const actual = log.actualMinutes != null ? `${log.actualMinutes}分` : "未記録";
      const ratio  = log.accuracyRatio != null
        ? `（実績÷計画 = ${log.accuracyRatio.toFixed(2)}倍${
            log.accuracyRatio > 1.2 ? " → 予想より時間がかかる傾向" :
            log.accuracyRatio < 0.8 ? " → 予想より早く終わる傾向" : " → ほぼ予定通り"
          }）`
        : "";
      return `  - ${dateLabel}: 「${log.task.title}」計画${log.plannedMinutes}分 → 実績${actual}${ratio}`;
    });

    logsSection = `
【過去の作業実績ログ（直近）】
※ この傾向をスケジューリングに活かしてください
${logLines.join("\n")}`;
  }

  // ── プロンプト本文 ──
  return `あなたは個人スケジュール管理AIです。以下の情報をもとに、今日の最適なスケジュールを提案してください。

【基本情報】
- 今日の日付: ${dateStr}
- 作業時間: ${settings.wakeUpTime}〜${settings.bedTime}
- 昼休み: ${settings.lunchStart}〜${settings.lunchEnd}
- AIモード: ${personalityDesc}
${focusSection ? focusSection + "\n" : ""}${customSection}

【今日の空き時間】
※ Google Calendarの既存予定を除いた、タスクを入れられる時間帯です
${freeSlotsLines}
合計空き時間: ${totalFreeMinutes}分

【今日やるべきタスク（未着手・進行中のみ）】
${tasksLines || "  現在スケジュール可能なタスクはありません"}
${logsSection}

【スケジュール作成のルール】
- 空き時間の範囲内でのみスケジュールを組むこと（既存予定と絶対に重複させないこと）
- 優先度「高」と期限が今日のタスクを最優先で早い時間に配置すること
- 集中タイムがある場合は、その時間帯に最重要タスクを入れること
- 過去の実績から所要時間が多い傾向があれば、推定時間より余裕を持たせること
- すべてのタスクが空き時間に収まらない場合は、優先度順に選んで残りは省くこと
- タスクとタスクの間に10〜15分の余白を設けること（脳の切り替え時間）
- 進行中のタスク（進捗あり）は、その進捗を考慮して残り時間を計算すること

以下のJSON形式のみで返答してください（余計な説明文や\`\`\`は含めないこと）:
{
  "schedule": [
    {
      "taskId": "上記タスクのIDをそのまま使用",
      "title": "タスク名",
      "start": "HH:MM",
      "end": "HH:MM",
      "note": "この時間に配置した理由（1〜2文、日本語）"
    }
  ],
  "comment": "今日のスケジュール全体についてのアドバイスや励ましのメッセージ（2〜3文、日本語、フレンドリーに）"
}`;
}
