import type { Log } from "@prisma/client";

export function calcAverageAccuracy(logs: Log[]): number {
  const validLogs = logs.filter((l) => l.accuracyRatio !== null);
  if (validLogs.length === 0) return 100;
  const avg =
    validLogs.reduce((sum, l) => sum + l.accuracyRatio!, 0) / validLogs.length;
  return Math.round(avg * 100);
}

export function summarizeLogPattern(logs: Log[]): string {
  const avg = calcAverageAccuracy(logs);
  if (avg > 130) return "実際の作業時間が見積もりより30%以上長い傾向があります";
  if (avg > 110) return "実際の作業時間が見積もりより若干長い傾向があります";
  if (avg < 80) return "実際の作業時間が見積もりより短い傾向があります（見積もりに余裕があります）";
  return "見積もり精度は良好です";
}
