// Writes the committed text fixture from a real order PDF. Drops the Buyer block
// (name and address) and swaps the order number for a fake one, so it's safe to commit.
//   npm run fixture:text -- fixtures/walmart-2026-11-02.pdf fixtures/walmart-2026-11-02.txt
import { readFileSync, writeFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readPdfLines, serializeLines } from "../lib/pdf-lines";

const FAKE_ORDER = "1234567-89012345";
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: fixture:text <order.pdf> <out.txt>");

const lines = await readPdfLines(new Uint8Array(readFileSync(input)), pdfjs);
const first = lines.findIndex((l) => l.cells.some((c) => /^Qty\s*\d+$/i.test(c)));
const buyer = lines.findIndex((l) => /^buyer\b/i.test(l.cells[0] ?? ""));
const kept = lines.filter(
  (l, i) => buyer === -1 || i < buyer || i >= first || (l.page === lines[first].page && l.y - lines[first].y <= 14),
);

let out = serializeLines(kept);
for (const l of kept) {
  const real = /^Order\s*#\s*([\d-]+)$/i.exec(l.cells.join(" "))?.[1];
  if (real) out = out.replaceAll(real, FAKE_ORDER).replaceAll(real.replace(/-/g, ""), FAKE_ORDER.replace(/-/g, ""));
}
writeFileSync(output, out);
console.log(`wrote ${kept.length} of ${lines.length} lines to ${output}`);
