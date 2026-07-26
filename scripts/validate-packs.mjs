import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPacksDirectory = path.join(root, "public", "packs");
const masterDirectory = path.join(root, "content", "master", "en");
const errors = [];

const addError = (file, jsonPath, message) => errors.push(`${path.relative(root, file)} ${jsonPath}: ${message}`);
const isDifficulty = (value) => value === 1 || value === 2 || value === 3;
const unique = (values) => new Set(values).size === values.length;

const parsePack = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
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
      wordIds.push(word.id);
    });
  });
  if (!unique(wordIds)) addError(file, "$.topics[*].vocab[*].id", "enthält doppelte Word-IDs");
  const sentenceIds = (pack.sentences ?? []).map((sentence) => sentence.id);
  if (!unique(sentenceIds)) addError(file, "$.sentences[*].id", "enthält doppelte Sentence-IDs");
  pack.sentences?.forEach((sentence, index) => {
    if (!sentence.id || !sentence.de || !sentence.translations || typeof sentence.translations !== "object") {
      addError(file, `$.sentences[${index}]`, "benötigt id, de und translations");
    }
  });
  return { topicIds, wordIds };
};

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

if (errors.length > 0) {
  console.error(`Pack-Validierung fehlgeschlagen (${errors.length} Fehler):\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Pack-Validierung erfolgreich: alle Master- und öffentlichen Packs sind konsistent.");
}
