import type { Row, Metrics } from "./types";

export function sum(rows: Row[], column: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[column]) || 0), 0);
}

export function avg(rows: Row[], column: string): number {
  if (rows.length === 0) return 0;
  return sum(rows, column) / rows.length;
}

export function minVal(rows: Row[], column: string): number {
  const nums = rows.map((r) => Number(r[column])).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.min(...nums) : 0;
}

export function maxVal(rows: Row[], column: string): number {
  const nums = rows.map((r) => Number(r[column])).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

export function median(rows: Row[], column: string): number {
  const nums = rows.map((r) => Number(r[column])).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

export function stdDev(rows: Row[], column: string): number {
  if (rows.length < 2) return 0;
  const m = avg(rows, column);
  const variance = rows.reduce((acc, r) => {
    const n = Number(r[column]) || 0;
    return acc + (n - m) ** 2;
  }, 0) / rows.length;
  return Math.sqrt(variance);
}

export function percentile(rows: Row[], column: string, p: number): number {
  const nums = rows.map((r) => Number(r[column])).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const idx = Math.ceil((p / 100) * nums.length) - 1;
  return nums[Math.max(0, Math.min(idx, nums.length - 1))];
}

export function computeMetrics(rows: Row[]): Metrics {
  return {
    totalSales: sum(rows, "sales"),
    avgSales: avg(rows, "sales"),
    totalUnits: sum(rows, "units"),
    totalCustomers: sum(rows, "customers"),
    rowCount: rows.length,
  };
}
