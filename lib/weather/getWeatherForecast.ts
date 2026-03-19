// 気象庁API ラッパー
//
// 気象庁の無料天気予報API（APIキー不要）を使って指定日の天気を取得する。
//
// API URL: https://www.jma.go.jp/bosai/forecast/data/forecast/{officeCode}.json
//
// 【1回のAPIリクエストで何日分取れるか】
// 気象庁APIは1回のリクエストで「今日から3日分」のデータを返す。
// 以前は1日ずつ取得していたが、複数日をまとめて配列で受け取り、
// 1回のHTTPリクエストで全日分を返すよう改善した。

import { OFFICE_CODE_MAP, type Prefecture } from "@/lib/constants/prefectures";

// ── 返り値の型 ──
export interface WeatherForecast {
  date:     string;    // "YYYY-MM-DD"
  weather:  string;    // "晴れ"、"曇り"、"雨" など（気象庁テキストそのまま）
  pops:     string[];  // 降水確率を6時間ごと4つ ["10", "30", "60", "20"]
  willRain: boolean;   // max(pops) >= 50 → true（AIが参考にする判断材料）
}

/**
 * 複数日付の天気予報をまとめて取得する（1回のHTTPリクエスト）
 *
 * @param dates    - 対象日の配列 "YYYY-MM-DD" 形式（最大3日：今日〜2日後）
 * @param location - 都道府県名（例: "熊本県"）※設定画面のドロップダウンで選んだ値
 * @returns WeatherForecast の配列。取得できなかった日付は結果から除外される
 */
export async function getWeatherForecast(
  dates: string[],
  location: string,
): Promise<WeatherForecast[]> {

  if (dates.length === 0) return [];

  // 都道府県名 → officeCode に変換
  // PREFECTURE_LIST のドロップダウンから選んだ値のみが入るため、
  // 基本的に lookup が失敗することはないが念のため guard を置く
  const officeCode = OFFICE_CODE_MAP[location as Prefecture];
  if (!officeCode) {
    console.warn(`[getWeatherForecast] Unknown location: "${location}"`);
    return [];
  }

  // ── 気象庁API 呼び出し（1回で3日分まとめて取得）──
  const url = `https://www.jma.go.jp/bosai/forecast/data/forecast/${officeCode}.json`;
  let json: unknown;
  try {
    const res = await fetch(url, {
      // Next.js の fetch は自動キャッシュされるが、天気は最新を使いたいので無効化
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[getWeatherForecast] API error: ${res.status}`);
      return [];
    }
    json = await res.json();
  } catch (err) {
    console.error("[getWeatherForecast] fetch failed:", err);
    return [];
  }

  // ── レスポンスをパース ──
  //
  // 気象庁APIのレスポンス構造:
  //   data[0].timeSeries[0] → 天気テキスト（weathers）3日分
  //   data[0].timeSeries[1] → 降水確率（pops）6時間ごと
  //
  // 各 timeDefines は "YYYY-MM-DDT00:00:00+09:00" のような ISO 文字列。
  // startsWith(date) で "YYYY-MM-DD" と前方一致させてインデックスを特定する。
  try {
    const data      = json as any[];
    const timeSeries = data[0].timeSeries;
    const ts0        = timeSeries[0];
    const ts1        = timeSeries[1];

    const timeDefines: string[] = ts0.timeDefines;
    const area0 = ts0.areas[0];
    const area1 = ts1.areas[0];
    const popDefines: string[] = ts1.timeDefines;

    const results: WeatherForecast[] = [];

    for (const date of dates) {
      // 対象日に対応するインデックスを探す（天気テキスト用）
      const targetIndex = timeDefines.findIndex((t) => t.startsWith(date));
      if (targetIndex === -1) {
        console.warn(`[getWeatherForecast] Date not found: ${date} in`, timeDefines);
        continue; // この日付はスキップ（3日以上先など）
      }

      const weather: string = area0.weathers?.[targetIndex] ?? "不明";

      // 降水確率（6時間ごと）をその日付分だけ収集
      let pops: string[] = [];
      try {
        const popIndices = popDefines
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.startsWith(date))
          .map(({ i }) => i);
        pops = popIndices.map((i) => area1.pops?.[i] ?? "0");
      } catch {
        pops = [];
      }

      // willRain: 降水確率の最大値が50以上なら「雨の可能性あり」
      const maxPop = pops.length
        ? Math.max(...pops.map((p) => parseInt(p, 10) || 0))
        : 0;

      results.push({ date, weather, pops, willRain: maxPop >= 50 });
    }

    return results;

  } catch (err) {
    console.error("[getWeatherForecast] parse error:", err);
    return [];
  }
}
