import { chunkMarkdown } from "./chunk";

/** RFC4180'e yakın basit bir CSV satırı ayrıştırıcı (tırnaklı alanlar + kaçışlı çift tırnak dahil). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** İlk satırı başlık kabul edip her satırı "Başlık: değer" parçalarından oluşan tek bir metne çevirir. */
function rowsToChunks(header: string[], rows: string[][]): string[] {
  const chunks: string[] = [];
  for (const row of rows) {
    const parts: string[] = [];
    for (let i = 0; i < row.length; i++) {
      const value = row[i]?.trim();
      if (!value) continue;
      const key = header[i]?.trim();
      parts.push(key ? `${key}: ${value}` : value);
    }
    const text = parts.join(", ");
    if (text.length >= 3) chunks.push(text);
  }
  return chunks;
}

function extractChunksFromCsv(buffer: Buffer): string[] {
  const lines = buffer
    .toString("utf-8")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return rowsToChunks(header, rows);
}

async function extractChunksFromExcel(buffer: Buffer): Promise<string[]> {
  // Lazy import — bkz. extractChunksFromPdf'teki not: exceljs ve pdf-parse
  // aynı process'te birlikte yüklüyken pdf-parse'ın xref ayrıştırması
  // (nedeni netleşmemiş bir global çakışma yüzünden) bozuluyor. İkisi de
  // sadece gerçekten ihtiyaç duyulan dosya türü işlenirken yükleniyor.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const chunks: string[] = [];
  for (const worksheet of workbook.worksheets) {
    const rows: string[][] = [];
    worksheet.eachRow((row) => {
      // exceljs `row.values` 1-indexlidir (0. eleman boş) — normalize edilir.
      const values = (row.values as unknown[]).slice(1);
      rows.push(values.map((v) => (v == null ? "" : String(v))));
    });
    if (rows.length === 0) continue;
    const [header, ...body] = rows;
    chunks.push(...rowsToChunks(header, body));
  }
  return chunks;
}

/**
 * pdf-parse v2, ayrıştırmayı bir Node worker_threads içinde yapıyor — worker
 * script'i "pdf-parse/worker" ayrıca (side-effect olarak) import edilmezse,
 * Vercel'in bundle'ında worker'ın gerçek dosya yolu doğru izlenip pakete
 * dahil edilmiyor; sonuç olarak worker'ın kendi modül grafiği (pdfjs-dist)
 * yanlış/eksik çözülüp DOMMatrix'e (tarayıcıya özgü) düşen bir koda düşüyor,
 * "DOMMatrix is not defined" ile çöküyordu. Resmi Vercel örneği ("pdf-parse"
 * paketinin kendi Next.js+Vercel demo reposu) bu import'u ekleyip
 * next.config.ts'te serverExternalPackages ile birlikte kullanıyor.
 */
async function extractChunksFromPdf(buffer: Buffer): Promise<string[]> {
  await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return chunkMarkdown(result.text);
  } finally {
    await parser.destroy();
  }
}

/** Dosya adının uzantısına göre uygun ayrıştırıcıya yönlendirir. */
export async function extractChunksFromFile(fileName: string, buffer: Buffer): Promise<string[]> {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "csv":
      return extractChunksFromCsv(buffer);
    case "xlsx":
      return extractChunksFromExcel(buffer);
    case "pdf":
      return extractChunksFromPdf(buffer);
    default:
      throw new Error(`Desteklenmeyen dosya türü: .${ext ?? "?"} (izin verilenler: .csv, .xlsx, .pdf)`);
  }
}
