// Generates samples/devis-exemple.pdf, a 4-page proposal used to try the app.
// Written by hand (no dependency): Helvetica with WinAnsi encoding.
import { mkdirSync, writeFileSync } from "node:fs";

const WIN_ANSI = { "€": 0x80, "’": 0x92, "–": 0x96, "—": 0x97, "•": 0x95 };

function pdfString(text) {
  let out = "";
  for (const char of text) {
    const code = WIN_ANSI[char] ?? char.charCodeAt(0);
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += char;
  }
  return `(${out})`;
}

const pages = [
  [
    [28, "Proposition commerciale"],
    [16, "Refonte du site e-commerce"],
    [12, ""],
    [12, "Client : Acme SAS – à l’attention de Marie Martin"],
    [12, "Émise par : Studio Nova, le 14 septembre 2026"],
    [12, "Validité de l’offre : 30 jours"],
  ],
  [
    [22, "Périmètre du projet"],
    [12, ""],
    [12, "• Audit UX et refonte des parcours d’achat"],
    [12, "• Design system et maquettes responsive"],
    [12, "• Développement Next.js et intégration Shopify"],
    [12, "• Migration du catalogue (4 000 produits)"],
    [12, "Livrables : maquettes, code source, documentation, formation."],
  ],
  [
    [22, "Planning"],
    [12, ""],
    [12, "Phase 1 – Cadrage et audit : 2 semaines"],
    [12, "Phase 2 – Design : 3 semaines"],
    [12, "Phase 3 – Développement : 6 semaines"],
    [12, "Phase 4 – Recette et mise en ligne : 2 semaines"],
    [12, "Délai total : 13 semaines à compter de la signature."],
  ],
  [
    [22, "Tarifs et conditions"],
    [12, ""],
    [12, "Audit et cadrage : 3 500 € HT"],
    [12, "Design : 7 000 € HT"],
    [12, "Développement et intégration : 14 000 € HT"],
    [14, "Total du projet : 24 500 € HT (29 400 € TTC)"],
    [12, "Option maintenance : 450 € HT / mois"],
    [12, "Conditions de paiement : 30 % d’acompte à la signature,"],
    [12, "40 % à la livraison du design, solde à la mise en ligne."],
  ],
];

const objects = [];
const addObject = (body) => objects.push(body) && objects.length;

const catalogId = addObject("");
const pagesId = addObject("");
const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

const pageIds = pages.map((lines) => {
  let y = 760;
  const stream = lines
    .map(([size, text]) => {
      const op = text ? `BT /F1 ${size} Tf 72 ${y} Td ${pdfString(text)} Tj ET` : "";
      y -= size * 1.8;
      return op;
    })
    .filter(Boolean)
    .join("\n");
  const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  return addObject(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
  );
});

objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

let pdf = "%PDF-1.4\n";
const offsets = objects.map((body, index) => {
  const offset = Buffer.byteLength(pdf, "latin1");
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  return offset;
});
const xrefOffset = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

mkdirSync("samples", { recursive: true });
writeFileSync("samples/devis-exemple.pdf", Buffer.from(pdf, "latin1"));
console.log("samples/devis-exemple.pdf written");
