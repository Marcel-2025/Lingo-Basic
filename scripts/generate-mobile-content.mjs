// Builds mobile/src/content/words.json from content/vokabeln.csv, content/saetze.csv and content/themen.csv.
// Every word carries all languages, so the app can pair any base language (the learner's own) with any target
// language at runtime. Run after editing the CSVs: node scripts/generate-mobile-content.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = ["de", "en", "es", "fr", "it", "ru", "tr", "pt", "nl", "pl"];

const parseCsv = async (file) => {
  const text = (await readFile(path.join(root, "content", file), "utf8")).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0].split(";");
  return lines.slice(1).map((line) => Object.fromEntries(header.map((key, index) => [key, (line.split(";")[index] ?? "").trim()])));
};

const words = await parseCsv("vokabeln.csv");
const sentences = await parseCsv("saetze.csv");
const topicTitles = Object.fromEntries((await parseCsv("themen.csv")).map((row) => [row.thema_id, row]));

const levels = {};
const errors = [];
for (const row of words) {
  const level = row.level.toUpperCase();
  levels[level] ??= { topics: [] };
  let topic = levels[level].topics.find((entry) => entry.id === row.thema_id);
  if (!topic) {
    const titles = topicTitles[row.thema_id];
    if (!titles) errors.push(`Thema ${row.thema_id} fehlt in themen.csv`);
    topic = {
      id: row.thema_id,
      icon: row.thema_icon,
      difficulty: Number(row.thema_lernmodus) || 1,
      titles: Object.fromEntries(LANGS.map((lang) => [lang, titles?.[lang] || row.thema])),
      words: [],
    };
    levels[level].topics.push(topic);
  }
  const tr = Object.fromEntries(LANGS.map((lang) => [lang, row[lang]]));
  const ex = Object.fromEntries(LANGS.map((lang) => [lang, row[`beispiel_${lang}`]]).filter(([, value]) => value));
  for (const lang of LANGS) if (!tr[lang]) errors.push(`${row.wort_id}: Übersetzung ${lang} fehlt`);
  topic.words.push({
    id: row.wort_id,
    difficulty: Number(row.lernmodus) || topic.difficulty,
    tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    tr,
    ...(Object.keys(ex).length ? { ex } : {}),
  });
}

const sentenceList = sentences.map((row) => ({
  id: row.satz_id,
  level: row.level.toUpperCase(),
  tr: Object.fromEntries(LANGS.map((lang) => [lang, row[lang]]).filter(([, value]) => value)),
  ...(row.fokuswort ? { focus: row.fokuswort } : {}),
}));

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const output = { version: 2, languages: LANGS, levels, sentences: sentenceList };
await mkdir(path.join(root, "mobile", "src", "content"), { recursive: true });
await writeFile(path.join(root, "mobile", "src", "content", "words.json"), JSON.stringify(output));
const count = Object.values(levels).reduce((sum, level) => sum + level.topics.reduce((inner, topic) => inner + topic.words.length, 0), 0);
console.log(`words.json: ${count} Wörter, ${Object.keys(levels).length} Level, ${sentenceList.length} Sätze, ${LANGS.length} Sprachen.`);
