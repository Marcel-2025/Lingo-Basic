import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPacksDirectory = path.join(root, "public", "packs");
const masterDirectory = path.join(root, "content", "master", "en");
const languages = ["EN", "ES", "FR", "RU", "IT"];

const levels = {
  A2: {
    sentences: [
      {
        id: "sent_001",
        de: "Ich möchte meine Meinung klar erklären.",
        translations: {
          EN: "I would like to explain my opinion clearly.",
          ES: "Me gustaría explicar mi opinión claramente.",
          FR: "Je voudrais expliquer clairement mon opinion.",
          RU: "Я хочу ясно объяснить своё мнение.",
          IT: "Vorrei spiegare chiaramente la mia opinione.",
        },
      },
      {
        id: "sent_002",
        de: "Am Wochenende gehe ich oft auf den Markt.",
        translations: {
          EN: "I often go to the market at the weekend.",
          ES: "A menudo voy al mercado el fin de semana.",
          FR: "Le week-end, je vais souvent au marché.",
          RU: "По выходным я часто хожу на рынок.",
          IT: "Nel fine settimana vado spesso al mercato.",
        },
      },
    ],
    topics: [
      {
        id: "daily_01",
        title: "Tagesablauf",
        icon: "⏰",
        difficulty: 1,
        vocab: [
          ["wake_up", "Aufwachen", "wake up", "despertarse", "se réveiller", "просыпаться", "svegliarsi"],
          ["have_breakfast", "Frühstücken", "have breakfast", "desayunar", "prendre le petit-déjeuner", "завтракать", "fare colazione"],
          ["get_dressed", "Sich anziehen", "get dressed", "vestirse", "s'habiller", "одеваться", "vestirsi"],
          ["cook", "Kochen", "cook", "cocinar", "cuisiner", "готовить", "cucinare"],
          ["tidy_up", "Aufräumen", "tidy up", "ordenar", "ranger", "убирать", "riordinare"],
          ["rest", "Sich ausruhen", "rest", "descansar", "se reposer", "отдыхать", "riposare"],
        ],
      },
      {
        id: "city_02",
        title: "Stadt & Nachbarschaft",
        icon: "🏙️",
        difficulty: 1,
        vocab: [
          ["intersection", "Kreuzung", "intersection", "cruce", "carrefour", "перекрёсток", "incrocio"],
          ["traffic_light", "Ampel", "traffic light", "semáforo", "feu de circulation", "светофор", "semaforo"],
          ["pavement", "Bürgersteig", "pavement", "acera", "trottoir", "тротуар", "marciapiede"],
          ["neighborhood", "Nachbarschaft", "neighborhood", "barrio", "quartier", "район", "quartiere"],
          ["library", "Bücherei", "library", "biblioteca", "bibliothèque", "библиотека", "biblioteca"],
          ["market", "Markt", "market", "mercado", "marché", "рынок", "mercato"],
        ],
      },
      {
        id: "communication_03",
        title: "Kommunikation",
        icon: "💬",
        difficulty: 1,
        vocab: [
          ["ask", "Fragen", "ask", "preguntar", "demander", "спрашивать", "chiedere"],
          ["answer", "Antworten", "answer", "responder", "répondre", "отвечать", "rispondere"],
          ["explain", "Erklären", "explain", "explicar", "expliquer", "объяснять", "spiegare"],
          ["agree", "Zustimmen", "agree", "estar de acuerdo", "être d'accord", "соглашаться", "essere d'accordo"],
          ["reject", "Ablehnen", "reject", "rechazar", "refuser", "отклонять", "rifiutare"],
          ["repeat", "Wiederholen", "repeat", "repetir", "répéter", "повторять", "ripetere"],
        ],
      },
      {
        id: "nature_04",
        title: "Natur & Wetter",
        icon: "🌦️",
        difficulty: 2,
        vocab: [
          ["weather", "Wetter", "weather", "tiempo", "météo", "погода", "tempo"],
          ["cloud", "Wolke", "cloud", "nube", "nuage", "облако", "nuvola"],
          ["wind", "Wind", "wind", "viento", "vent", "ветер", "vento"],
          ["forest", "Wald", "forest", "bosque", "forêt", "лес", "foresta"],
          ["river", "Fluss", "river", "río", "rivière", "река", "fiume"],
          ["mountain", "Berg", "mountain", "montaña", "montagne", "гора", "montagna"],
        ],
      },
      {
        id: "feelings_05",
        title: "Gefühle & Charakter",
        icon: "✨",
        difficulty: 2,
        vocab: [
          ["satisfied", "Zufrieden", "satisfied", "satisfecho", "satisfait", "довольный", "soddisfatto"],
          ["nervous", "Nervös", "nervous", "nervioso", "nerveux", "нервный", "nervoso"],
          ["surprised", "Überrascht", "surprised", "sorprendido", "surpris", "удивлённый", "sorpreso"],
          ["proud", "Stolz", "proud", "orgulloso", "fier", "гордый", "orgoglioso"],
          ["relaxed", "Entspannt", "relaxed", "relajado", "détendu", "расслабленный", "rilassato"],
          ["patient", "Geduldig", "patient", "paciente", "patient", "терпеливый", "paziente"],
        ],
      },
      {
        id: "education_06",
        title: "Lernen & Bildung",
        icon: "📚",
        difficulty: 2,
        vocab: [
          ["course", "Kurs", "course", "curso", "cours", "курс", "corso"],
          ["task", "Aufgabe", "task", "tarea", "tâche", "задание", "compito"],
          ["exam", "Prüfung", "exam", "examen", "examen", "экзамен", "esame"],
          ["practise", "Üben", "practise", "practicar", "s'entraîner", "тренироваться", "esercitarsi"],
          ["understand", "Verstehen", "understand", "comprender", "comprendre", "понимать", "capire"],
          ["progress", "Fortschreiten", "progress", "progresar", "progresser", "продвигаться", "progredire"],
        ],
      },
    ],
  },
  B1: {
    sentences: [
      {
        id: "sent_001",
        de: "Eine gute Lösung berücksichtigt verschiedene Perspektiven.",
        translations: {
          EN: "A good solution considers different perspectives.",
          ES: "Una buena solución tiene en cuenta diferentes perspectivas.",
          FR: "Une bonne solution tient compte de différentes perspectives.",
          RU: "Хорошее решение учитывает разные точки зрения.",
          IT: "Una buona soluzione tiene conto di prospettive diverse.",
        },
      },
      {
        id: "sent_002",
        de: "Wir sollten unsere Ressourcen verantwortungsvoll nutzen.",
        translations: {
          EN: "We should use our resources responsibly.",
          ES: "Deberíamos utilizar nuestros recursos de forma responsable.",
          FR: "Nous devrions utiliser nos ressources de manière responsable.",
          RU: "Мы должны ответственно использовать наши ресурсы.",
          IT: "Dovremmo usare le nostre risorse in modo responsabile.",
        },
      },
    ],
    topics: [
      {
        id: "career_01",
        title: "Beruf & Karriere",
        icon: "💼",
        difficulty: 2,
        vocab: [
          ["application", "Bewerbung", "application", "solicitud de empleo", "candidature", "заявление о приёме на работу", "candidatura"],
          ["responsibility", "Verantwortung", "responsibility", "responsabilidad", "responsabilité", "ответственность", "responsabilità"],
          ["experience", "Erfahrung", "experience", "experiencia", "expérience", "опыт", "esperienza"],
          ["decide", "Entscheiden", "decide", "decidir", "décider", "решать", "decidere"],
          ["negotiate", "Verhandeln", "negotiate", "negociar", "négocier", "вести переговоры", "negoziare"],
          ["reliable", "Zuverlässig", "reliable", "fiable", "fiable", "надёжный", "affidabile"],
        ],
      },
      {
        id: "society_02",
        title: "Gesellschaft",
        icon: "🤝",
        difficulty: 2,
        vocab: [
          ["community", "Gemeinschaft", "community", "comunidad", "communauté", "сообщество", "comunità"],
          ["equality", "Gleichberechtigung", "equality", "igualdad", "égalité", "равенство", "uguaglianza"],
          ["support", "Unterstützung", "support", "apoyo", "soutien", "поддержка", "sostegno"],
          ["volunteer", "Freiwilliger", "volunteer", "voluntario", "bénévole", "волонтёр", "volontario"],
          ["rule", "Regel", "rule", "regla", "règle", "правило", "regola"],
          ["trust", "Vertrauen", "trust", "confianza", "confiance", "доверие", "fiducia"],
        ],
      },
      {
        id: "travel_03",
        title: "Reisen & Erlebnisse",
        icon: "🧭",
        difficulty: 2,
        vocab: [
          ["itinerary", "Reiseroute", "itinerary", "itinerario", "itinéraire", "маршрут", "itinerario"],
          ["accommodation", "Unterkunft", "accommodation", "alojamiento", "hébergement", "жильё", "alloggio"],
          ["change_trains", "Umsteigen", "change trains", "hacer transbordo", "faire une correspondance", "делать пересадку", "fare un cambio"],
          ["discover", "Entdecken", "discover", "descubrir", "découvrir", "открывать", "scoprire"],
          ["recommend", "Empfehlen", "recommend", "recomendar", "recommander", "рекомендовать", "consigliare"],
          ["unforgettable", "Unvergesslich", "unforgettable", "inolvidable", "inoubliable", "незабываемый", "indimenticabile"],
        ],
      },
      {
        id: "opinion_04",
        title: "Meinungen & Argumente",
        icon: "💡",
        difficulty: 3,
        vocab: [
          ["opinion", "Meinung", "opinion", "opinión", "opinion", "мнение", "opinione"],
          ["claim", "Behaupten", "claim", "afirmar", "affirmer", "утверждать", "affermare"],
          ["justify", "Begründen", "justify", "justificar", "justifier", "обосновывать", "giustificare"],
          ["compare", "Vergleichen", "compare", "comparar", "comparer", "сравнивать", "confrontare"],
          ["influence", "Beeinflussen", "influence", "influir", "influencer", "влиять", "influenzare"],
          ["convince", "Überzeugen", "convince", "convencer", "convaincre", "убеждать", "convincere"],
        ],
      },
      {
        id: "environment_05",
        title: "Umwelt & Zukunft",
        icon: "🌱",
        difficulty: 3,
        vocab: [
          ["resource", "Ressource", "resource", "recurso", "ressource", "ресурс", "risorsa"],
          ["avoid", "Vermeiden", "avoid", "evitar", "éviter", "избегать", "evitare"],
          ["reuse", "Wiederverwenden", "reuse", "reutilizar", "réutiliser", "использовать повторно", "riutilizzare"],
          ["pollute", "Verschmutzen", "pollute", "contaminar", "polluer", "загрязнять", "inquinare"],
          ["sustainable", "Nachhaltig", "sustainable", "sostenible", "durable", "устойчивый", "sostenibile"],
          ["protect", "Schützen", "protect", "proteger", "protéger", "защищать", "proteggere"],
        ],
      },
      {
        id: "digital_06",
        title: "Digitaler Alltag",
        icon: "💻",
        difficulty: 3,
        vocab: [
          ["data_privacy", "Datenschutz", "data privacy", "privacidad de datos", "protection des données", "защита данных", "privacy dei dati"],
          ["notification", "Benachrichtigung", "notification", "notificación", "notification", "уведомление", "notifica"],
          ["download", "Herunterladen", "download", "descargar", "télécharger", "скачивать", "scaricare"],
          ["upload", "Hochladen", "upload", "subir", "téléverser", "загружать", "caricare"],
          ["update", "Aktualisieren", "update", "actualizar", "mettre à jour", "обновлять", "aggiornare"],
          ["password", "Passwort", "password", "contraseña", "mot de passe", "пароль", "password"],
        ],
      },
    ],
  },
};

const translationIndex = { EN: 2, ES: 3, FR: 4, RU: 5, IT: 6 };
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const createPack = (level, lang) => ({
  version: 3,
  lang,
  level,
  topics: levels[level].topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    icon: topic.icon,
    difficulty: topic.difficulty,
    vocab: topic.vocab.map((word) => ({
      id: `${topic.id}_${word[0]}`,
      de: word[1],
      x: word[translationIndex[lang]],
      difficulty: topic.difficulty,
      tags: [slugify(topic.title)],
    })),
  })),
  sentences: levels[level].sentences.map((sentence) => ({
    id: sentence.id,
    de: sentence.de,
    x: sentence.translations[lang],
    translations: { [lang.toLowerCase()]: sentence.translations[lang] },
  })),
});

for (const level of Object.keys(levels)) {
  for (const lang of languages) {
    const pack = createPack(level, lang);
    const directory = lang === "EN" ? masterDirectory : path.join(publicPacksDirectory, lang.toLowerCase());
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${level.toLowerCase()}.json`), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    if (lang === "EN") {
      const publicEnDirectory = path.join(publicPacksDirectory, "en");
      await mkdir(publicEnDirectory, { recursive: true });
      await writeFile(path.join(publicEnDirectory, `${level.toLowerCase()}.json`), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    }
  }
}

console.log("A2- und B1-Packs für EN, ES, FR, RU und IT wurden erstellt.");
