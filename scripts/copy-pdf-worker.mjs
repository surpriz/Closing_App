// Copies the pdf.js worker to /public so the viewer can load it from the same origin
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json"));

mkdirSync("public", { recursive: true });
copyFileSync(
  path.join(pdfjsDir, "build", "pdf.worker.min.mjs"),
  path.join("public", "pdf.worker.min.mjs"),
);
