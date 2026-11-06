// Verifies that every mobile dictionary defines all keys of the German reference and uses the same placeholders.
// Usage: node scripts/check-i18n.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "mobile", "src", "i18n");
const LANGS = ["de", "en", "es", "fr", "it", "pt", "nl", "pl", "ru", "tr"];

// The dictionaries are plain TS object literals; strip the type annotations and evaluate them.
const load = async (lang) => {
  const source = await readFile(path.join(root, `${lang}.ts`), "utf8");
  const body = source.replace(/^import[^\n]*\n/gm, "").replace(/export const \w+(: Dictionary)? = /, "return ").replace(/^(export )?type[\s\S]*$/m, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  return new Function(body)();
};

const flatten = (value, prefix = "", into = {}) => {
  if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) flatten(entry, prefix ? `${prefix}.${key}` : key, into);
  else if (typeof value === "string") into[prefix] = value;
  return into;
};
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");
const base = (key) => key.replace(/_(one|few|many|other)$/, "");

const reference = flatten(await load("de"));
let problems = 0;
for (const lang of LANGS.slice(1)) {
  const flat = flatten(await load(lang));
  const referenceBases = new Set(Object.keys(reference).map(base));
  const langBases = new Set(Object.keys(flat).map(base));
  for (const key of referenceBases) if (!langBases.has(key)) { console.log(`${lang}: fehlt ${key}`); problems += 1; }
  for (const key of langBases) if (!referenceBases.has(key)) { console.log(`${lang}: unbekannt ${key}`); problems += 1; }
  for (const [key, text] of Object.entries(flat)) {
    const ref = reference[key] ?? reference[`${base(key)}_other`] ?? reference[base(key)];
    if (ref && placeholders(ref) !== placeholders(text)) { console.log(`${lang}: Platzhalter in ${key}: "${placeholders(text)}" statt "${placeholders(ref)}"`); problems += 1; }
  }
}
console.log(problems ? `${problems} Probleme` : `i18n ok: ${Object.keys(reference).length} Schlüssel in ${LANGS.length} Sprachen`);
process.exit(problems ? 1 : 0);
