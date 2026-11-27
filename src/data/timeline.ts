// From raw entries to sessions: clock corrections, then start/end pairs.
// Rules: docs/activity-log-archive.md in the 3DS-Link repo ("Zeitsprünge",
// "Zurückgesetzte Uhr", "Sitzungen und Spielzeit berechnen").

import { GAP_TID, SYSTEM_TID } from "./formats.ts";
import type { ClockNote, HourEntry, LogEntry, Tid } from "./formats.ts";

export interface Session {
  tid: Tid;
  /** minutes since 2000, local time, corrected; NaN when the date is not known */
  start: number;
  /** minutes played (pauses and standby taken out) */
  minutes: number;
  /** a fresh start (counts as "played"), not only a resume */
  launch: boolean;
  /** where it was played: "3ds" (console log), "3ds-hours" (Activity Log app, hour resolution), "pc" */
  kind: "3ds" | "3ds-hours" | "pc";
  /** which console / PC (console.txt id) */
  source: string;
}


/** a corrected time per entry; NaN = date not known */
export function correctTimes(entries: LogEntry[], clock: ClockNote[]): Float64Array {
  const t = new Float64Array(entries.length);
  for (let i = 0; i < entries.length; i++) t[i] = entries[i].min;

  // 1. time jumps made with 3DS Link (clock.txt): take them out
  const notes = clock.filter((c) => c.at >= 0 && (c.kind === "jump" || c.kind === "end")).sort((a, b) => a.at - b.at);
  for (let k = 0; k < notes.length; k++) {
    if (notes[k].kind !== "jump") continue;
    const end = k + 1 < notes.length ? notes[k + 1].at : entries.length;
    for (let i = notes[k].at; i < end && i < entries.length; i++) t[i] -= notes[k].minutes;
  }

  // 2. the system's own clock changes (11 = old time, 12 = new time). Real time does not jump
  //    at such a change, so the pieces on both sides are linked: what the clock said before
  //    is off by (new - old) more than what it says after. Where the link breaks - the "old"
  //    time does not fit what came just before (the clock was lost: empty battery, it comes
  //    back at 2011-01-01), or the clock jumps by more than a year without an event (set
  //    with some tool) - nothing is known across. Each linked run is anchored at its newest
  //    piece, which is taken as right if it fits after the run before; else its dates are
  //    unknown.
  const YEAR = 365 * 24 * 60, DAY = 24 * 60;
  interface Piece { a: number; b: number; d: number; linked: boolean } // d: offset to the next piece
  const pieces: Piece[] = [];
  let start = 0;
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i], p = entries[i - 1];
    const pair = e.tid === SYSTEM_TID && e.type === 12 && p.tid === SYSTEM_TID && p.type === 11;
    if (pair) {
      // the "old" time must fit the entry before it
      let before = i - 2;
      while (before >= start && Number.isNaN(t[before])) before--;
      const fits = before < start || Math.abs(t[i - 1] - t[before]) <= DAY;
      pieces.push({ a: start, b: i, d: t[i] - t[i - 1], linked: fits });
      start = i;
    } else if (!Number.isNaN(t[i]) && !Number.isNaN(t[i - 1]) && (t[i] < t[i - 1] - 60 || t[i] > t[i - 1] + YEAR)) {
      pieces.push({ a: start, b: i, d: 0, linked: false });
      start = i;
    }
  }
  pieces.push({ a: start, b: entries.length, d: 0, linked: false });
  // runs of linked pieces, oldest first; offsets within a run, the newest piece at 0
  const runs: { from: number; to: number; first: number; last: number }[] = [];
  let runStart = 0;
  for (let k = 0; k < pieces.length; k++) {
    if (pieces[k].linked && k + 1 < pieces.length) continue;
    const off = new Array(k - runStart + 1).fill(0);
    for (let j = k - 1; j >= runStart; j--) off[j - runStart] = off[j - runStart + 1] + pieces[j].d;
    let first = Infinity, last = -Infinity;
    for (let j = runStart; j <= k; j++)
      for (let i = pieces[j].a; i < pieces[j].b; i++) {
        if (Number.isNaN(t[i])) continue;
        t[i] += off[j - runStart];
        first = Math.min(first, t[i]);
        last = Math.max(last, t[i]);
      }
    runs.push({ from: pieces[runStart].a, to: pieces[k].b, first, last });
    runStart = k + 1;
  }
  // a run is on a wrong clock if it starts more than a month before what came before it
  // (fell back) or ends more than a month after what follows (set ahead). A few days back
  // or ahead (time tricks for games) stay as the clock said.
  const MONTH = 30 * DAY;
  let prevEnd = -Infinity;
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    if (!Number.isFinite(run.first)) continue;
    let nextFirst = Infinity;
    for (let q = r + 1; q < runs.length && !Number.isFinite(nextFirst); q++) nextFirst = runs[q].first;
    const wrong = run.first < prevEnd - MONTH || run.last > nextFirst + MONTH;
    if (wrong) for (let i = run.from; i < run.to; i++) t[i] = NaN;
    else prevEnd = Math.max(prevEnd, run.last);
  }
  return t;
}

/** the Activity Log app files applets under one id (the last digits 00): do the same */
export function canonical(tid: Tid): Tid {
  return tid.startsWith("00040030") ? tid.slice(0, 14) + "00" : tid;
}

/** titles that count as played (games, demos, system programs, DS); not HOME Menu applets */
export function counts(tid: Tid): boolean {
  if (tid === SYSTEM_TID || tid === GAP_TID) return false;
  const high = tid.slice(0, 8);
  // the HOME Menu itself (one per region) is not "played"
  if (high === "00040030" && /^0004003000008202|0004003000008F02|0004003000009802|000400300000A102|000400300000A902|000400300000B102$/.test(tid)) return false;
  return true;
}

/** start/end pairs per title; standby is not counted; everything ends when the system stops */
export function sessionsFromLog(entries: LogEntry[], t: Float64Array, source: string): Session[] {
  interface Open { start: number; played: number; resumed: number; launch: boolean; unknown: boolean; asleep?: boolean }
  const open = new Map<Tid, Open>();
  // one stretch in front without any event in between: more than 12 hours is a clock that
  // was moved (no system event for it), not playing
  const stretch = (from: number, to: number) => Number.isNaN(from) || Number.isNaN(to) ? 0 : Math.min(Math.max(0, to - from), 12 * 60);
  const out: Session[] = [];
  let sleepAt = NaN;
  const close = (tid: Tid, at: number) => {
    const o = open.get(tid);
    if (!o) return;
    open.delete(tid);
    let played = o.played;
    if (!Number.isNaN(o.resumed)) played += stretch(o.resumed, at);
    out.push({ tid: canonical(tid), start: o.unknown ? NaN : o.start, minutes: played, launch: o.launch, kind: "3ds", source });
  };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const at = t[i];
    if (e.tid === GAP_TID) { for (const k of [...open.keys()]) close(k, NaN); continue; }
    if (e.tid === SYSTEM_TID) {
      if (e.type === 8) { // standby begins: running ones pause
        sleepAt = at;
        for (const o of open.values())
          if (!Number.isNaN(o.resumed)) { o.played += stretch(o.resumed, at); o.resumed = NaN; o.asleep = true; }
      } else if (e.type === 9) { // standby ends: what was in front goes on
        for (const o of open.values()) if (o.asleep) { o.resumed = at; o.asleep = false; }
        sleepAt = NaN;
      } else if (e.type === 10) { // services stop (power off, DS mode): 3DS titles end; a DS title goes on
        for (const k of [...open.keys()]) if (!k.startsWith("00048")) close(k, at);
      } else if (e.type === 1) { // DS mode ends
        for (const k of [...open.keys()]) if (k.startsWith("00048")) close(k, at);
      }
      continue;
    }
    const kind = e.type;
    const foreground = kind === 0 || kind === 2 || kind === 4 || kind === 6;
    // only one thing is in front at a time (HOME Menu included): everything else pauses
    if (foreground)
      for (const [k, o] of open)
        if (k !== e.tid && !Number.isNaN(o.resumed)) { o.played += stretch(o.resumed, at); o.resumed = NaN; }
    if (!counts(e.tid)) continue;
    if (foreground) {
      // only one application runs at a time: one that did not note its end, ended here
      if ((kind === 0 || kind === 4) && !e.tid.startsWith("00040030"))
        for (const k of [...open.keys()]) if (k !== e.tid && !k.startsWith("00040030")) close(k, at);
      const o = open.get(e.tid);
      if (o) { if (Number.isNaN(o.resumed)) o.resumed = at; if (kind === 0 || kind === 2) o.launch = true; continue; }
      open.set(e.tid, { start: at, played: 0, resumed: at, launch: kind === 0 || kind === 2, unknown: Number.isNaN(at) });
    } else if (kind === 5 || kind === 7) { // to the HOME Menu: the time stops, the title stays open
      const o = open.get(e.tid);
      if (o && !Number.isNaN(o.resumed)) { o.played += stretch(o.resumed, at); o.resumed = NaN; }
    } else if (kind === 1 || kind === 3) close(e.tid, at);
  }
  void sleepAt;
  return out;
}

/** the Activity Log app's hours, for the time before the log begins (start of the hour, minutes) */
export function sessionsFromHours(hours: HourEntry[], before: number, source: string): Session[] {
  // the table is in the order the hours were noted: take it up to where the log begins
  // (later on, a reset clock can put hours at 2011 again - those the log has, with dates)
  const out: Session[] = [];
  for (const h of hours) {
    if (h.min + 60 > before) break;
    out.push({ tid: h.tid, start: h.min, minutes: h.seconds / 60, launch: false, kind: "3ds-hours", source });
  }
  return out;
}
