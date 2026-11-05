// Vokabel-Masterliste von Lingo Pro: alle Sprachen, Level, Themen, Lernmodus (Schwierigkeit) und Bilder in einer Tabelle.
//
//   node scripts/content.mjs export   public/packs → content/vokabeln.csv + content/saetze.csv
//   node scripts/content.mjs import   content/*.csv → public/packs/{lang}/{level}.json (+ mobile/src/lib neu erzeugen)
//   node scripts/content.mjs check    nur prüfen, nichts schreiben
//
// Die CSV-Dateien sind mit Semikolon getrennt und UTF-8 mit BOM, damit sie sich in deutschem Excel direkt öffnen lassen.
// Eine neue Sprache = neue Spalte (z. B. "pt") in beiden CSVs; zusätzlich muss sie in app/lib/languages.ts eingetragen werden.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packsDir = path.join(root, "public", "packs");
const contentDir = path.join(root, "content");
const imagesDir = path.join(root, "mobile", "assets", "word-images");
const VOCAB_CSV = path.join(contentDir, "vokabeln.csv");
const SENTENCES_CSV = path.join(contentDir, "saetze.csv");
const SEP = ";";
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MODE = { 1: "Einfach", 2: "Mittel", 3: "Schwer" };

const VOCAB_FIXED = ["level", "thema_id", "thema", "thema_icon", "thema_lernmodus", "wort_id", "lernmodus", "tags", "de"];
const VOCAB_TAIL = ["beispiel_de", "bild", "bild_prompt"];

// ---------------------------------------------------------------- CSV helpers
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (header, rows) => `﻿${[header, ...rows].map((row) => row.map(csvCell).join(SEP)).join("\r\n")}\r\n`;

const parseCsv = (raw) => {
  const text = raw.replace(/^﻿/, "");
  const sep = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((value) => value.trim() !== ""));
  const keys = header.map((h) => h.trim());
  return { keys, records: body.map((r) => Object.fromEntries(keys.map((k, index) => [k, (r[index] ?? "").trim()]))) };
};

const defaultPrompt = (en, de) => `${en || de}`;

// ---------------------------------------------------------------- export
async function exportCsv() {
  const languages = (await readdir(packsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const words = new Map(); // key level|wordId → row
  const sentences = new Map();
  for (const lang of languages) {
    for (const file of (await readdir(path.join(packsDir, lang))).filter((f) => f.endsWith(".json"))) {
      const pack = JSON.parse(await readFile(path.join(packsDir, lang, file), "utf8"));
      const level = String(pack.level ?? path.basename(file, ".json")).toUpperCase();
      for (const topic of pack.topics ?? []) {
        for (const word of topic.vocab ?? []) {
          const key = `${level}|${word.id}`;
          const row = words.get(key) ?? {
            level, thema_id: topic.id, thema: topic.title, thema_icon: topic.icon ?? "", thema_lernmodus: topic.difficulty ?? 1,
            wort_id: word.id, lernmodus: word.difficulty ?? 1, tags: (word.tags ?? []).join(","), de: word.de, beispiel_de: word.exTr ?? "",
          };
          row[lang] = word.x;
          if (word.ex) row[`beispiel_${lang}`] = word.ex;
          words.set(key, row);
        }
      }
      for (const sentence of pack.sentences ?? []) {
        const key = `${level}|${sentence.id}`;
        const row = sentences.get(key) ?? { level, satz_id: sentence.id, de: sentence.de, fokuswort: sentence.focusWord ?? "" };
        row[lang] = sentence.translations?.[lang] ?? sentence.x ?? "";
        sentences.set(key, row);
      }
    }
  }
  const exampleLangs = languages.filter((lang) => [...words.values()].some((row) => row[`beispiel_${lang}`]));
  const vocabHeader = [...VOCAB_FIXED, ...languages, ...exampleLangs.map((lang) => `beispiel_${lang}`), ...VOCAB_TAIL];
  const order = (row) => `${LEVELS.indexOf(row.level)}`.padStart(2, "0");
  const vocabRows = [...words.values()]
    .sort((a, b) => order(a).localeCompare(order(b)))
    .map((row) => {
      row.bild = existsSync(path.join(imagesDir, `${row.wort_id}.jpg`)) ? `${row.wort_id}.jpg` : "";
      row.bild_prompt = row.bild_prompt || defaultPrompt(row.en, row.de);
      return vocabHeader.map((key) => row[key] ?? "");
    });
  const sentenceHeader = ["level", "satz_id", "de", ...languages, "fokuswort"];
  const sentenceRows = [...sentences.values()].map((row) => sentenceHeader.map((key) => row[key] ?? ""));
  await mkdir(contentDir, { recursive: true });
  await writeFile(VOCAB_CSV, toCsv(vocabHeader, vocabRows));
  await writeFile(SENTENCES_CSV, toCsv(sentenceHeader, sentenceRows));
  console.log(`Exportiert: ${vocabRows.length} Wörter, ${sentenceRows.length} Sätze, Sprachen: ${languages.join(", ")}`);
}

// ---------------------------------------------------------------- import / check
async function importCsv(write) {
  const vocab = parseCsv(await readFile(VOCAB_CSV, "utf8"));
  const sentences = existsSync(SENTENCES_CSV) ? parseCsv(await readFile(SENTENCES_CSV, "utf8")) : { keys: [], records: [] };
  const known = new Set([...VOCAB_FIXED, ...VOCAB_TAIL]);
  const languages = vocab.keys.filter((k) => !known.has(k) && !k.startsWith("beispiel_") && /^[a-z]{2}$/.test(k));
  const errors = [], warnings = [];
  const seen = new Set();
  vocab.records.forEach((row, index) => {
    const line = index + 2;
    const level = row.level.toUpperCase();
    if (!LEVELS.includes(level)) errors.push(`Zeile ${line}: Level "${row.level}" unbekannt (erlaubt: ${LEVELS.join(", ")})`);
    if (!row.wort_id) errors.push(`Zeile ${line}: wort_id fehlt`);
    if (!/^[a-z0-9_]+$/.test(row.wort_id)) errors.push(`Zeile ${line}: wort_id "${row.wort_id}" nur a-z, 0-9 und _`);
    if (seen.has(`${level}|${row.wort_id}`)) errors.push(`Zeile ${line}: wort_id "${row.wort_id}" doppelt in ${level}`);
    seen.add(`${level}|${row.wort_id}`);
    if (!row.thema_id || !row.thema) errors.push(`Zeile ${line}: thema_id/thema fehlt`);
    if (!["1", "2", "3"].includes(row.lernmodus)) errors.push(`Zeile ${line}: lernmodus muss 1, 2 oder 3 sein (${Object.values(MODE).join("/")})`);
    if (!row.de) errors.push(`Zeile ${line}: deutsches Wort fehlt`);
    for (const lang of languages) if (!row[lang]) warnings.push(`Zeile ${line}: "${row.de}" fehlt auf ${lang.toUpperCase()} – wird dort ausgelassen`);
  });
  for (const w of warnings.slice(0, 30)) console.warn(`Hinweis: ${w}`);
  if (warnings.length > 30) console.warn(`… ${warnings.length - 30} weitere Hinweise`);
  if (errors.length) {
    for (const e of errors) console.error(`Fehler: ${e}`);
    process.exitCode = 1;
    return;
  }

  const levels = [...new Set(vocab.records.map((r) => r.level.toUpperCase()))];
  let written = 0;
  for (const lang of languages) {
    for (const level of levels) {
      const topics = [];
      for (const row of vocab.records.filter((r) => r.level.toUpperCase() === level && r[lang])) {
        let topic = topics.find((t) => t.id === row.thema_id);
        if (!topic) {
          topic = { id: row.thema_id, title: row.thema, ...(row.thema_icon ? { icon: row.thema_icon } : {}), difficulty: Number(row.thema_lernmodus) || 1, vocab: [] };
          topics.push(topic);
        }
        const example = row[`beispiel_${lang}`];
        topic.vocab.push({
          id: row.wort_id, de: row.de, x: row[lang],
          ...(example ? { ex: example, ...(row.beispiel_de ? { exTr: row.beispiel_de } : {}) } : {}),
          difficulty: Number(row.lernmodus), tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        });
      }
      if (!topics.length) continue;
      const packSentences = sentences.records
        .filter((s) => s.level.toUpperCase() === level && s[lang])
        .map((s) => ({ id: s.satz_id, de: s.de, x: s[lang], translations: { [lang]: s[lang] }, ...(s.fokuswort ? { focusWord: s.fokuswort } : {}) }));
      const pack = { version: 3, lang: lang.toUpperCase(), level, topics, sentences: packSentences };
      if (write) {
        await mkdir(path.join(packsDir, lang), { recursive: true });
        await writeFile(path.join(packsDir, lang, `${level.toLowerCase()}.json`), `${JSON.stringify(pack, null, 2)}\n`);
      }
      written++;
      console.log(`${write ? "geschrieben" : "ok"}: ${lang}/${level.toLowerCase()}.json – ${topics.length} Themen, ${topics.reduce((n, t) => n + t.vocab.length, 0)} Wörter, ${packSentences.length} Sätze`);
    }
  }
  if (write) {
    await import("./generate-mobile-packs.mjs");
    console.log(`Fertig: ${written} Packs. Neue Sprachen zusätzlich in app/lib/languages.ts eintragen.`);
  }
}

const command = process.argv[2];
if (command === "export") await exportCsv();
else if (command === "import") await importCsv(true);
else if (command === "check") await importCsv(false);
else console.log("Benutzung: node scripts/content.mjs export | import | check");
