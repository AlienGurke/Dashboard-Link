// Texts, German and English (the browser's language picks; German is the fallback for "de").

const de = {
  title: "Dashboard-Link",
  intro: "Deine Spielzeit von 3DS Link – Software-Album, Statistiken und Rückblicke.",
  privacy: "Alles wird nur hier im Browser gelesen. Nichts wird hochgeladen.",
  drop: "Ordner „activity“ hierher ziehen",
  dropHint: "von der SD-Karte (sdmc:/3ds/3DS-Link/activity) – oder eine ZIP davon. Mehrere Konsolen: mehrere Ordner.",
  choose: "Ordner wählen",
  chooseZip: "ZIP wählen",
  reading: "Lese…",
  nothing: "In dem Ordner war kein Archiv von 3DS Link (playhistory.bin / pld.dat).",
  viewProfile: "Profil",
  viewClassic: "Klassisch",
  viewOverview: "Übersicht",
  soon: "kommt bald",
  other: "Anderen Ordner öffnen",
  hours: (h: number) => `${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std.`,
  hoursShort: (h: number) => `${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })} h`,
  recentGames: "Zuletzt gespielt",
  last2weeks: "letzte 2 Wochen",
  total: "insgesamt",
  lastPlayed: "zuletzt",
  firstPlayed: "zuerst",
  starts: "Starts",
  games: "Spiele",
  since: "seit",
  playtime: "Spielzeit",
  recentTotal: (h: string) => `${h} in den letzten 2 Wochen`,
  allGames: "Alle Spiele",
  sortTime: "Spielzeit",
  sortLast: "Zuletzt gespielt",
  sortName: "Name",
  showSystem: "Systemprogramme zeigen",
  nothingRecent: "In den letzten 2 Wochen nicht gespielt.",
  unknownDate: "Datum unbekannt",
  noteLabel: "Hinweis",
  renameHint: "Klicken: eigenen Namen geben (z. B. „(Free-to-Play)“) – bleibt nur in diesem Browser",
  renamePrompt: (n: string) => `Eigener Name für „${n}“ (leer = Originalname):`,
};

const en: typeof de = {
  ...de,
  intro: "Your play time from 3DS Link – software album, statistics and recaps.",
  privacy: "Everything is read here in the browser only. Nothing is uploaded.",
  drop: "Drop the “activity” folder here",
  dropHint: "from the SD card (sdmc:/3ds/3DS-Link/activity) – or a ZIP of it. Several consoles: several folders.",
  choose: "Choose folder",
  chooseZip: "Choose ZIP",
  reading: "Reading…",
  nothing: "No 3DS Link archive in that folder (playhistory.bin / pld.dat).",
  viewProfile: "Profile",
  viewClassic: "Classic",
  viewOverview: "Overview",
  soon: "coming soon",
  other: "Open another folder",
  hours: (h: number) => `${h.toLocaleString("en", { maximumFractionDigits: 1 })} hrs`,
  hoursShort: (h: number) => `${h.toLocaleString("en", { maximumFractionDigits: 1 })} h`,
  recentGames: "Recently played",
  last2weeks: "past 2 weeks",
  total: "total",
  lastPlayed: "last",
  firstPlayed: "first",
  starts: "Starts",
  games: "Games",
  since: "since",
  playtime: "Play time",
  recentTotal: (h: string) => `${h} in the past 2 weeks`,
  allGames: "All games",
  sortTime: "Play time",
  sortLast: "Last played",
  sortName: "Name",
  showSystem: "Show system programs",
  nothingRecent: "Not played in the past 2 weeks.",
  unknownDate: "date unknown",
  noteLabel: "Note",
  renameHint: "Click: give it your own name (e.g. “(free-to-play)”) – kept in this browser only",
  renamePrompt: (n: string) => `Your own name for “${n}” (empty = original name):`,
};

export const lang = (navigator.language || "de").toLowerCase().startsWith("de") ? "de" : "en";
export const T = lang === "de" ? de : en;
/** SMDH language for names: 3 German, 1 English */
export const smdhLang = lang === "de" ? 3 : 1;

export function fmtDate(min: number): string {
  if (!Number.isFinite(min)) return T.unknownDate;
  const d = new Date(Date.UTC(2000, 0, 1) + min * 60000);
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}
