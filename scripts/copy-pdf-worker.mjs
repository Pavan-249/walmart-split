// pdf.js parses in a web worker; serve its script from public/ so it works under any basePath.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/pdf.worker.min.js");
