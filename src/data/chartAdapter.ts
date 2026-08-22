import type { Row, ColumnMeta, ChartConfig } from "./types";
import { groupBy } from "./transformations";

export function toTimeSeries(rows: Row[], dateCol = "date", valueCol = "sales"): { date: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = String(r[dateCol] ?? "");
    const period = d.slice(0, 7);
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

export type SuggestedChart = { config: ChartConfig; data: { name: string; value: number }[] };

function looksLikeDate(values: unknown[]): boolean {
  const samples = values.filter((v) => v !== null && v !== "" && v !== undefined).slice(0, 20);
  if (samples.length === 0) return false;
  let dateCount = 0;
  for (const v of samples) {
    const s = String(v).trim();
    if (!Number.isNaN(Date.parse(s)) && /\d{4}-\d{2}-\d{2}/.test(s)) dateCount++;
  }
  return dateCount / samples.length > 0.7;
}

export function suggestCharts(columns: ColumnMeta[], rows: Row[]): SuggestedChart[] {
  if (!rows.length || !columns.length) return [];

  const dateCols = columns.filter((c) => c.type === "date" || looksLikeDate(rows.map((r) => r[c.name])));
  const numCols = columns.filter((c) => c.type === "number");
  const catCols = columns.filter((c) => c.type === "string" && c.distinctCount >= 2 && c.distinctCount <= 20);

  const charts: SuggestedChart[] = [];
  const seen = new Set<string>();

  function key(config: ChartConfig) {
    return `${config.chartType}|${config.x}|${config.y}`;
  }

  function add(config: ChartConfig, data: { name: string; value: number }[]) {
    const k = key(config);
    if (!seen.has(k) && data.length > 0) {
      seen.add(k);
      charts.push({ config, data: data.slice(0, 20) });
    }
  }

  for (const d of dateCols.slice(0, 2)) {
    for (const n of numCols.slice(0, 3)) {
      const raw = toTimeSeries(rows, d.name, n.name);
      const data = raw.map((p) => ({ name: p.date, value: p.value }));
      if (data.length) {
        add({ chartType: "area", x: d.name, y: n.name, title: `${n.name} over time (${d.name})` }, data);
      }
    }
  }

  for (const c of catCols.slice(0, 3)) {
    for (const n of numCols.slice(0, 3)) {
      const data = toBarData(rows, c.name, n.name);
      if (data.length) {
        add({ chartType: "bar", x: c.name, y: n.name, title: `${n.name} by ${c.name}` }, data);
      }
    }
  }

  if (catCols.length > 0 && numCols.length > 0) {
    const c = catCols[0];
    const n = numCols[0];
    const data = toPieData(rows, c.name, n.name);
    if (data.length && data.length <= 12) {
      add({ chartType: "pie", x: c.name, y: n.name, title: `${n.name} distribution (${c.name})` }, data);
    }
  }

  return charts.slice(0, 6);
}
