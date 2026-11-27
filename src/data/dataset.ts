// Everything read from one or more activity folders, put together.

import {
  readClock, readConsole, readIconCache, readPlayHistory, readPld, readSteps,
} from "./formats.ts";
import type { ConsoleInfo, LibraryEntry, StepDay, Tid, TitleInfo } from "./formats.ts";
import { correctTimes, sessionsFromHours, sessionsFromLog } from "./timeline.ts";
import type { Session } from "./timeline.ts";

/** the files of one activity folder, by name */
export type FolderFiles = Map<string, ArrayBuffer>;

export interface Source {
  console: ConsoleInfo;
  /** first minute the play log covers (before: the Activity Log app's hours) */
  logFrom: number;
  library: LibraryEntry[];
  steps: StepDay[];
}

export interface Dataset {
  sources: Source[];
  sessions: Session[];
  titles: Map<Tid, TitleInfo>;
  /** problems that did not stop reading (shown, not hidden) */
  notes: string[];
}

const txt = (b: ArrayBuffer | undefined) => (b ? new TextDecoder().decode(b) : "");

export function readFolder(files: FolderFiles, lang: number): { source: Source; sessions: Session[]; titles: Map<Tid, TitleInfo>; notes: string[] } {
  const notes: string[] = [];
  const consoleInfo = readConsole(txt(files.get("console.txt")) || "name=3DS");
  const id = consoleInfo.id || consoleInfo.name;
  const sessions: Session[] = [];
  let logFrom = Infinity;
  const ph = files.get("playhistory.bin");
  if (ph) {
    const log = readPlayHistory(ph);
    const t = correctTimes(log, readClock(txt(files.get("clock.txt"))));
    for (let i = 0; i < t.length; i++) if (!Number.isNaN(t[i])) { logFrom = t[i]; break; }
    sessions.push(...sessionsFromLog(log, t, id));
  } else notes.push("playhistory.bin fehlt");
  let library: LibraryEntry[] = [];
  const pld = files.get("pld.dat");
  if (pld) {
    try {
      const p = readPld(pld);
      library = p.library;
      sessions.push(...sessionsFromHours(p.hours, logFrom, id));
    } catch (e) { notes.push(String(e)); }
  }
  let steps: StepDay[] = [];
  const st = files.get("steps.bin");
  if (st) { try { steps = readSteps(st); } catch (e) { notes.push(String(e)); } }
  let titles = new Map<Tid, TitleInfo>();
  const idbt = files.get("idbt.dat"), idb = files.get("idb.dat");
  if (idbt && idb) titles = readIconCache(idbt, idb, lang);
  return { source: { console: consoleInfo, logFrom, library, steps }, sessions, titles, notes };
}

export function combine(folders: FolderFiles[], lang: number): Dataset {
  const ds: Dataset = { sources: [], sessions: [], titles: new Map(), notes: [] };
  for (const f of folders) {
    const r = readFolder(f, lang);
    ds.sources.push(r.source);
    ds.sessions.push(...r.sessions);
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
  // the hour table does not count starts: the Activity Log app's own count covers that time
  for (const src of ds.sources)
    for (const l of src.library) {
      const g = out.get(l.tid);
      if (!g) continue;
      g.launches = Math.max(g.launches, l.launches);
      g.first = Math.min(g.first, l.firstDay * 1440);
    }
  return out;
}

/** minutes since 2000 for a JS time (the PC's local clock, like the 3DS) */
export function nowMinutes(d = new Date()): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) - Date.UTC(2000, 0, 1)) / 60000);
}

/** a Date showing the given local minutes (read its UTC fields) */
export const asDate = (min: number) => new Date(Date.UTC(2000, 0, 1) + min * 60000);
