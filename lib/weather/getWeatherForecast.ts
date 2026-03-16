// 気象庁API ラッパー
//
// 気象庁の無料天気予報API（APIキー不要）を使って指定日の天気を取得する。
//
// API URL: https://www.jma.go.jp/bosai/forecast/data/forecast/{officeCode}.json
//
// officeCode とは:
//   気象庁が都道府県ごとに定めた6桁の地域コード。
//   例）熊本県 → "430000"、東京都 → "130000"
//
// レスポンス構造（一部抜粋）:
//   [
//     {
//       "timeSeries": [
//         {   // [0] → 天気予報（3日分）
//           "timeDefines": ["2024-03-15T00:00:00+09:00", ...],
//           "areas": [{ "weathers": ["晴れ", ...], "pops": ["10", "30", "60", "20"] }]
//         },
//         {   // [1] → 降水確率（各日の6時間ごと）
//           "timeDefines": [...],
//           "areas": [{ "pops": ["10", "20", "30", "40"] }]
//         }
//       ]
//     }
//   ]

// ── 返り値の型 ──
export interface WeatherForecast {
  date:     string;    // "YYYY-MM-DD"
  weather:  string;    // "晴れ"、"曇り"、"雨" など（気象庁テキストそのまま）
  pops:     string[];  // 降水確率を6時間ごと4つ ["10", "30", "60", "20"]
  willRain: boolean;   // max(pops) >= 50 → true（AIが参考にする判断材料）
}

// ── 都道府県名 → officeCode マッピング ──
// 気象庁が定める地域コード（全47都道府県）
const OFFICE_CODE_MAP: Record<string, string> = {
  "北海道":   "016000",
  "青森県":   "020000",
  "岩手県":   "030000",
  "宮城県":   "040000",
  "秋田県":   "050000",
  "山形県":   "060000",
  "福島県":   "070000",
  "茨城県":   "080000",
  "栃木県":   "090000",
  "群馬県":   "100000",
  "埼玉県":   "110000",
  "千葉県":   "120000",
  "東京都":   "130000",
  "神奈川県": "140000",
  "新潟県":   "150000",
  "富山県":   "160000",
  "石川県":   "170000",
  "福井県":   "180000",
  "山梨県":   "190000",
  "長野県":   "200000",
  "岐阜県":   "210000",
  "静岡県":   "220000",
  "愛知県":   "230000",
  "三重県":   "240000",
  "滋賀県":   "250000",
  "京都府":   "260000",
  "大阪府":   "270000",
  "兵庫県":   "280000",
  "奈良県":   "290000",
  "和歌山県": "300000",
  "鳥取県":   "310000",
  "島根県":   "320000",
  "岡山県":   "330000",
  "広島県":   "340000",
  "山口県":   "350000",
  "徳島県":   "360000",
  "香川県":   "370000",
  "愛媛県":   "380000",
  "高知県":   "390000",
  "福岡県":   "400000",
  "佐賀県":   "410000",
  "長崎県":   "420000",
  "熊本県":   "430000",
  "大分県":   "440000",
  "宮崎県":   "450000",
  "鹿児島県": "460100",
  "沖縄県":   "471000",
};

/**
 * 指定した日付の天気予報を取得する
 *
 * @param date     - 対象日 "YYYY-MM-DD" 形式
 * @param location - 都道府県名（例: "熊本県"）
 * @returns WeatherForecast または null（location 未設定・マッピングなし・取得失敗時）
 */
export async function getWeatherForecast(
  date: string,
  location: string,
): Promise<WeatherForecast | null> {
  // location が空またはマッピングにない場合は null を返す
  const officeCode = OFFICE_CODE_MAP[location];
  if (!officeCode) {
    console.warn(`[getWeatherForecast] Unknown location: "${location}"`);
    return null;
  }

  // ── 気象庁API 呼び出し ──
  const url = `https://www.jma.go.jp/bosai/forecast/data/forecast/${officeCode}.json`;
  let json: unknown;
  try {
    const res = await fetch(url, {
      // Next.js の fetch は自動キャッシュされるが、天気は最新を使いたいので無効化
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[getWeatherForecast] API error: ${res.status}`);
      return null;
    }
    json = await res.json();
  } catch (err) {
    console.error("[getWeatherForecast] fetch failed:", err);
    return null;
  }

  // ── レスポンスをパース ──
  //
  // 気象庁APIのレスポンスは複雑な構造を持つ。
  // timeSeries[0] が天気テキスト＋降水確率（3日分の概況）
  // timeSeries[1] が各日の降水確率詳細（6時間ごと）
  //
  // ここでは timeSeries[0] の情報を使う。
  try {
    const data = json as any[];
    // data[0] は最初の予報区（北海道などは複数あるが[0]が主要地点）
    const timeSeries = data[0].timeSeries;

    // timeSeries[0] → 天気テキスト（weathers）と降水確率（pops）の3日分
    const ts0        = timeSeries[0];
    const timeDefines: string[] = ts0.timeDefines;  // ["2024-03-15T00:00:00+09:00", ...]
    const area       = ts0.areas[0];                // 最初のエリア

    // 対象日に対応するインデックスを探す
    // timeDefines の日付部分（YYYY-MM-DD）と引数 date を比較する
    const targetIndex = timeDefines.findIndex((t) => t.startsWith(date));
    if (targetIndex === -1) {
      console.warn(`[getWeatherForecast] Date not found: ${date} in`, timeDefines);
      return null;
    }

    const weather: string = area.weathers?.[targetIndex] ?? "不明";

    // timeSeries[1] → 降水確率（6時間ごと）
    // 1日に4区間（0〜6時, 6〜12時, 12〜18時, 18〜24時）がある
    let pops: string[] = [];
    try {
      const ts1   = timeSeries[1];
      const area1 = ts1.areas[0];
      // ts1 の timeDefines は ts0 より細かく分かれている
      // 対象日の文字列 "YYYY-MM-DD" で始まるインデックスをすべて収集
      const popDefines: string[] = ts1.timeDefines;
      const popIndices = popDefines
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.startsWith(date))
        .map(({ i }) => i);
      pops = popIndices.map((i) => area1.pops?.[i] ?? "0");
    } catch {
      // 降水確率が取れなくても天気テキストだけ返す
      pops = [];
    }

    // willRain: 降水確率の最大値が50以上なら「雨の可能性あり」
    const maxPop = pops.length
      ? Math.max(...pops.map((p) => parseInt(p, 10) || 0))
      : 0;

    return {
      date,
      weather,
      pops,
      willRain: maxPop >= 50,
    };
  } catch (err) {
    console.error("[getWeatherForecast] parse error:", err);
    return null;
  }
}
