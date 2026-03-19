// Function Calling ツール定義とハンドラー
//
// 【Function Calling とは】
// 通常の AI 呼び出し（プロンプト → 回答）と異なり、
// AI が「もっと情報が欲しい」と判断したとき、こちらが提供したツールを呼び出せる仕組み。
//
// 流れ:
//   1. こちら → AI: プロンプト + 利用可能なツール一覧
//   2. AI → こちら: 「getWeatherForecast(dates=["2024-03-15"]) を呼んで」
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
      タスクのメモに「〇〇したか確認して」「〇〇があったか調べて」など、
      過去または未来の特定期間の予定を確認したい場合にのみ使用する。
      このツールは会話全体で1回だけ呼び出すこと。
      複数の期間を確認したい場合は startDate と endDate をまとめて広く指定すること。
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
      複数日付の天気予報をまとめて取得する（1回のAPIで複数日対応）。
      タスクのメモに「雨なら〇〇する」「晴れの日に〇〇したい」など、
      天気が判断に影響する場合にのみ使用する。
      天気に関する記述が一切ないタスクのためには呼ばないこと。
      このツールは会話全体で1回だけ呼び出すこと。
      複数の日付が必要な場合は dates 配列にまとめて指定すること。
    `.trim(),
    parameters: {
      type: "OBJECT",
      properties: {
        dates: {
          type:        "ARRAY",
          items:       { type: "STRING" },
          description: "天気予報を取得する日付の配列（YYYY-MM-DD形式）。例: [\"2026-03-20\", \"2026-03-21\"]",
        },
      },
      required: ["dates"],
    },
  },
] as const;

// ── ツールハンドラーの型 ──
// 各ツールの引数と戻り値の型を定義する
type ToolHandlers = {
  getCalendarEvents: (args: { startDate: string; endDate: string }) => Promise<unknown>;
  getWeatherForecast: (args: { dates: string[] }) => Promise<unknown>;
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

    // 天気予報取得ツール（複数日付まとめて取得）
    getWeatherForecast: async ({ dates }) => {
      console.log(`[FunctionCall] getWeatherForecast([${dates.join(", ")}]) location=${location}`);

      if (!location) {
        return {
          error: "居住地が設定されていません。設定画面で都道府県を選択してください。",
        };
      }

      const forecasts = await getWeatherForecast(dates, location);

      if (forecasts.length === 0) {
        return {
          error: `「${location}」の天気予報を取得できませんでした。指定した日付が3日以上先の可能性があります。`,
        };
      }

      // Struct のトップレベルに配列を渡せないため { forecasts: [...] } でラップ
      return { forecasts };
    },
  };
}
