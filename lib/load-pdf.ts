import { readPdfLines, type TextLine } from "./pdf-lines";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Reads the PDF in the browser. The file never leaves the device. */
export async function pdfLinesFromFile(file: File): Promise<TextLine[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.js`;
  return readPdfLines(new Uint8Array(await file.arrayBuffer()), pdfjs);
}
