import ExcelJS from "exceljs";
import Papa from "papaparse";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return parseCsv(file);
  }
  if (name.endsWith(".xlsx")) {
    return parseXlsx(file);
  }
  throw new Error("Filtypen stöds inte. Använd .xlsx eller .csv.");
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text(); // reads as UTF-8; ensure source CSVs are saved as UTF-8
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = (result.data ?? []).map((row) => {
    const clean: Record<string, string> = {};
    for (const h of headers) clean[h] = (row[h] ?? "").toString().trim();
    return clean;
  });
  return { headers, rows };
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel-filen innehåller inget kalkylblad.");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? "").trim());
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = row.values as unknown[]; // 1-indexed, [0] is empty
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const cellValue = values[idx + 1];
      obj[h] = cellValueToString(cellValue);
    });
    // Skip fully empty rows
    if (Object.values(obj).some((v) => v !== "")) rows.push(obj);
  });

  return { headers, rows };
}

function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "text" in (value as Record<string, unknown>)) {
    // ExcelJS rich text / hyperlink cells
    return String((value as { text: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}
