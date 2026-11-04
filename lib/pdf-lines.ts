/** One visual row of text on a PDF page. Cells are separate runs of text, left to right. */
export interface TextLine {
  page: number;
  /** Baseline in PDF points from the bottom of the page. Higher is further up. */
  y: number;
  cells: string[];
}

interface RawItem {
  str: string;
  transform: number[];
  width: number;
}

const SAME_ROW = 2; // pt: runs whose baselines are this close share a row
const JOIN_GAP = 4; // pt: runs closer than this are one cell
const MARGIN = 36; // pt: the browser's print header and footer (date, URL, page number)

export function groupLines(items: RawItem[], page: number, bottom: number, top: number): TextLine[] {
  const runs = items
    .filter((it) => it.str.trim() !== "")
    .map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))
    .filter((r) => r.y > bottom + MARGIN && r.y < top - MARGIN)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: { y: number; runs: typeof runs }[] = [];
  for (const r of runs) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - r.y) <= SAME_ROW) row.runs.push(r);
    else rows.push({ y: r.y, runs: [r] });
  }

  return rows.map((row) => {
    const cells: string[] = [];
    let end = -Infinity;
    for (const r of row.runs.sort((a, b) => a.x - b.x)) {
      if (cells.length && r.x - end < JOIN_GAP) cells[cells.length - 1] += (r.x - end > 1 ? " " : "") + r.s;
      else cells.push(r.s);
      end = r.x + r.w;
    }
    return {
      page,
      y: Math.round(row.y * 10) / 10,
      cells: cells.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean),
    };
  });
}

interface PdfJs {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ view: number[]; getTextContent(): Promise<{ items: object[] }> }>;
    }>;
    destroy(): Promise<void>;
  };
}

/** Text rows of every page, top to bottom. Takes pdf.js as an argument so the browser and tests load it their own way. */
export async function readPdfLines(data: Uint8Array, pdfjs: PdfJs): Promise<TextLine[]> {
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  try {
    const doc = await task.promise;
    const lines: TextLine[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const { items } = await page.getTextContent();
      const runs = items.filter((i): i is RawItem => "str" in i);
      lines.push(...groupLines(runs, n, page.view[1], page.view[3]));
    }
    return lines;
  } finally {
    await task.destroy();
  }
}

/** One row per line: page, y, then cells, tab-separated. Used for the committed test fixture. */
export function serializeLines(lines: TextLine[]): string {
  return lines.map((l) => [l.page, l.y, ...l.cells].join("\t")).join("\n") + "\n";
}

export function deserializeLines(text: string): TextLine[] {
  return text
    .split("\n")
    .filter((row) => row.trim() !== "")
    .map((row) => {
      const [page, y, ...cells] = row.split("\t");
      return { page: Number(page), y: Number(y), cells };
    });
}
