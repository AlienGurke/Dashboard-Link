// Everything read from one or more activity folders, put together.

import {
  readClock, readConsole, readIconCache, readSmdh, readPlayHistory, readPld, readSteps,
} from "./formats.ts";
import type { ConsoleInfo, LibraryEntry, StepDay, Tid, TitleInfo } from "./formats.ts";
import { correctTimes, sessionsFromHours, sessionsFromLog } from "./timeline.ts";
import type { Session } from "./timeline.ts";

/** the files of one activity folder, by name */
export type FolderFiles = Map<string, ArrayBuffer>;

export interface Source {
  console: ConsoleInfo;
  /** first minute the play log covers */
  logFrom: number;
  /** the Activity Log app (pld.dat) has everything before this; after it, the play log */
  pldEnd: number;
  library: LibraryEntry[];
  steps: StepDay[];
}

export interface Dataset {
  sources: Source[];
  /** what the totals are made of: the Activity Log app's hours, then the play log after them */
  sessions: Session[];
  /** every session of the play log, to the minute (for lists of sessions, records, time of day) */
  logSessions: Session[];
  titles: Map<Tid, TitleInfo>;
  /** problems that did not stop reading (shown, not hidden) */
  notes: string[];
}

const txt = (b: ArrayBuffer | undefined) => (b ? new TextDecoder().decode(b) : "");

export function readFolder(files: FolderFiles, lang: number, now = nowMinutes()): { source: Source; sessions: Session[]; logSessions: Session[]; titles: Map<Tid, TitleInfo>; notes: string[] } {
  const notes: string[] = [];
  const consoleInfo = readConsole(txt(files.get("console.txt")) || "name=3DS");
  const id = consoleInfo.id || consoleInfo.name;
  // What the Activity Log app knows (pld.dat) is taken as it is - the same numbers as on the
  // 3DS. The play log adds what came after the app last took it in, minute by minute.
  const sessions: Session[] = [];
  let library: LibraryEntry[] = [];
  let pldEnd = -Infinity; // the app has taken in everything before this
  const pld = files.get("pld.dat");
  if (pld) {
    try {
      const p = readPld(pld);
      library = p.library;
      const hours = sessionsFromHours(p.hours, now, id);
      for (const h of hours) if (!Number.isNaN(h.start)) pldEnd = Math.max(pldEnd, h.start + 60);
      sessions.push(...hours);
    } catch (e) { notes.push(String(e)); }
  }
  let logFrom = Infinity;
  const logSessions: Session[] = [];
  const ph = files.get("playhistory.bin");
  if (ph) {
    const log = readPlayHistory(ph);
    const t = correctTimes(log, readClock(txt(files.get("clock.txt"))));
    for (let i = 0; i < t.length; i++) if (!Number.isNaN(t[i])) { logFrom = t[i]; break; }
    for (const s of sessionsFromLog(log, t, id)) {
      logSessions.push(s);
      // without pld.dat everything; with it only what the app has not taken in yet
      if (!pld || (!Number.isNaN(s.start) && s.start >= pldEnd)) sessions.push(s);
    }
  } else notes.push("playhistory.bin fehlt");
  let steps: StepDay[] = [];
  const st = files.get("steps.bin");
  if (st) { try { steps = readSteps(st); } catch (e) { notes.push(String(e)); } }
  let titles = new Map<Tid, TitleInfo>();
  const idbt = files.get("idbt.dat"), idb = files.get("idb.dat");
  if (idbt && idb) titles = readIconCache(idbt, idb, lang);
  // icons/<title id>.smdh: titles the icon cache does not have (homebrew and the like)
  for (const [file, buf] of files) {
    const m = /^([0-9a-f]{16})\.smdh$/i.exec(file);
    if (!m || titles.has(m[1].toUpperCase())) continue;
    const info = readSmdh(m[1].toUpperCase(), buf, lang);
    if (info) titles.set(info.tid, info);
  }
  return { source: { console: consoleInfo, logFrom, pldEnd, library, steps }, sessions, logSessions, titles, notes };
}

export function combine(folders: FolderFiles[], lang: number): Dataset {
  const ds: Dataset = { sources: [], sessions: [], logSessions: [], titles: new Map(), notes: [] };
  for (const f of folders) {
    const r = readFolder(f, lang);
    ds.sources.push(r.source);
    ds.sessions.push(...r.sessions);
    ds.logSessions.push(...r.logSessions);
    ds.notes.push(...r.notes);
    for (const [k, v] of r.titles) {
      const prev = ds.titles.get(k);
      if (!prev || prev.seen < v.seen) ds.titles.set(k, v);
    }
  }
  return ds;
}

// ------------------------------------------------------------------ statistics

export interface TitleStats {
  tid: Tid;
  minutes: number;
  launches: number;
  first: number;
  last: number;
  /** minutes in the chosen recent window */
  recent: number;
  sessions: number;
}

export const isSystem = (tid: Tid) => tid.startsWith("00040010") || tid.startsWith("00040030");

/** per title; `since`: start of the recent window (minutes since 2000) */
export function titleStats(ds: Dataset, since: number): Map<Tid, TitleStats> {
  const out = new Map<Tid, TitleStats>();
  for (const s of ds.sessions) {
    let g = out.get(s.tid);
    if (!g) { g = { tid: s.tid, minutes: 0, launches: 0, first: Infinity, last: -Infinity, recent: 0, sessions: 0 }; out.set(s.tid, g); }
    g.minutes += s.minutes;
    if (s.launch) g.launches++;
    if (s.kind !== "3ds-hours") g.sessions++;
    if (!Number.isNaN(s.start)) {
      g.first = Math.min(g.first, s.start);
      g.last = Math.max(g.last, s.start);
      if (s.start >= since) g.recent += s.minutes;
    }
  }
  // the Activity Log app's own totals (its software library) are what the 3DS shows: they
  // replace the sum of its hours (a few minutes apart at times); starts only it counts
  for (const src of ds.sources) {
    const hourSum = new Map<Tid, number>();
    for (const s of ds.sessions) if (s.kind === "3ds-hours" && s.source === (src.console.id || src.console.name))
      hourSum.set(s.tid, (hourSum.get(s.tid) ?? 0) + s.minutes);
    for (const l of src.library) {
      const g = out.get(l.tid);
      if (!g) continue;
      g.minutes += l.seconds / 60 - (hourSum.get(l.tid) ?? 0);
      g.launches += l.launches;
      g.first = Math.min(g.first, l.firstDay * 1440);
      if (l.lastDay * 1440 > g.last && l.lastDay * 1440 <= nowMinutes()) g.last = l.lastDay * 1440;
    }
  }
  return out;
}

/** minutes since 2000 for a JS time (the PC's local clock, like the 3DS) */
export function nowMinutes(d = new Date()): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) - Date.UTC(2000, 0, 1)) / 60000);
}

/** a Date showing the given local minutes (read its UTC fields) */
export const asDate = (min: number) => new Date(Date.UTC(2000, 0, 1) + min * 60000);
