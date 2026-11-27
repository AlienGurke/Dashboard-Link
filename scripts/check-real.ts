// Developer check against a real activity folder (not in the repo): node scripts/check-real.ts <folder>
import { readFileSync } from "node:fs";
import { readPlayHistory, readPld, readSteps, readIconCache, readConsole } from "../src/data/formats.ts";
import { correctTimes, sessionsFromLog, sessionsFromHours } from "../src/data/timeline.ts";
const dir = process.argv[2];
const ab = (f: string) => { const b = readFileSync(dir + "/" + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const log = readPlayHistory(ab("playhistory.bin"));
const pld = readPld(ab("pld.dat"));
const steps = readSteps(ab("steps.bin"));
const titles = readIconCache(ab("idbt.dat"), ab("idb.dat"), 3);
const con = readConsole(readFileSync(dir + "/console.txt", "utf8"));
const t = correctTimes(log, []);
const D = (m: number) => Number.isNaN(m) ? "?" : new Date(Date.UTC(2000, 0, 1) + m * 60000).toISOString().slice(0, 16);
let unknown = 0, moved = 0;
for (let i = 0; i < log.length; i++) { if (Number.isNaN(t[i])) unknown++; else if (t[i] !== log[i].min) moved++; }
console.log(con, log.length, "entries; moved", moved, "unknown", unknown, "titles", titles.size, "steps days", steps.length);
for (const i of [72719, 72730, 72760, 75030, 75045]) console.log(i, log[i].tid, log[i].type, D(log[i].min), "->", D(t[i]));
let first = NaN; for (let i = 0; i < log.length; i++) if (!Number.isNaN(t[i])) { first = t[i]; break; }
const s = [...sessionsFromHours(pld.hours, first, con.id), ...sessionsFromLog(log, t, con.id)];
const by = new Map<string, { min: number; launches: number; first: number; last: number }>();
for (const x of s) { const g = by.get(x.tid) ?? { min: 0, launches: 0, first: Infinity, last: -Infinity }; g.min += x.minutes; if (x.launch) g.launches++; if (!Number.isNaN(x.start)) { g.first = Math.min(g.first, x.start); g.last = Math.max(g.last, x.start); } by.set(x.tid, g); }
const lib = new Map(pld.library.map((l) => [l.tid, l]));
const rows = [...by.entries()].sort((a, b) => b[1].min - a[1].min).slice(0, 15);
for (const [tid, g] of rows) {
  const l = lib.get(tid);
  const h = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
  console.log(tid, (titles.get(tid)?.name ?? "?").padEnd(32), h(g.min).padStart(8), "lib", l ? h(l.seconds / 60).padStart(8) : "   -", "starts", g.launches, l?.launches ?? "-", D(g.first).slice(0, 10), D(g.last).slice(0, 10));
}
console.log("total h", Math.round(s.reduce((a, x) => a + x.minutes, 0) / 60), "steps", steps.reduce((a, d) => a + d.hours.reduce((x, y) => x + y, 0), 0));
