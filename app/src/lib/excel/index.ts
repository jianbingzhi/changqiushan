import ExcelJS from "exceljs";

export interface ExcelExportConfig {
  sheetName: string;
  headers:   string[];
  rows:      (string | number | null)[][];
}

export async function exportToExcel(config: ExcelExportConfig): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(config.sheetName);

  // Header row
  ws.addRow(config.headers);
  const headerRow = ws.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font  = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D5A27" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Data rows
  config.rows.forEach((row) => ws.addRow(row));

  // Auto column widths
  ws.columns.forEach((col) => {
    const values = [config.headers[col.number! - 1] ?? "", ...config.rows.map((r) => String(r[col.number! - 1] ?? ""))];
    const maxLen = Math.max(...values.map((v) => v.length));
    col.width = Math.max(10, Math.min(30, maxLen + 2));
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
