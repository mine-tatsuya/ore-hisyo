// Function Calling ツール定義とハンドラー
//
// 【Function Calling とは】
// 通常の AI 呼び出し（プロンプト → 回答）と異なり、
// AI が「もっと情報が欲しい」と判断したとき、こちらが提供したツールを呼び出せる仕組み。
//
// 流れ:
//   1. こちら → AI: プロンプト + 利用可能なツール一覧
//   2. AI → こちら: 「getWeatherForecast(date="2024-03-15") を呼んで」
//   3. こちら: 実際に気象庁APIを呼んで結果を得る
//   4. こちら → AI: ツールの実行結果
//   5. AI → こちら: 最終的なスケジュール JSON
//
// SCHEDULE_TOOL_DECLARATIONS:
//   Gemini に「こんなツールを使えるよ」と教えるための定義オブジェクト。
//   人間で言えば「仕事マニュアルのツール一覧ページ」。
//
// createToolHandlers:
//   実際にツールを実行するコード。
//   クロージャで accessToken と location を「関数の外から持ち込む」ことで、
//   Gemini から呼ばれたときに自動的に正しいトークンが使われる。

import { getEventsByRange }     from "@/lib/calendar/getEventsByRange";
import { getWeatherForecast }   from "@/lib/weather/getWeatherForecast";

// ── ツール定義（Gemini の FunctionDeclaration 形式）──
//
// type / properties / required は JSON Schema の書き方に従う。
// Gemini はこの定義をもとに「いつ・どのツールを呼ぶか」を自律的に判断する。
export const SCHEDULE_TOOL_DECLARATIONS = [
  {
    name: "getCalendarEvents",
    description: `
      指定した日付範囲の Google カレンダーのイベントをすべて取得する。
      「先週火曜日に掃除機をかけたか」「月曜日に授業があったか」など
      過去・未来の特定日付の予定を確認したい場合に使用する。
      天気に関係のない確認には必ずこちらを使うこと。
    `.trim(),
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: {
          type:        "STRING",
          description: "取得開始日 YYYY-MM-DD 形式（例: 2024-03-11）",
        },
        endDate: {
          type:        "STRING",
          description: "取得終了日 YYYY-MM-DD 形式（例: 2024-03-15）",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "getWeatherForecast",
    description: `
      指定した日付の天気予報を取得する（気象庁データ、無料・APIキー不要）。
      タスクのメモに天気に関する条件（雨・晴れ・曇りなど）が記載されている場合のみ使用する。
      天気の言及がないタスクのためには呼ばないこと。
    `.trim(),
    parameters: {
      type: "OBJECT",
      properties: {
        date: {
          type:        "STRING",
          description: "日付 YYYY-MM-DD 形式（例: 2024-03-15）",
        },
      },
      required: ["date"],
    },
  },
] as const;

// ── ツールハンドラーの型 ──
// 各ツールの引数と戻り値の型を定義する
type ToolHandlers = {
  getCalendarEvents: (args: { startDate: string; endDate: string }) => Promise<unknown>;
  getWeatherForecast: (args: { date: string }) => Promise<unknown>;
};

/**
 * ツールハンドラーを生成する（クロージャパターン）
 *
 * クロージャとは: 関数が「外側の変数（accessToken・location）」を
 * 覚えたまま返ってくるテクニック。
 * こうすることで、Gemini がツールを呼び出したとき
 * ハンドラーは自動的に「正しいユーザーのトークン」を使える。
 *
 * @param accessToken - Google OAuth アクセストークン
 * @param location    - ユーザーの居住地（例: "熊本県"）
 */
export function createToolHandlers(
  accessToken: string,
  location: string,
): ToolHandlers {
  return {
    // カレンダーイベント取得ツール
    getCalendarEvents: async ({ startDate, endDate }) => {
      console.log(`[FunctionCall] getCalendarEvents(${startDate}, ${endDate})`);
      const events = await getEventsByRange(accessToken, startDate, endDate);
      // ★ 重要: Gemini API の function_response.response は google.protobuf.Struct 型。
      // Struct はトップレベルに配列（JSON Array）を取れない。
      // 配列をそのまま渡すと "cannot start list" エラーになるため、
      // { events: [...] } というオブジェクトでラップして返す。
      return { events };
    },

    // 天気予報取得ツール
    getWeatherForecast: async ({ date }) => {
      console.log(`[FunctionCall] getWeatherForecast(${date}) location=${location}`);
      const result = await getWeatherForecast(date, location);
      if (!result) {
        // null の場合はエラーメッセージをオブジェクトで返す（AI が理解できる形）
        return {
          error: `居住地「${location}」の天気予報を取得できませんでした。` +
                 `設定画面で都道府県名を正しく設定してください。`,
        };
      }
      return result;
    },
  };
}
