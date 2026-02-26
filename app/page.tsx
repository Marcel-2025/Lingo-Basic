"use client";

import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// TYPEN & INTERFACES
// ==========================================
interface VocabItem {
  de: string;
  x: string;
  ex?: string;
  exTr?: string;
}

interface SentenceItem {
  de: string;
  x: string;
}

interface TopicItem {
  id: string;
  title: string;
  icon?: string;
  level?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  vocab: VocabItem[];
}

interface LanguagePack {
  version: number;
  lang: string;
  level: string;
  vocab?: VocabItem[];
  topics?: TopicItem[];
  sentences?: SentenceItem[];
}

interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  learnedWords: number;
  masteredWords: number;
  correctAnswers: number;
  totalAnswers: number;
}

interface AppSettings {
  targetLang: string;
  difficulty: string;
  dailyGoal: number;
  theme: 'Ocean' | 'Sunset' | 'Lime' | 'Grape';
  isDarkMode: boolean;
}

interface AuthUser {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
}

// ==========================================
// INDEXEDDB HELPER (Offline Storage)
// ==========================================
const DB_NAME = 'LingoDB';
const STORE_NAME = 'packs';
const PUBLIC_PACKS_PATH = '/packs';
const PACK_FILE_BY_LANG: Record<string, string> = {
  EN: 'en.json',
  ES: 'es.json',
  FR: 'fr.json',
  RU: 'ru.json',
};

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'lang' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const savePackToDB = async (pack: LanguagePack) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(pack);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
};

const getPackFromDB = async (lang: string): Promise<LanguagePack | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(lang);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const deletePackFromDB = async (lang: string) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(lang);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
};

const fetchPackFromPublicFolder = async (lang: string): Promise<LanguagePack | null> => {
  const fileName = PACK_FILE_BY_LANG[lang];
  if (!fileName) return null;

  try {
    const response = await fetch(`${PUBLIC_PACKS_PATH}/${fileName}`, { cache: 'no-store' });
    if (!response.ok) return null;

    const pack = normalizePack((await response.json()) as LanguagePack);
    if (!pack) return null;

    return pack;
  } catch {
    return null;
  }
};


const getVocabFromPack = (pack: LanguagePack | null): VocabItem[] => {
  if (!pack) return [];
  if (Array.isArray(pack.topics) && pack.topics.length > 0) {
    return pack.topics.flatMap(topic => topic.vocab || []);
  }
  return Array.isArray(pack.vocab) ? pack.vocab : [];
};

const getTopicsFromPack = (pack: LanguagePack | null): TopicItem[] => {
  if (!pack) return [];
  if (Array.isArray(pack.topics) && pack.topics.length > 0) return pack.topics;

  const fallbackVocab = Array.isArray(pack.vocab) ? pack.vocab : [];
  if (fallbackVocab.length === 0) return [];

  return [{
    id: 'all',
    title: 'Allgemein',
    icon: '📘',
    level: pack.level,
    difficulty: 'easy',
    vocab: fallbackVocab,
  }];
};

const normalizePack = (pack: LanguagePack): LanguagePack | null => {
  const hasLegacyVocab = Array.isArray(pack?.vocab) && pack.vocab.length > 0;
  const hasTopics = Array.isArray(pack?.topics) && pack.topics.length > 0;
  if (!pack?.lang || (!hasLegacyVocab && !hasTopics)) return null;
  return {
    ...pack,
    vocab: hasLegacyVocab ? pack.vocab : undefined,
    topics: hasTopics ? pack.topics : undefined,
    sentences: Array.isArray(pack.sentences) ? pack.sentences : [],
  };
};

// ==========================================
// HAUPTKOMPONENTE (APP)
// ==========================================
export default function LingoApp() {
  const [activeTab, setActiveTab] = useState<'heute' | 'uebungen' | 'profil' | 'settings'>('heute');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // States
  const [stats, setStats] = useState<UserStats>({
    xp: 0, level: 1, streak: 0, lastActiveDate: '',
    learnedWords: 0, masteredWords: 0, correctAnswers: 0, totalAnswers: 0
  });
  
  const [settings, setSettings] = useState<AppSettings>({
    targetLang: 'EN', difficulty: 'Beginner', dailyGoal: 20, theme: 'Ocean', isDarkMode: false
  });
  
  const [currentPack, setCurrentPack] = useState<LanguagePack | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Init & Load Data
  useEffect(() => {
    const savedStats = localStorage.getItem('lingoStats');
    const savedSettings = localStorage.getItem('lingoSettings');
    
    if (savedStats) {
      const parsedStats = JSON.parse(savedStats);
      checkStreak(parsedStats);
    }
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    const savedAuthUser = localStorage.getItem('lingoAuthUser');
    if (savedAuthUser) setAuthUser(JSON.parse(savedAuthUser));
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('lingoStats', JSON.stringify(stats));
      localStorage.setItem('lingoSettings', JSON.stringify(settings));
    }
  }, [stats, settings, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      loadPack(settings.targetLang);
    }
  }, [settings.targetLang, isLoaded]);

  useEffect(() => {
    localStorage.setItem('lingoAuthUser', JSON.stringify(authUser));
  }, [authUser]);

  useEffect(() => {
    if (!isAuthOpen || !GOOGLE_CLIENT_ID || !isAuthConfigured()) return;
    if (typeof window === 'undefined') return;

    const scriptId = 'google-identity-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [isAuthOpen]);

  const checkStreak = (currentStats: UserStats) => {
    const today = new Date().toDateString();
    if (currentStats.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      let newStreak = currentStats.streak;
      if (currentStats.lastActiveDate === yesterday.toDateString()) {
        // Streak keeps going later when XP is added
      } else if (currentStats.lastActiveDate !== '') {
        newStreak = 0; // Streak lost
      }
      setStats({ ...currentStats, streak: newStreak, lastActiveDate: today });
    } else {
      setStats(currentStats);
    }
  };

  const loadPack = async (lang: string) => {
    const cachedPack = await getPackFromDB(lang);
    if (cachedPack) {
      setCurrentPack(cachedPack);
      return;
    }

    const publicPack = await fetchPackFromPublicFolder(lang);
    if (publicPack) {
      await savePackToDB(publicPack);
      setCurrentPack(publicPack);
      return;
    }

    setCurrentPack(null);
  };

  // Gamification Logic
  const addXP = (amount: number, isCorrect: boolean = true) => {
    setStats(prev => {
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
      const today = new Date().toDateString();
      const newStreak = prev.lastActiveDate !== today && prev.xp > 0 ? prev.streak + 1 : prev.streak || 1;
      
      return {
        ...prev,
        xp: newXP,
        level: newLevel,
        streak: newStreak,
        lastActiveDate: today,
        learnedWords: prev.learnedWords + (isCorrect ? 1 : 0),
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
        totalAnswers: prev.totalAnswers + 1
      };
    });
  };

  const speak = (text: string, langCode: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    // Map internal codes to BCP 47
    const langMap: Record<string, string> = { 'DE': 'de-DE', 'EN': 'en-US', 'ES': 'es-ES', 'FR': 'fr-FR', 'RU': 'ru-RU' };
    utterance.lang = langMap[langCode] || langMap[settings.targetLang] || 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const getThemeClasses = () => {
    const base = settings.isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900';
    let gradient = '';
    switch(settings.theme) {
      case 'Ocean': gradient = 'from-blue-500 to-cyan-400'; break;
      case 'Sunset': gradient = 'from-orange-500 to-red-500'; break;
      case 'Lime': gradient = 'from-green-500 to-lime-400'; break;
      case 'Grape': gradient = 'from-purple-500 to-pink-500'; break;
    }
    return { base, gradient };
  };

  const handleEmailAuth = async () => {
    if (!isAuthConfigured()) {
      setAuthMsg('Firebase API Key fehlt. Bitte .env.local prüfen.');
      return;
    }
    if (!email || !password) {
      setAuthMsg('Bitte E-Mail und Passwort ausfüllen.');
      return;
    }

    try {
      setIsAuthLoading(true);
      const user = await authWithEmailAndPassword(email, password, isSignupMode);
      setAuthUser(user);
      setAuthMsg(`Willkommen ${user.displayName || user.email}!`);
      setIsAuthOpen(false);
      setPassword('');
    } catch (error) {
      setAuthMsg(`Login fehlgeschlagen: ${(error as Error).message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!isAuthConfigured() || !GOOGLE_CLIENT_ID) {
      setAuthMsg('Google Login benötigt NEXT_PUBLIC_GOOGLE_CLIENT_ID (Firebase API Key ist bereits gesetzt).');
      return;
    }
    const googleApi = (window as any).google;
    if (!googleApi?.accounts?.id) {
      setAuthMsg('Google SDK lädt noch. Bitte in 2-3 Sekunden erneut klicken.');
      return;
    }

    try {
      setIsAuthLoading(true);
      await new Promise<void>((resolve, reject) => {
        googleApi.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: { credential?: string }) => {
            try {
              if (!response.credential) throw new Error('GOOGLE_CREDENTIAL_MISSING');
              const user = await authWithGoogleCredential(response.credential);
              setAuthUser(user);
              setAuthMsg(`Willkommen ${user.displayName || user.email}!`);
              setIsAuthOpen(false);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        googleApi.accounts.id.prompt();
      });
    } catch (error) {
      setAuthMsg(`Google Login fehlgeschlagen: ${(error as Error).message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = () => {
    setAuthUser(null);
    setAuthMsg('Du wurdest ausgeloggt.');
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center">Lade Lingo...</div>;

  const { base, gradient } = getThemeClasses();

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${base}`}>
      {/* HEADER */}
      <header className={`p-4 text-white shadow-md bg-gradient-to-r ${gradient} rounded-b-3xl`}>
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center space-x-2 font-bold text-xl">
            <span className="text-3xl">🦉</span>
            <span>Lingo</span>
          </div>
          <div className="flex space-x-4 font-semibold">
            {authUser ? (
              <button onClick={logout} className="flex items-center bg-white/20 px-2 py-1 rounded-lg">👤 {authUser.email}</button>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className="flex items-center bg-white/20 px-2 py-1 rounded-lg">Login</button>
            )}
            <div className="flex items-center">🔥 {stats.streak}</div>
            <div className="flex items-center">⭐ {stats.xp} XP</div>
            <div className="flex items-center bg-white/20 px-2 py-1 rounded-lg">Lvl {stats.level}</div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-2xl mx-auto p-4 overflow-y-auto pb-24">
        {!currentPack && activeTab !== 'settings' ? (
          <div className="text-center mt-20">
            <h2 className="text-2xl font-bold mb-4">Kein Sprachpaket gefunden!</h2>
            <p className="mb-6 opacity-80">Bitte lade ein Sprachpaket in den Einstellungen herunter.</p>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-3 rounded-xl text-white font-bold bg-gradient-to-r ${gradient} shadow-lg`}
            >
              Zu den Einstellungen
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'heute' && <TabHeute pack={currentPack!} speak={speak} addXP={addXP} gradient={gradient} isPremiumUser={true} />}
            {activeTab === 'uebungen' && <TabUebungen pack={currentPack!} speak={speak} addXP={addXP} gradient={gradient} />}
            {activeTab === 'profil' && <TabProfil stats={stats} gradient={gradient} />}
            {activeTab === 'settings' && <TabSettings settings={settings} setSettings={setSettings} onPackChange={() => loadPack(settings.targetLang)} gradient={gradient} />}
          </>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className={`fixed bottom-0 w-full p-4 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] ${settings.isDarkMode ? 'bg-gray-800' : ''}`}>
        <div className="flex justify-around max-w-2xl mx-auto">
          <NavButton icon="📚" label="Heute" isActive={activeTab === 'heute'} onClick={() => setActiveTab('heute')} gradient={gradient} />
          <NavButton icon="🎮" label="Übungen" isActive={activeTab === 'uebungen'} onClick={() => setActiveTab('uebungen')} gradient={gradient} />
          <NavButton icon="👤" label="Profil" isActive={activeTab === 'profil'} onClick={() => setActiveTab('profil')} gradient={gradient} />
          <NavButton icon="⚙️" label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} gradient={gradient} />
        </div>
      </nav>

      {isAuthOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 text-gray-900 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">{isSignupMode ? 'Registrieren' : 'Einloggen'}</h3>
            <p className="text-sm opacity-70 mb-4">Mit E-Mail/Passwort oder Google anmelden.</p>
            <div className="space-y-3">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-Mail" className="w-full p-3 rounded-xl bg-gray-100 outline-none" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Passwort" className="w-full p-3 rounded-xl bg-gray-100 outline-none" />
              <button disabled={isAuthLoading} onClick={handleEmailAuth} className={`w-full py-3 rounded-xl text-white font-bold bg-gradient-to-r ${gradient}`}>
                {isAuthLoading ? 'Bitte warten...' : (isSignupMode ? 'Account erstellen' : 'Mit E-Mail einloggen')}
              </button>
              <button disabled={isAuthLoading} onClick={handleGoogleAuth} className="w-full py-3 rounded-xl font-bold bg-gray-100">
                Mit Google einloggen
              </button>
              <button onClick={() => setIsSignupMode(!isSignupMode)} className="w-full text-sm text-indigo-600 font-bold">
                {isSignupMode ? 'Schon einen Account? Jetzt einloggen' : 'Noch kein Account? Jetzt registrieren'}
              </button>
              <button onClick={() => setIsAuthOpen(false)} className="w-full text-sm opacity-70">Schließen</button>
              {authMsg && <p className="text-xs font-bold text-center text-indigo-600">{authMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// KOMPONENTEN FÜR TABS
// ==========================================

function TabHeute({ pack, speak, addXP, gradient, isPremiumUser }: any) {
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState('all');

  const topics = getTopicsFromPack(pack);

  const buildQueueForTopic = (topicId: string) => {
    const topicVocab = topicId === 'all'
      ? getVocabFromPack(pack)
      : topics.find(topic => topic.id === topicId)?.vocab || [];

    const shuffled = [...topicVocab].sort(() => 0.5 - Math.random());
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    const hasAllTopic = topics.some(topic => topic.id === 'all');
    const defaultTopicId = hasAllTopic ? 'all' : (topics[0]?.id || 'all');
    setSelectedTopicId(defaultTopicId);
    buildQueueForTopic(defaultTopicId);
  }, [pack]);

  useEffect(() => {
    buildQueueForTopic(selectedTopicId);
  }, [selectedTopicId]);

  if (queue.length === 0) return <div>Lade Karten...</div>;

  const card = queue[currentIndex];

  if (!card) {
    if (isPremiumUser) {
      return (
        <div className="text-center mt-20">
          <h2 className="text-3xl font-bold mb-2">Weiter geht's! 🚀</h2>
          <p className="opacity-80 mb-6">Als Premium lernst du ohne Limit. Starte einfach die nächste Runde.</p>
          <button onClick={() => buildQueueForTopic(selectedTopicId)} className={`px-6 py-3 rounded-xl text-white font-bold bg-gradient-to-r ${gradient}`}>
            Nächste Runde starten
          </button>
        </div>
      );
    }

    return (
      <div className="text-center mt-20 animate-bounce">
        <h2 className="text-3xl font-bold mb-2">Tagesziel erreicht! 🎉</h2>
        <p>Komm morgen wieder für mehr XP.</p>
      </div>
    );
  }

  const handleAnswer = (known: boolean) => {
    addXP(known ? 10 : 2, known);
    setIsFlipped(false);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length && isPremiumUser) {
      buildQueueForTopic(selectedTopicId);
      return;
    }

    setCurrentIndex(nextIndex);
    if ('vibrate' in navigator) navigator.vibrate(known ? [50, 50] : [100]);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full mt-6">
      <div className="w-full mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedTopicId('all')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold ${selectedTopicId === 'all' ? `text-white bg-gradient-to-r ${gradient}` : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            🌍 Alle Themen
          </button>
          {topics.filter(topic => topic.id !== 'all').map(topic => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopicId(topic.id)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold ${selectedTopicId === topic.id ? `text-white bg-gradient-to-r ${gradient}` : 'bg-white text-gray-700 border border-gray-200'}`}
            >
              {topic.icon || '📘'} {topic.title}
            </button>
          ))}
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className={`h-2.5 rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${(currentIndex / queue.length) * 100}%` }}></div>
        </div>
      </div>

      <div
        className={`w-full max-w-md min-h-[300px] p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-500 transform ${isFlipped ? 'bg-white border-2 border-indigo-200' : 'bg-white'} text-gray-900`}
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <div className="text-gray-400 mb-2 uppercase tracking-widest text-sm font-bold">Deutsch</div>
        <h2 className="text-3xl font-bold mb-4">{card.de}</h2>

        {isFlipped ? (
          <div className="animate-fade-in mt-6 pt-6 border-t border-gray-100 w-full">
            <div className="text-indigo-400 mb-2 uppercase tracking-widest text-sm font-bold">Zielsprache</div>
            <h2 className="text-3xl font-bold text-indigo-600 mb-4">{card.x}</h2>
            {card.ex && (
              <div className="mt-4 p-4 bg-indigo-50 rounded-xl italic opacity-90 text-sm text-gray-900">
                <p>{card.ex}</p>
                <p className="mt-1 font-semibold">{card.exTr}</p>
              </div>
            )}
            <div className="flex space-x-4 mt-6 justify-center">
              <button onClick={(e) => { e.stopPropagation(); speak(card.de, 'DE'); }} className="p-3 bg-indigo-50 rounded-full text-xl hover:scale-110 transition text-gray-900">🇩🇪 🔊</button>
              <button onClick={(e) => { e.stopPropagation(); speak(card.x, pack.lang); }} className="p-3 bg-indigo-50 rounded-full text-xl hover:scale-110 transition text-gray-900">🎯 🔊</button>
            </div>
          </div>
        ) : (
          <p className="mt-10 opacity-50 animate-pulse">Tippe zum Aufdecken</p>
        )}
      </div>

      {isFlipped && (
        <div className="flex space-x-4 mt-8 w-full max-w-md">
          <button onClick={() => handleAnswer(false)} className="flex-1 py-4 rounded-2xl font-bold bg-red-100 text-red-700 hover:bg-red-200 transition">Noch üben</button>
          <button onClick={() => handleAnswer(true)} className={`flex-1 py-4 rounded-2xl font-bold text-white bg-gradient-to-r ${gradient} shadow-lg hover:opacity-90 transition`}>Gewusst</button>
        </div>
      )}
    </div>
  );
}

function TabUebungen({ pack, addXP, gradient }: any) {
  const [questionCode, setQuestionCode] = useState<VocabItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const playFeedbackTone = (success: boolean) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = success ? 'sine' : 'sawtooth';
    oscillator.frequency.value = success ? 740 : 220;

    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.24);

    oscillator.onended = () => {
      ctx.close().catch(() => undefined);
    };
  };

  const generateQuestion = () => {
    const vocab = getVocabFromPack(pack);
    if (vocab.length < 4) return;
    const shuffled = [...vocab].sort(() => 0.5 - Math.random());
    const correct = shuffled[0];
    const wrongs = shuffled.slice(1, 4).map(v => v.x);
    const allOptions = [correct.x, ...wrongs].sort(() => 0.5 - Math.random());

    setQuestionCode(correct);
    setOptions(allOptions);
    setSelectedOption(null);
    setIsAnswerCorrect(null);
    setIsLocked(false);
  };

  useEffect(() => { generateQuestion(); }, [pack]);

  const handleSelect = (opt: string) => {
    if (isLocked || !questionCode) return;

    setSelectedOption(opt);
    const correct = opt === questionCode.x;
    setIsAnswerCorrect(correct);
    setIsLocked(true);

    if (correct) {
      addXP(15, true);
      if ('vibrate' in navigator) navigator.vibrate([30, 30]);
    } else {
      addXP(0, false);
      if ('vibrate' in navigator) navigator.vibrate([120]);
    }

    playFeedbackTone(correct);
    window.setTimeout(() => {
      generateQuestion();
    }, 900);
  };

  const getOptionClasses = (opt: string) => {
    if (!isLocked || !questionCode) {
      return 'bg-white text-gray-900 border-transparent hover:border-indigo-400';
    }

    if (opt === questionCode.x) {
      return 'bg-green-100 text-green-800 border-green-400';
    }

    if (opt === selectedOption && opt !== questionCode.x) {
      return 'bg-red-100 text-red-800 border-red-400';
    }

    return 'bg-white/70 text-gray-500 border-transparent';
  };

  if (!questionCode) return <div>Paket benötigt mind. 4 Vokabeln für Multiple Choice.</div>;

  return (
    <div className="mt-6 flex flex-col items-center">
      <h2 className="text-xl font-bold opacity-70 mb-8 uppercase tracking-wider">Welches Wort passt?</h2>

      <div className="text-4xl font-extrabold mb-6 text-center break-words w-full">
        {questionCode.de}
      </div>

      {isLocked && (
        <p className={`mb-6 text-sm font-bold ${isAnswerCorrect ? 'text-green-700' : 'text-red-700'}`}>
          {isAnswerCorrect ? 'Richtig! Stark gemacht ✅' : `Nicht ganz. Richtig ist: ${questionCode.x}`}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 w-full max-w-md">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(opt)}
            className="p-5 text-lg font-semibold bg-white text-gray-900 rounded-2xl shadow-sm border-2 border-transparent hover:border-indigo-400 active:scale-95 transition-all"
          >
            {opt}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs opacity-60">Antwort-Farben: Grün = richtig, Rot = falsch</p>
    </div>
  );
}

function TabProfil({ stats, gradient }: any) {
  const accuracy = stats.totalAnswers === 0 ? 0 : Math.round((stats.correctAnswers / stats.totalAnswers) * 100);
  
  return (
    <div className="mt-4 space-y-6">
      <div className="text-center">
        <div className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-r ${gradient} flex items-center justify-center text-5xl text-white shadow-xl mb-4 border-4 border-white`}>
          🦉
        </div>
        <h2 className="text-3xl font-bold">Level {stats.level}</h2>
        <p className="opacity-70 mt-1">Sprachmeister in Ausbildung</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatBox title="XP Gesamt" value={stats.xp} icon="⭐" />
        <StatBox title="Tages-Streak" value={stats.streak} icon="🔥" />
        <StatBox title="Gelernte Wörter" value={stats.learnedWords} icon="📚" />
        <StatBox title="Genauigkeit" value={`${accuracy}%`} icon="🎯" />
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm mt-6 text-gray-900">
        <h3 className="font-bold text-lg mb-4">Achievements</h3>
        <ul className="space-y-3">
          <Achievement name="Erster Schritt" done={stats.xp > 0} />
          <Achievement name="Feuer & Flamme" done={stats.streak >= 7} subtitle="7 Tage Streak" />
          <Achievement name="Wortschatz" done={stats.learnedWords >= 100} subtitle="100 Wörter gelernt" />
        </ul>
      </div>
    </div>
  );
}

function TabSettings({ settings, setSettings, onPackChange, gradient }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  const updateSetting = (key: keyof AppSettings, val: any) => {
    setSettings({ ...settings, [key]: val });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = normalizePack(JSON.parse(event.target?.result as string) as LanguagePack);
        if (!parsed) throw new Error('Invalid pack');
        await savePackToDB(parsed);
        setMsg(`Paket ${parsed.lang} erfolgreich geladen!`);
        onPackChange();
      } catch (err) {
        setMsg('Fehler beim Lesen der JSON-Datei.');
      }
    };
    reader.readAsText(file);
  };

  const loadFromURL = async () => {
    try {
      setMsg('Lade...');
      const res = await fetch(url);
      const parsed = normalizePack(await res.json() as LanguagePack);
      if (!parsed) throw new Error('Invalid pack');
      await savePackToDB(parsed);
      setMsg(`Paket ${parsed.lang} heruntergeladen!`);
      onPackChange();
    } catch (err) {
      setMsg('Fehler beim Download der URL.');
    }
  };

  const loadFromProjectFolder = async () => {
    const fileName = PACK_FILE_BY_LANG[settings.targetLang];
    if (!fileName) {
      setMsg(`Für ${settings.targetLang} ist keine Datei in /public/packs hinterlegt.`);
      return;
    }

    try {
      setMsg(`Lade ${fileName} aus /public/packs ...`);
      const response = await fetch(`${PUBLIC_PACKS_PATH}/${fileName}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Datei nicht gefunden');

      const parsed = normalizePack((await response.json()) as LanguagePack);
      if (!parsed) throw new Error('Invalid pack');
      await savePackToDB(parsed);
      setMsg(`Paket ${parsed.lang} aus /public/packs geladen.`);
      onPackChange();
    } catch {
      setMsg(`Konnte ${fileName} in /public/packs nicht laden.`);
    }
  };

  const clearCache = async () => {
    await deletePackFromDB(settings.targetLang);
    setMsg(`${settings.targetLang} Paket gelöscht.`);
    onPackChange();
  };

  return (
    <div className="mt-4 space-y-6 pb-10">
      <h2 className="text-3xl font-bold mb-6">Einstellungen</h2>

      <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 text-gray-900">
        <div>
          <label className="block text-sm font-bold opacity-70 mb-2">Zielsprache (für Pack)</label>
          <select 
            className="w-full p-3 rounded-xl bg-gray-100 outline-none text-gray-900"
            value={settings.targetLang}
            onChange={(e) => { updateSetting('targetLang', e.target.value); onPackChange(); }}
          >
            <option value="EN">Englisch</option>
            <option value="ES">Spanisch</option>
            <option value="FR">Französisch</option>
            <option value="RU">Russisch</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold opacity-70 mb-2">Farbschema</label>
          <div className="flex space-x-2">
            {['Ocean', 'Sunset', 'Lime', 'Grape'].map(t => (
              <button 
                key={t}
                onClick={() => updateSetting('theme', t)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold ${settings.theme === t ? 'ring-2 ring-indigo-500' : 'opacity-50'} bg-gray-100 text-gray-900`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="font-bold opacity-70">Dark Mode</span>
          <button 
            onClick={() => updateSetting('isDarkMode', !settings.isDarkMode)}
            className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.isDarkMode ? `bg-gradient-to-r ${gradient}` : 'bg-gray-300'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${settings.isDarkMode ? 'translate-x-6' : ''}`}></div>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 text-gray-900">
        <h3 className="font-bold text-lg">Inhalte verwalten</h3>
        
        <div>
           <label className="block text-sm font-bold opacity-70 mb-2">Direkt aus /public/packs laden</label>
           <button onClick={loadFromProjectFolder} className={`w-full py-3 rounded-xl text-white font-bold bg-gradient-to-r ${gradient}`}>Pack für {settings.targetLang} laden</button>
           <p className="text-xs opacity-60 mt-2">Erwartete Datei: /public/packs/{PACK_FILE_BY_LANG[settings.targetLang] || 'nicht definiert'}</p>
        </div>

        <div>
           <label className="block text-sm font-bold opacity-70 mb-2">Aus JSON Datei importieren</label>
           <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
           <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-gray-100 rounded-xl font-semibold text-gray-900">Datei auswählen</button>
        </div>

        <div>
           <label className="block text-sm font-bold opacity-70 mb-2">Von URL importieren</label>
           <div className="flex space-x-2">
             <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="flex-1 p-3 rounded-xl bg-gray-100 outline-none text-gray-900" />
             <button onClick={loadFromURL} className={`px-4 rounded-xl text-white font-bold bg-gradient-to-r ${gradient}`}>Laden</button>
           </div>
        </div>
        
        {msg && <p className="text-sm font-bold text-green-500">{msg}</p>}

        <button onClick={clearCache} className="w-full py-3 mt-4 text-red-600 bg-red-50 rounded-xl font-bold">Zwischenspeicher löschen</button>
      </div>
    </div>
  );
}

// ==========================================
// KLEINERE UI HILFSKOMPONENTEN
// ==========================================

function NavButton({ icon, label, isActive, onClick, gradient }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${isActive ? `text-white bg-gradient-to-r ${gradient} shadow-lg -translate-y-2` : 'text-gray-500 hover:bg-gray-100'}`}>
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function StatBox({ title, value, icon }: any) {
  return (
    <div className="bg-white p-4 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center text-gray-900">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold opacity-50 uppercase mt-1">{title}</div>
    </div>
  );
}

function Achievement({ name, done, subtitle }: any) {
  return (
    <li className={`flex items-center p-3 rounded-2xl ${done ? 'bg-green-50' : 'opacity-40 grayscale'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mr-4 ${done ? 'bg-green-200' : 'bg-gray-200'}`}>
        {done ? '🏆' : '🔒'}
      </div>
      <div>
        <div className="font-bold">{name}</div>
        {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
      </div>
    </li>
  );
}
