import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "public", "packs");
const outputDirectory = path.join(root, "public", "packs");
const masterDirectory = path.join(root, "content", "master", "en");

const languageFiles = { EN: "en", ES: "es", FR: "fr", RU: "ru" };
const difficultyMap = { easy: 1, medium: 2, hard: 3 };

const italianTranslations = [
  "acqua", "pane", "latte", "caffè", "tè", "mela", "banana", "riso",
  "aeroporto", "stazione ferroviaria", "biglietto", "hotel", "strada", "mappa", "valigia", "passaporto",
  "casa", "stanza", "cucina", "bagno", "finestra", "porta", "tavolo", "sedia",
  "lavoro", "ufficio", "capo", "collega", "riunione", "progetto", "e-mail", "pausa",
  "medico", "ospedale", "medicina", "dolore", "febbre", "aiuto", "appuntamento", "ricetta",
  "negozio", "prezzo", "denaro", "cassa", "sconto", "cliente", "venditore", "borsa",
  "madre", "padre", "fratello", "sorella", "amico", "bambino", "famiglia", "nome",
  "oggi", "domani", "ieri", "settimana", "mese", "anno", "imparare", "lingua",
];

const sentenceTranslations = {
  EN: ["I study for 30 minutes every day.", "Learning a language requires patience."],
  ES: ["Estudio 30 minutos cada día.", "Aprender un idioma requiere paciencia."],
  FR: ["J’étudie 30 minutes chaque jour.", "Apprendre une langue demande de la patience."],
  RU: ["Я учусь по 30 минут каждый день.", "Изучение языка требует терпения."],
  IT: ["Studio 30 minuti ogni giorno.", "Imparare una lingua richiede pazienza."],
};

const slugify = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// The original JSON files were saved through a Latin-1 round-trip. This repairs those strings once while retaining every source word.
const repairText = (value) => {
  if (typeof value !== "string" || !/[ÃÐÑðŸâÅ]/.test(value)) return value;
  const repaired = Buffer.from(value, "latin1").toString("utf8");
  return repaired.includes("�") ? value : repaired;
};

const repairValue = (value) => {
  if (typeof value === "string") return repairText(value);
  if (Array.isArray(value)) return value.map(repairValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, repairValue(entry)]));
  return value;
};

const createPack = (source, lang, masterWordIds, translations = null) => {
  let wordOffset = 0;
  return {
    version: 3,
    lang,
    level: "A1",
    topics: source.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      ...(topic.icon ? { icon: topic.icon } : {}),
      difficulty: difficultyMap[topic.difficulty] ?? 1,
      vocab: topic.vocab.map((word) => {
        const index = wordOffset;
        wordOffset += 1;
        const x = translations ? translations[index] : word.x;
        const id = masterWordIds[index] ?? `${topic.id}_${slugify(x)}`;
        return {
          id,
          de: word.de,
          x,
          ...(word.ex ? { ex: word.ex } : {}),
          ...(!translations && word.exTr ? { exTr: word.exTr } : {}),
          difficulty: difficultyMap[word.difficulty] ?? difficultyMap[topic.difficulty] ?? 1,
          tags: [slugify(topic.title)],
        };
      }),
    })),
    sentences: source.sentences.map((sentence, index) => ({
      id: `sent_${String(index + 1).padStart(3, "0")}`,
      de: sentence.de,
      x: sentenceTranslations[lang][index],
      translations: { [lang.toLowerCase()]: sentenceTranslations[lang][index] },
    })),
  };
};

const readLegacyPack = async (fileName) => repairValue(JSON.parse(await readFile(path.join(sourceDirectory, fileName), "utf8")));

const enSource = await readLegacyPack("en.json");
const enWordIds = enSource.topics.flatMap((topic) => topic.vocab.map((word) => `${topic.id}_${slugify(word.x)}`));
const packs = {};
for (const [lang, fileName] of Object.entries(languageFiles)) {
  packs[lang] = createPack(await readLegacyPack(`${fileName}.json`), lang, enWordIds);
}
packs.IT = createPack(enSource, "IT", enWordIds, italianTranslations);

for (const [lang, pack] of Object.entries(packs)) {
  const directory = path.join(outputDirectory, lang.toLowerCase());
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "a1.json"), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
}
await mkdir(masterDirectory, { recursive: true });
await writeFile(path.join(masterDirectory, "a1.json"), `${JSON.stringify(packs.EN, null, 2)}\n`, "utf8");

console.log("A1 packs written for EN, ES, FR, RU and IT.");
