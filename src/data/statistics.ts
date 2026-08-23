import type { Row, Metrics } from "./types";

export function sum(rows: Row[], column: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[column]) || 0), 0);
}

export function avg(rows: Row[], column: string): number {
  if (rows.length === 0) return 0;
  const vals = rows.map((r) => Number(r[column])).filter((n) => !Number.isNaN(n));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function minVal(rows: Row[], column: string): number {
  let min = Infinity;
  for (const r of rows) {
    const n = Number(r[column]);
    if (!Number.isNaN(n) && n < min) min = n;
  }
  return min === Infinity ? 0 : min;
}

export function maxVal(rows: Row[], column: string): number {
  let max = -Infinity;
  for (const r of rows) {
    const n = Number(r[column]);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max === -Infinity ? 0 : max;
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

export function computeMetrics(rows: Row[], salesCol = "sales", unitsCol = "units", customersCol = "customers"): Metrics {
  return {
    totalSales: sum(rows, salesCol),
    avgSales: avg(rows, salesCol),
    totalUnits: sum(rows, unitsCol),
    totalCustomers: sum(rows, customersCol),
    rowCount: rows.length,
  };
}
