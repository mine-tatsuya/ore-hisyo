// Gemini に渡すプロンプトを組み立てる関数
//
// 「AIに何を伝えるか」が出力品質を左右する最重要部分。
// タスクの期限・進捗・優先度、空き時間、過去の実績をすべて含めることで
// AIが文脈を理解したスケジューリングができる。

import type { Task, Settings, Log, RecurringTask } from "@prisma/client";
import type { FreeSlot } from "@/lib/calendar/getFreeSlots";

// recentLogs には task.title を JOIN して取得する
type LogWithTask = Log & { task: { title: string } };

// Google Calendar の時間指定イベント（ore-hisyo・終日イベント除外後）
interface TimedCalendarEvent {
  title: string;
  start: Date;
  end:   Date;
}

interface BuildPromptOptions {
  targetDate:     Date;
  tasks:          Task[];               // IN_PROGRESS のみ渡す
  recurringTasks?: RecurringTask[];     // 今日適用される定期タスク
  freeSlots:      FreeSlot[];
  settings:       Settings;
  recentLogs:     LogWithTask[];        // 過去の実績ログ（最大10件程度）
  timedEvents?:   TimedCalendarEvent[]; // Google Calendar の既存予定
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
  recurringTasks = [],
  freeSlots,
  settings,
  recentLogs,
  timedEvents = [],
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

  // ── 既存スケジュールの箇条書き ──
  //
  // 「今日の1日がどのような構造か」をAIに伝える。
  // 設定から取得した睡眠・昼休みと、Google Calendar の実際の予定を合わせて渡す。
  // （睡眠は Google Calendar には存在しないが、設定値から組み立てて渡す）

  // "HH:MM" → 分数（時刻順ソート用）
  const hhmm2min = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const existingItems: { startMin: number; line: string }[] = [];

  // 起床前の睡眠（00:00〜wakeUpTime）
  if (settings.wakeUpTime > "00:00") {
    existingItems.push({ startMin: 0, line: `  - 00:00〜${settings.wakeUpTime}: 💤 睡眠` });
  }
  // 昼休み（設定から）
  existingItems.push({
    startMin: hhmm2min(settings.lunchStart),
    line: `  - ${settings.lunchStart}〜${settings.lunchEnd}: 昼休み`,
  });
  // 就寝後の睡眠（bedTime〜24:00）※ 24:00以降設定のときは追加しない
  if (settings.bedTime < "24:00") {
    existingItems.push({
      startMin: hhmm2min(settings.bedTime),
      line: `  - ${settings.bedTime}〜24:00: 💤 睡眠`,
    });
  }
  // Google Calendar の時間指定イベント
  for (const e of timedEvents) {
    existingItems.push({
      startMin: e.start.getHours() * 60 + e.start.getMinutes(),
      line: `  - ${toHHMM(e.start)}〜${toHHMM(e.end)}: ${e.title}`,
    });
  }

  // 開始時刻順に並べる
  existingItems.sort((a, b) => a.startMin - b.startMin);

  const existingScheduleSection =
    `\n【対象日の既存スケジュール】\n` +
    `※ 以下はすでに埋まっている時間です。睡眠・昼休みは設定から、それ以外はGoogleカレンダーから取得しています\n` +
    existingItems.map((i) => i.line).join("\n") + "\n";

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

      // 残り作業時間 = 合計作業時間 × (1 - 進捗率)
      const remainingMinutes = Math.round(t.estimatedMinutes * (1 - t.progressPct / 100));

      // 期限までの残り日数
      let daysUntilDeadline: number | null = null;
      if (t.deadline) {
        const dl = new Date(t.deadline);
        dl.setHours(0, 0, 0, 0);
        const today = new Date(targetDate);
        today.setHours(0, 0, 0, 0);
        daysUntilDeadline = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      // 1日あたりの目安時間（残り日数がある場合のみ計算）
      const dailySuggestion = daysUntilDeadline !== null && daysUntilDeadline > 0
        ? Math.round(remainingMinutes / daysUntilDeadline)
        : remainingMinutes; // 今日が期限 or 期限なし → 残り全部が今日の目安

      const lines = [
        `${i + 1}. 【${t.title}】（タスクID: ${t.id}）`,
        `   - 優先度: ${priority}`,
        `   - ステータス: ${status}`,
        `   - 合計作業時間: ${t.estimatedMinutes}分（期限までの総作業量）`,
        `   - 現在の進捗: ${t.progressPct}%`,
        `   - 残り作業時間: ${remainingMinutes}分`,
        `   - 期限: ${deadlineStr}`,
        daysUntilDeadline !== null
          ? `   - 期限まで残り: ${daysUntilDeadline}日`
          : null,
        `   - 今日の推奨配分: ${dailySuggestion}分（残り${remainingMinutes}分 ÷ 残り${daysUntilDeadline ?? 1}日）`,
      ].filter(Boolean);

      if (t.description) {
        lines.push(`   - メモ: ${t.description}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  // ── 定期タスクセクション（今日適用されるもの）──
  let recurringSection = "";
  if (recurringTasks.length > 0) {
    const dayLabels = ["", "月", "火", "水", "木", "金", "土", "日"];

    // 繰り返しパターンの説明文を組み立てる
    const recurrenceDesc = (t: RecurringTask): string => {
      switch (t.recurrenceType) {
        case "DAILY":    return "毎日";
        case "WEEKLY": {
          if (!t.daysOfWeek) return "毎週";
          try {
            const days: number[] = JSON.parse(t.daysOfWeek);
            return `毎週 ${days.map((d) => dayLabels[d]).join("・")}`;
          } catch { return "毎週"; }
        }
        case "INTERVAL": return `${t.intervalDays}日ごと`;
        case "MONTHLY":  return `毎月${t.dayOfMonth}日`;
        default:         return "";
      }
    };

    // 希望時間帯の説明文
    const preferredTimeDesc = (t: RecurringTask): string => {
      if (!t.preferredTimeType) return "指定なし";
      switch (t.preferredTimeType) {
        case "MORNING":  return "朝（6:00〜10:00）";
        case "NOON":     return "昼（11:00〜14:00）";
        case "EVENING":  return "夜（18:00〜22:00）";
        case "SPECIFIC": return t.preferredStartTime ? `${t.preferredStartTime}から` : "指定なし";
        default:         return "指定なし";
      }
    };

    const recurringLines = recurringTasks
      .map((t, i) => {
        const priority = { HIGH: "高 🔴", MEDIUM: "中 🟡", LOW: "低 🟢" }[t.priority];
        const lines = [
          `${i + 1}. 【${t.title}】（タスクID: RECURRING_${t.id}）`,
          `   - 繰り返し: ${recurrenceDesc(t)}`,
          `   - 希望時間帯: ${preferredTimeDesc(t)}`,
          `   - 所要時間: ${t.estimatedMinutes}分`,
          `   - 優先度: ${priority}`,
        ];
        if (t.description) {
          lines.push(`   - メモ: ${t.description}`);
        }
        return lines.join("\n");
      })
      .join("\n\n");

    recurringSection = `
【定期タスク（今日実施分）】
※ 以下は毎日/毎週など繰り返し設定されたタスクで、今日が実施日に当たるものです
${recurringLines}
`;
  }

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
  return `あなたは個人スケジュール管理AIです。以下の情報をもとに、対象日の最適なスケジュールを提案してください。

【基本情報】
- 対象日: ${dateStr}
- 作業時間: ${settings.wakeUpTime}〜${settings.bedTime}
- 昼休み: ${settings.lunchStart}〜${settings.lunchEnd}
- AIモード: ${personalityDesc}
${focusSection ? focusSection + "\n" : ""}${customSection}
${existingScheduleSection}
【対象日の空き時間】
※ Google Calendarの既存予定を除いた、タスクを入れられる時間帯です
${freeSlotsLines}
合計空き時間: ${totalFreeMinutes}分

【対象日にやるべきタスク（進行中のみ）】
${tasksLines || "  現在スケジュール可能なタスクはありません"}
${recurringSection}${logsSection}

【スケジュール作成のルール】
- 空き時間の範囲内でのみスケジュールを組むこと（既存予定と絶対に重複させないこと）
- 集中タイムがある場合は、その時間帯に最重要タスクを入れること
- 「合計作業時間」は期限までの総作業量であり、1日で全て終わらせる必要はない。
  「今日の推奨配分」を参考に、今日スケジュールする時間を決めること
  （進捗が遅れていれば推奨より多めに、余裕があれば少なめに調整する）
- 過去の実績から所要時間が多い傾向があれば、今日の配分にも余裕を持たせること
- すべてのタスクが空き時間に収まらない場合は、期限が近くかつ進捗が遅れているタスクを優先して残りは省くこと
- タスクとタスクの間に10〜15分の余白を設けること（脳の切り替え時間）
- 定期タスクは希望時間帯を最優先にして配置すること（希望時間帯に空きがない場合のみ別の時間帯に配置する）
- 定期タスクの taskId は必ず "RECURRING_" プレフィックスを付けた形式（例: "RECURRING_abc123"）で返すこと
- 休憩はスケジュールに含めないこと（タスクとタスクの間の空白時間が休憩を兼ねる。「休憩」というイベントをschedule配列に追加してはいけない）
- 進行中のタスク（進捗あり）は、その進捗を考慮して残り時間を計算すること

【利用可能なツール】
必要があれば以下のツールを自律的に呼び出してよい:
- getCalendarEvents(startDate, endDate)
    → 指定期間の Google カレンダーのイベントを取得
    → タスクのメモに「〇〇をしたか確認して」などの条件がある場合に使う
- getWeatherForecast(date)
    → 指定日の天気予報を取得（気象庁データ・無料）
    → タスクのメモに天気の条件が書かれている場合のみ使う
    → 天気に関係のないタスクのためには呼ばないこと

【最終出力形式】
ツール呼び出しがすべて完了した後、必ず以下の JSON 形式のみを出力すること（\`\`\`や余計な説明文を含めないこと）:
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
