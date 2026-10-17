// en.json and fr.json must have exactly the same keys. tsc catches it too (src/i18n/messages.ts),
// this says which keys.
import { readFileSync } from "node:fs";

const load = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));

function keys(value, prefix = "") {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

const [en, fr] = ["en", "fr"].map((locale) => new Set(keys(load(locale))));
const missing = [
  ...[...en].filter((key) => !fr.has(key)).map((key) => `fr.json is missing ${key}`),
  ...[...fr].filter((key) => !en.has(key)).map((key) => `en.json is missing ${key}`),
];

if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`messages: ${en.size} keys, en and fr match`);
