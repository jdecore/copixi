import type { Row, Filter } from "./types";

export function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  if (!filters.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => {
      const val = r[f.column];
      switch (f.operator) {
        case "equals":
          return String(val) === String(f.value);
        case "contains":
          return String(val).toLowerCase().includes(String(f.value).toLowerCase());
        case "gt":
          return Number(val) > Number(f.value);
        case "lt":
          return Number(val) < Number(f.value);
        case "between": {
          const n = Number(val);
          return n >= Number(f.value) && n <= Number(f.value2);
        }
        default:
          return true;
      }
    })
  );
}

export function sortBy(rows: Row[], column: string, dir: "asc" | "desc" = "asc"): Row[] {
  return [...rows].sort((a, b) => {
    const av = a[column], bv = b[column];
    const an = Number(av), bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return dir === "asc" ? an - bn : bn - an;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

export function groupBy(
  rows: Row[],
  column: string,
  aggColumn: string,
  agg: "sum" | "avg" | "count" | "min" | "max" = "sum"
): { key: string; value: number }[] {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const k = String(r[column] ?? "Unknown");
    const v = Number(r[aggColumn]) || 0;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(v);
  }
  const out: { key: string; value: number }[] = [];
  for (const [key, vals] of map) {
    let value = 0;
    if (agg === "sum") value = vals.reduce((a, b) => a + b, 0);
    else if (agg === "avg") value = vals.reduce((a, b) => a + b, 0) / vals.length;
    else if (agg === "count") value = vals.length;
    else if (agg === "min") value = Math.min(...vals);
    else if (agg === "max") value = Math.max(...vals);
    out.push({ key, value });
  }
  return out.sort((a, b) => b.value - a.value);
}

export function topN(rows: Row[], column: string, n = 5): { key: string; value: number }[] {
  return groupBy(rows, column, "sales", "sum").slice(0, n);
}
