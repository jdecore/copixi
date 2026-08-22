import Papa from "papaparse";
import type { Row } from "./types";

export type ParseResult = {
  rows: Row[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta;
};

export type ParseOptions = {
  header?: boolean;
  skipEmptyLines?: boolean;
  dynamicTyping?: boolean;
};

/**
 * Papa Parse wrapper — pure, client-side, no LLM.
 * Validates CSV type, size and content.
 */
export function parseCSV(input: File | string, options: ParseOptions = {}): Promise<ParseResult> {
  const { header = true, skipEmptyLines = true } = options;

  return new Promise((resolve, reject) => {
    Papa.parse<Row>(input as unknown as string, {
      header,
      skipEmptyLines,
      dynamicTyping: false, // keep strings, infer later via profiler
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        // Filter out completely empty rows that Papa may keep
        const rows = (results.data as Row[]).filter((r) => {
          if (!r || typeof r !== "object") return false;
          return Object.values(r).some((v) => v !== null && v !== "" && v !== undefined);
        });
        resolve({ rows, errors: results.errors, meta: results.meta });
      },
      error: (err: Error) => reject(err),
    });
  });
}

export function validateFile(file: File, maxSizeMB = 15): { valid: boolean; error?: string } {
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
    return { valid: false, error: "Invalid file type. Only .csv is allowed." };
  }
  if (file.size === 0) return { valid: false, error: "File is empty." };
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File too large (max ${maxSizeMB} MB).` };
  }
  return { valid: true };
}
