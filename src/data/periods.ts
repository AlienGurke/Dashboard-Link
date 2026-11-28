// Grouping minutes (since 2000, local time) into days, weeks, months and years.

import { asDate } from "./dataset.ts";
import type { Dataset } from "./dataset.ts";
import type { Session } from "./timeline.ts";
import type { StepDay, Tid } from "./formats.ts";

export type Unit = "day" | "week" | "month" | "year";

const DAY = 1440;

/** the start (minutes since 2000) of the period that contains `min` */
export function periodStart(min: number, unit: Unit): number {
  const d = asDate(min);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const at = (yy: number, mm: number, dd: number) => (Date.UTC(yy, mm, dd) - Date.UTC(2000, 0, 1)) / 60000;
  if (unit === "day") return at(y, m, day);
  if (unit === "week") return at(y, m, day) - ((d.getUTCDay() + 6) % 7) * DAY; // Monday
  if (unit === "month") return at(y, m, 1);
  return at(y, 0, 1);
}

/** the start of the next period */
export function periodNext(start: number, unit: Unit): number {
  const d = asDate(start);
  const at = (yy: number, mm: number, dd: number) => (Date.UTC(yy, mm, dd) - Date.UTC(2000, 0, 1)) / 60000;
  if (unit === "day") return start + DAY;
  if (unit === "week") return start + 7 * DAY;
  if (unit === "month") return at(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return at(d.getUTCFullYear() + 1, 0, 1);
}

/** every period from the one containing `from` to the one containing `to` */
export function periods(from: number, to: number, unit: Unit): number[] {
  const out: number[] = [];
  for (let p = periodStart(from, unit); p <= to && out.length < 5000; p = periodNext(p, unit)) out.push(p);
  return out;
}

/** play minutes per period (a session counts where it starts); only sessions with a known date */
export function playPerPeriod(sessions: Session[], unit: Unit, filter?: (s: Session) => boolean): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of sessions) {
    if (Number.isNaN(s.start) || (filter && !filter(s))) continue;
    const k = periodStart(s.start, unit);
    out.set(k, (out.get(k) ?? 0) + s.minutes);
  }
  return out;
}

/** minutes per title within [from, to) */
export function playByTitle(sessions: Session[], from: number, to: number): Map<Tid, number> {
  const out = new Map<Tid, number>();
  for (const s of sessions)
    if (!Number.isNaN(s.start) && s.start >= from && s.start < to) out.set(s.tid, (out.get(s.tid) ?? 0) + s.minutes);
  return out;
}

/** steps per day over all consoles (a day asked twice keeps its higher count) */
export function stepsPerDay(ds: Dataset): Map<number, number> {
  const out = new Map<number, number>();
  for (const src of ds.sources) {
    const mine = new Map<number, number>();
    for (const d of src.steps as StepDay[]) {
      const day = periodStart(d.min, "day");
      const n = d.hours.reduce((a, b) => a + b, 0);
      mine.set(day, Math.max(mine.get(day) ?? 0, n));
    }
    for (const [k, v] of mine) out.set(k, (out.get(k) ?? 0) + v);
  }
  return out;
}
