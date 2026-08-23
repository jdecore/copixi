import type { Row, ColumnMeta, ColumnType, DatasetProfile } from "./types";

function inferType(values: unknown[]): ColumnType {
  const samples = values.filter((v) => v !== null && v !== "" && v !== undefined).slice(0, 20);
  if (samples.length === 0) return "string";

  let num = 0, date = 0, bool = 0;
  for (const v of samples) {
    const s = String(v).trim().toLowerCase();
    if (s === "true" || s === "false") { bool++; continue; }
    if (!Number.isNaN(Number(s)) && s !== "") { num++; continue; }
    const d = Date.parse(String(v));
    if (!Number.isNaN(d) && /\d{4}-\d{2}-\d{2}/.test(String(v))) { date++; continue; }
  }
  if (bool === samples.length) return "boolean";
  if (num / samples.length > 0.7) return "number";
  if (date / samples.length > 0.7) return "date";
  return "string";
}

export function profileDataset(rows: Row[]): DatasetProfile {
  if (rows.length === 0) return { rowCount: 0, columns: [], nulls: {} };
  const keys = Object.keys(rows[0] ?? {});
  const columns: ColumnMeta[] = keys.map((name) => {
    const values = rows.map((r) => r[name]);
    const nullCount = values.filter((v) => v === null || v === "" || v === undefined).length;
    const distinct = new Set(values.filter((v) => v !== null && v !== "" && v !== undefined)).size;
    const type = inferType(values);
    let min: unknown, max: unknown;
    if (type === "number") {
      let mn = Infinity, mx = -Infinity;
      for (const v of values) {
        const n = Number(v);
        if (!Number.isNaN(n)) { if (n < mn) mn = n; if (n > mx) mx = n; }
      }
      if (mn !== Infinity) { min = mn; max = mx; }
    } else if (type === "date") {
      const dates = values.map((v) => String(v)).filter((s) => !Number.isNaN(Date.parse(s)));
      if (dates.length) {
        dates.sort();
        min = dates[0]; max = dates[dates.length - 1];
      }
    } else {
      const strs = values.filter((v) => typeof v === "string").map(String).sort();
      if (strs.length) { min = strs[0]; max = strs[strs.length - 1]; }
    }
    const sampleValues = [...new Set(values.filter((v) => v !== null && v !== ""))].slice(0, 5);
    return { name, type, nullCount, distinctCount: distinct, min: min as string | number | undefined, max: max as string | number | undefined, sampleValues };
  });
  const nulls: Record<string, number> = {};
  for (const c of columns) nulls[c.name] = c.nullCount;
  return { rowCount: rows.length, columns, nulls };
}
