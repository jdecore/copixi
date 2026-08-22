import type { Row } from "./types";
import { groupBy } from "./transformations";

/**
 * Prepare data for Recharts. Pure adapters — no JSX.
 */
export function toTimeSeries(rows: Row[], dateCol = "date", valueCol = "sales"): { date: string; value: number }[] {
  // Assumes date is YYYY-MM-DD; groups by month
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = String(r[dateCol] ?? "");
    const period = d.slice(0, 7); // YYYY-MM
    const v = Number(r[valueCol]) || 0;
    map.set(period, (map.get(period) ?? 0) + v);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function toBarData(rows: Row[], categoryCol: string, valueCol = "sales"): { name: string; value: number }[] {
  return groupBy(rows, categoryCol, valueCol, "sum").map(({ key, value }) => ({ name: key, value }));
}

export function toPieData(rows: Row[], categoryCol: string, valueCol = "sales"): { name: string; value: number }[] {
  return toBarData(rows, categoryCol, valueCol);
}
