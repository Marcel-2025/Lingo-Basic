import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPacksDirectory = path.join(root, "public", "packs");
const masterDirectory = path.join(root, "content", "master", "en");
const errors = [];
const warnings = [];
const PLACEHOLDER_EXAMPLE = /ist wichtig im Thema/i;
const addWarning = (file, jsonPath, message) => warnings.push(`${path.relative(root, file)} ${jsonPath}: ${message}`);

const addError = (file, jsonPath, message) => errors.push(`${path.relative(root, file)} ${jsonPath}: ${message}`);
const isDifficulty = (value) => value === 1 || value === 2 || value === 3;
const unique = (values) => new Set(values).size === values.length;

const parsePack = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      addError(file, "$", "Datei fehlt (für jedes EN-Master-Level wird ein Pack pro Sprache erwartet)");
      return null;
    }
    addError(file, "$", `ungültiges JSON (${error instanceof Error ? error.message : "unbekannter Fehler"})`);
    return null;
  }
};

const validatePack = (pack, file, expectedLanguage, expectedLevel) => {
  if (!pack || typeof pack !== "object") return;
  if (pack.version < 3) addError(file, "$.version", "muss mindestens 3 sein");
  if (pack.lang !== expectedLanguage) addError(file, "$.lang", `erwartet ${expectedLanguage}, erhalten ${pack.lang}`);
  if (pack.level !== expectedLevel) addError(file, "$.level", `erwartet ${expectedLevel}, erhalten ${pack.level}`);
  if (!Array.isArray(pack.topics) || pack.topics.length === 0) {
    addError(file, "$.topics", "muss mindestens ein Thema enthalten");
    return;
  }
  const topicIds = pack.topics.map((topic) => topic.id);
  if (!unique(topicIds)) addError(file, "$.topics", "enthält doppelte Topic-IDs");
  const wordIds = [];
  pack.topics.forEach((topic, topicIndex) => {
    const topicPath = `$.topics[${topicIndex}]`;
    if (!topic.id || !topic.title) addError(file, topicPath, "benötigt id und title");
    if (!isDifficulty(topic.difficulty)) addError(file, `${topicPath}.difficulty`, "muss 1, 2 oder 3 sein");
    if (!Array.isArray(topic.vocab) || topic.vocab.length === 0) addError(file, `${topicPath}.vocab`, "muss mindestens eine Vokabel enthalten");
    topic.vocab?.forEach((word, wordIndex) => {
      const wordPath = `${topicPath}.vocab[${wordIndex}]`;
      if (!word.id || !word.de || !word.x) addError(file, wordPath, "benötigt id, de und x");
      if (!isDifficulty(word.difficulty)) addError(file, `${wordPath}.difficulty`, "muss 1, 2 oder 3 sein");
      if (!Array.isArray(word.tags) || word.tags.length === 0) addError(file, `${wordPath}.tags`, "muss mindestens einen Tag enthalten");
      if (typeof word.ex === "string" && PLACEHOLDER_EXAMPLE.test(word.ex)) addError(file, `${wordPath}.ex`, "Platzhalter-Beispielsatz ohne Lernwert");
      if (word.exTr && !word.ex) addError(file, `${wordPath}.exTr`, "exTr ohne ex");
      if (typeof word.de === "string" && typeof word.x === "string" && word.de.trim() !== word.de) addWarning(file, `${wordPath}.de`, "führende/abschließende Leerzeichen");
      wordIds.push(word.id);
    });
  });
  const duplicateWordIds = wordIds.filter((id, index) => wordIds.indexOf(id) !== index);
  if (duplicateWordIds.length > 0) addError(file, "$.topics[*].vocab[*].id", `enthält doppelte Word-IDs: ${[...new Set(duplicateWordIds)].join(", ")}`);
  const translationsByTopic = pack.topics.map((topic) => (topic.vocab ?? []).map((word) => word.x));
  translationsByTopic.forEach((values, topicIndex) => {
    const duplicates = values.filter((value, index) => value && values.indexOf(value) !== index);
    if (duplicates.length > 0) addWarning(file, `$.topics[${topicIndex}].vocab[*].x`, `doppelte Übersetzungen (${[...new Set(duplicates)].join(", ")}) erschweren Multiple Choice`);
  });
  const sentenceIds = (pack.sentences ?? []).map((sentence) => sentence.id);
  if (!unique(sentenceIds)) addError(file, "$.sentences[*].id", "enthält doppelte Sentence-IDs");
  pack.sentences?.forEach((sentence, index) => {
    if (!sentence.id || !sentence.de || !sentence.translations || typeof sentence.translations !== "object") {
      addError(file, `$.sentences[${index}]`, "benötigt id, de und translations");
    } else if (!sentence.translations[expectedLanguage.toLowerCase()]) {
      addError(file, `$.sentences[${index}].translations.${expectedLanguage.toLowerCase()}`, "Übersetzung in die Zielsprache fehlt");
    }
  });
  return { topicIds, wordIds };
};

// Review mode for drafts (e.g. AI-generated packs): node scripts/validate-packs.mjs --file draft.json
const fileArgIndex = process.argv.indexOf("--file");
if (fileArgIndex !== -1) {
  const draftPath = path.resolve(process.argv[fileArgIndex + 1] ?? "");
  const draft = await parsePack(draftPath);
  if (draft) {
    const level = String(draft.level ?? "").toUpperCase();
    const result = validatePack(draft, draftPath, String(draft.lang ?? "").toUpperCase(), level);
    const masterPath = path.join(masterDirectory, `${level.toLowerCase()}.json`);
    const master = level ? await readFile(masterPath, "utf8").then(JSON.parse).catch(() => null) : null;
    if (master && result) {
      const masterWordIds = master.topics.flatMap((topic) => topic.vocab.map((word) => word.id));
      if (JSON.stringify(masterWordIds) !== JSON.stringify(result.wordIds)) addError(draftPath, "$.topics[*].vocab[*].id", "Word-IDs weichen vom EN-Master ab");
    }
  }
  if (warnings.length > 0) console.warn(warnings.map((warning) => `- ${warning}`).join("\n"));
  if (errors.length > 0) {
    console.error(`Draft ungültig (${errors.length} Fehler):\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Draft gültig und konsistent zum EN-Master.");
  process.exit(0);
}

const languageDirectories = (await readdir(publicPacksDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory());
const masterFiles = await readdir(masterDirectory);
for (const masterFile of masterFiles.filter((file) => file.endsWith(".json"))) {
  const level = path.basename(masterFile, ".json").toUpperCase();
  const masterPath = path.join(masterDirectory, masterFile);
  const masterPack = await parsePack(masterPath);
  const masterResult = validatePack(masterPack, masterPath, "EN", level);
  for (const directory of languageDirectories) {
    const language = directory.name.toUpperCase();
    const packPath = path.join(publicPacksDirectory, directory.name, masterFile);
    const pack = await parsePack(packPath);
    const result = validatePack(pack, packPath, language, level);
    if (!masterResult || !result) continue;
    if (JSON.stringify(masterResult.topicIds) !== JSON.stringify(result.topicIds)) addError(packPath, "$.topics", "Topic-IDs weichen vom EN-Master ab");
    if (JSON.stringify(masterResult.wordIds) !== JSON.stringify(result.wordIds)) addError(packPath, "$.topics[*].vocab[*].id", "Word-IDs weichen vom EN-Master ab");
  }
}

// Every public level file needs a master counterpart, otherwise IDs cannot be checked for consistency.
const masterLevels = new Set(masterFiles.filter((file) => file.endsWith(".json")));
for (const directory of languageDirectories) {
  for (const file of await readdir(path.join(publicPacksDirectory, directory.name))) {
    if (file.endsWith(".json") && !masterLevels.has(file)) {
      addError(path.join(publicPacksDirectory, directory.name, file), "$", "kein passendes EN-Master-Pack unter content/master/en");
    }
  }
}

const legacyFiles = (await readdir(publicPacksDirectory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
for (const entry of legacyFiles) {
  const legacyPath = path.join(publicPacksDirectory, entry.name);
  const legacyPack = await parsePack(legacyPath);
  if (!legacyPack) continue;
  if (!legacyPack.lang || !legacyPack.level) addError(legacyPath, "$", "Legacy-Pack benötigt lang und level");
  if (!Array.isArray(legacyPack.topics) && !Array.isArray(legacyPack.vocab)) {
    addError(legacyPath, "$", "Legacy-Pack benötigt topics oder vocab");
  }
}

if (warnings.length > 0) {
  console.warn(`Hinweise (${warnings.length}):\n${warnings.map((warning) => `- ${warning}`).join("\n")}`);
}

if (errors.length > 0) {
  console.error(`Pack-Validierung fehlgeschlagen (${errors.length} Fehler):\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Pack-Validierung erfolgreich: alle Master- und öffentlichen Packs sind konsistent.");
}
