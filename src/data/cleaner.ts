import type { Row, ColumnMeta } from "./types";

export type ImputeStrategy = "mean" | "median" | "mode" | "forward_fill" | "zero" | "custom";

export type CleaningOperation =
  | { type: "drop_null_rows"; columns?: string[] }
  | { type: "impute_nulls"; column: string; strategy: ImputeStrategy; customValue?: string | number }
  | { type: "remove_duplicates"; columns?: string[] }
  | { type: "trim_strings"; columns?: string[] }
  | { type: "normalize_dates"; column: string }
  | { type: "filter_outliers_iqr"; column: string; factor?: number }
  | { type: "convert_type"; column: string; targetType: "number" | "string" | "date" | "boolean" };

export interface CleaningDiagnosis {
  totalRows: number;
  duplicateRows: number;
  nullReport: { column: string; nullCount: number; percentage: number }[];
  outlierReport: { column: string; outlierCount: number; lowerBound: number; upperBound: number }[];
  inconsistentDates: { column: string; sampleInconsistencies: string[] }[];
  recommendedOperations: CleaningOperation[];
}

export interface CleaningResult {
  cleanedRows: Row[];
  appliedOperations: CleaningOperation[];
  rowsRemoved: number;
  cellsModified: number;
  summary: string;
}

/**
 * Diagnostica problemas de calidad en el dataset (inspección de Helix-Bot).
 */
export function diagnoseDataset(rows: Row[], columns: ColumnMeta[]): CleaningDiagnosis {
  if (rows.length === 0) {
    return {
      totalRows: 0,
      duplicateRows: 0,
      nullReport: [],
      outlierReport: [],
      inconsistentDates: [],
      recommendedOperations: [],
    };
  }

  const recommended: CleaningOperation[] = [];

  // 1. Detección de duplicados
  const rowHashes = new Set<string>();
  let duplicateCount = 0;
  for (const r of rows) {
    const hash = JSON.stringify(r);
    if (rowHashes.has(hash)) duplicateCount++;
    else rowHashes.add(hash);
  }
  if (duplicateCount > 0) {
    recommended.push({ type: "remove_duplicates" });
  }

  // 2. Reporte de nulos
  const nullReport = columns
    .map((c) => ({
      column: c.name,
      nullCount: c.nullCount,
      percentage: Number(((c.nullCount / rows.length) * 100).toFixed(1)),
    }))
    .filter((r) => r.nullCount > 0);

  for (const n of nullReport) {
    const colMeta = columns.find((c) => c.name === n.column);
    if (colMeta?.type === "number") {
      recommended.push({ type: "impute_nulls", column: n.column, strategy: "median" });
    } else {
      recommended.push({ type: "impute_nulls", column: n.column, strategy: "mode" });
    }
  }

  // 3. Outliers por IQR para columnas numéricas
  const outlierReport: CleaningDiagnosis["outlierReport"] = [];
  const numCols = columns.filter((c) => c.type === "number");

  for (const col of numCols) {
    const values = rows
      .map((r) => Number(r[col.name]))
      .filter((v) => !Number.isNaN(v) && v !== null);

    if (values.length >= 8) {
      values.sort((a, b) => a - b);
      const q1 = values[Math.floor(values.length * 0.25)] ?? 0;
      const q3 = values[Math.floor(values.length * 0.75)] ?? 0;
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;

      const outliers = values.filter((v) => v < lower || v > upper);
      if (outliers.length > 0) {
        outlierReport.push({
          column: col.name,
          outlierCount: outliers.length,
          lowerBound: Number(lower.toFixed(2)),
          upperBound: Number(upper.toFixed(2)),
        });
      }
    }
  }

  // 4. Inconsistencia de Fechas
  const inconsistentDates: CleaningDiagnosis["inconsistentDates"] = [];
  const dateCols = columns.filter((c) => c.type === "date");
  for (const col of dateCols) {
    const invalidFormats: string[] = [];
    for (const r of rows) {
      const val = String(r[col.name] ?? "").trim();
      if (!val) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        if (!Number.isNaN(Date.parse(val))) {
          if (!invalidFormats.includes(val) && invalidFormats.length < 3) {
            invalidFormats.push(val);
          }
        }
      }
    }
    if (invalidFormats.length > 0) {
      inconsistentDates.push({ column: col.name, sampleInconsistencies: invalidFormats });
      recommended.push({ type: "normalize_dates", column: col.name });
    }
  }

  // Trim strings
  const strCols = columns.filter((c) => c.type === "string");
  if (strCols.length > 0) {
    recommended.push({ type: "trim_strings" });
  }

  return {
    totalRows: rows.length,
    duplicateRows: duplicateCount,
    nullReport,
    outlierReport,
    inconsistentDates,
    recommendedOperations: recommended,
  };
}

/**
 * Aplica operaciones de limpieza sobre el dataset de forma determinista y pura.
 */
export function applyCleaningOperations(
  rows: Row[],
  operations: CleaningOperation[]
): CleaningResult {
  let current = [...rows];
  let cellsModified = 0;
  const initialCount = rows.length;

  for (const op of operations) {
    switch (op.type) {
      case "remove_duplicates": {
        const seen = new Set<string>();
        const filtered: Row[] = [];
        for (const r of current) {
          const key = op.columns && op.columns.length > 0
            ? JSON.stringify(op.columns.map((c) => r[c]))
            : JSON.stringify(r);
          if (!seen.has(key)) {
            seen.add(key);
            filtered.push(r);
          }
        }
        current = filtered;
        break;
      }

      case "drop_null_rows": {
        current = current.filter((r) => {
          if (op.columns && op.columns.length > 0) {
            return op.columns.every((c) => r[c] !== null && r[c] !== "" && r[c] !== undefined);
          }
          return Object.values(r).every((v) => v !== null && v !== "" && v !== undefined);
        });
        break;
      }

      case "trim_strings": {
        current = current.map((r) => {
          const updated = { ...r };
          for (const key of Object.keys(updated)) {
            if (op.columns && !op.columns.includes(key)) continue;
            if (typeof updated[key] === "string") {
              const trimmed = (updated[key] as string).trim();
              if (trimmed !== updated[key]) {
                updated[key] = trimmed;
                cellsModified++;
              }
            }
          }
          return updated;
        });
        break;
      }

      case "normalize_dates": {
        current = current.map((r) => {
          const updated = { ...r };
          const val = updated[op.column];
          if (val) {
            const parsed = new Date(String(val));
            if (!Number.isNaN(parsed.getTime())) {
              const iso = parsed.toISOString().split("T")[0];
              if (iso && iso !== String(val)) {
                updated[op.column] = iso;
                cellsModified++;
              }
            }
          }
          return updated;
        });
        break;
      }

      case "impute_nulls": {
        const col = op.column;
        let fillValue: string | number | null = null;

        if (op.strategy === "custom") {
          fillValue = op.customValue ?? null;
        } else if (op.strategy === "zero") {
          fillValue = 0;
        } else if (op.strategy === "mean" || op.strategy === "median") {
          const nums = current
            .map((r) => Number(r[col]))
            .filter((v) => !Number.isNaN(v) && v !== null && v !== undefined);
          if (nums.length > 0) {
            if (op.strategy === "mean") {
              const sum = nums.reduce((a, b) => a + b, 0);
              fillValue = Number((sum / nums.length).toFixed(2));
            } else {
              nums.sort((a, b) => a - b);
              fillValue = nums[Math.floor(nums.length / 2)] ?? 0;
            }
          }
        } else if (op.strategy === "mode") {
          const counts = new Map<string | number, number>();
          for (const r of current) {
            const v = r[col];
            if (v !== null && v !== "" && v !== undefined) {
              counts.set(v as string | number, (counts.get(v as string | number) ?? 0) + 1);
            }
          }
          let maxCount = 0;
          for (const [val, count] of counts.entries()) {
            if (count > maxCount) {
              maxCount = count;
              fillValue = val;
            }
          }
        }

        let prevVal: string | number | boolean | null = null;
        current = current.map((r) => {
          const updated = { ...r };
          const v = updated[col];
          if (v === null || v === "" || v === undefined) {
            if (op.strategy === "forward_fill") {
              updated[col] = prevVal;
            } else {
              updated[col] = fillValue;
            }
            cellsModified++;
          } else {
            prevVal = v;
          }
          return updated;
        });
        break;
      }

      case "filter_outliers_iqr": {
        const col = op.column;
        const nums = current
          .map((r) => Number(r[col]))
          .filter((v) => !Number.isNaN(v) && v !== null);

        if (nums.length >= 8) {
          nums.sort((a, b) => a - b);
          const factor = op.factor ?? 1.5;
          const q1 = nums[Math.floor(nums.length * 0.25)] ?? 0;
          const q3 = nums[Math.floor(nums.length * 0.75)] ?? 0;
          const iqr = q3 - q1;
          const lower = q1 - factor * iqr;
          const upper = q3 + factor * iqr;

          current = current.filter((r) => {
            const n = Number(r[col]);
            if (Number.isNaN(n) || n === null) return true;
            return n >= lower && n <= upper;
          });
        }
        break;
      }

      case "convert_type": {
        current = current.map((r) => {
          const updated = { ...r };
          const val = updated[op.column];
          if (val !== null && val !== undefined && val !== "") {
            if (op.targetType === "number") {
              const parsed = Number(String(val).replace(/[^0-9.-]+/g, ""));
              if (!Number.isNaN(parsed)) {
                updated[op.column] = parsed;
                cellsModified++;
              }
            } else if (op.targetType === "string") {
              updated[op.column] = String(val);
              cellsModified++;
            } else if (op.targetType === "boolean") {
              updated[op.column] = String(val).toLowerCase() === "true" || val === 1;
              cellsModified++;
            }
          }
          return updated;
        });
        break;
      }
    }
  }

  const rowsRemoved = initialCount - current.length;
  const summary = `Limpieza completada: ${operations.length} operaciones aplicadas. Filas eliminadas: ${rowsRemoved}, Celdas corregidas/imputadas: ${cellsModified}.`;

  return {
    cleanedRows: current,
    appliedOperations: operations,
    rowsRemoved,
    cellsModified,
    summary,
  };
}
