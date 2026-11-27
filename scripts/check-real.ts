// Developer check against a real activity folder (not in the repo): node scripts/check-real.ts <folder>
import { readFileSync, readdirSync } from "node:fs";
import { combine, titleStats, nowMinutes } from "../src/data/dataset.ts";
const dir = process.argv[2];
const files = new Map<string, ArrayBuffer>();
for (const f of readdirSync(dir)) { const b = readFileSync(dir + "/" + f); files.set(f.toLowerCase(), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
const ds = combine([files], 3);
const st = titleStats(ds, nowMinutes() - 14 * 1440);
const lib = new Map(ds.sources[0].library.map((l) => [l.tid, l]));
const h = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const D = (m: number) => Number.isFinite(m) ? new Date(Date.UTC(2000, 0, 1) + m * 60000).toISOString().slice(0, 10) : "?";
console.log("pld up to", D(ds.sources[0].pldEnd));
let same = 0, diff = 0;
for (const s of [...st.values()].sort((a, b) => b.minutes - a.minutes)) {
  const l = lib.get(s.tid);
  const t = ds.titles.get(s.tid);
  if (l && Math.abs(l.seconds / 60 - s.minutes) < 1 && l.launches === s.launches) same++; else diff++;
  if (s.minutes > 600 || s.tid.startsWith("00048")) console.log(s.tid, (t?.name ?? "?").slice(0, 34).padEnd(34), h(s.minutes).padStart(8), "lib", l ? h(l.seconds / 60).padStart(8) : "       -", s.launches, l?.launches ?? "-", D(s.first), D(s.last));
}
console.log("same as the 3DS:", same, "different:", diff);
