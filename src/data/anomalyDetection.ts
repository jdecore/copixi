import type { Row } from "./types";
import { avg, stdDev } from "./statistics";

export type Anomaly = {
  index: number;
  row: Row;
  column: string;
  value: number;
  zScore: number;
  type: "high" | "low";
};

/** Z-score simple detection. Pure, deterministic — no LLM. */
export function detectAnomaliesZScore(rows: Row[], column: string, threshold = 2.5): Anomaly[] {
  if (rows.length < 3) return [];
  const mean = avg(rows, column);
  const sd = stdDev(rows, column);
  if (sd === 0) return [];
  const out: Anomaly[] = [];
  rows.forEach((r, i) => {
    const v = Number(r[column]);
    if (Number.isNaN(v)) return;
    const z = (v - mean) / sd;
    if (Math.abs(z) >= threshold) {
      out.push({ index: i, row: r, column, value: v, zScore: z, type: z > 0 ? "high" : "low" });
    }
  });
  return out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/** IQR detection */
export function detectAnomaliesIQR(rows: Row[], column: string): Anomaly[] {
  const nums = rows
    .map((r, i) => ({ v: Number(r[column]), i, row: r }))
    .filter((x) => !Number.isNaN(x.v))
    .sort((a, b) => a.v - b.v);
  if (nums.length < 4) return [];
  const q1Idx = Math.floor(nums.length * 0.25);
  const q3Idx = Math.floor(nums.length * 0.75);
  const q1 = nums[q1Idx].v;
  const q3 = nums[q3Idx].v;
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const out: Anomaly[] = [];
  for (const { v, i, row } of nums) {
    if (v < lower || v > upper) {
      const mean = nums.reduce((a, b) => a + b.v, 0) / nums.length;
      const sd = Math.sqrt(nums.reduce((a, b) => a + (b.v - mean) ** 2, 0) / nums.length) || 1;
      const z = (v - mean) / sd;
      out.push({ index: i, row, column, value: v, zScore: z, type: v > upper ? "high" : "low" });
    }
  }
  return out;
}
