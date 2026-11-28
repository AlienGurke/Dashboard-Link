// Readers for the files 3DS Link writes into its `activity` folder.
// Formats: https://github.com/AlienGurke/3DS-Link/blob/master/docs/activity-log-archive.md
// Times are kept as minutes since 2000-01-01 00:00 in the console's local time
// (what the 3DS showed); a Date is only made when something is displayed.

export type Tid = string; // 16 hex digits, upper case

export const SYSTEM_TID: Tid = "FFFFFFFFFFFFFFFF";
export const GAP_TID: Tid = "FFFFFFFFFFFFFFFE";

/** One entry of the 3DS play log (playhistory.bin), as stored. */
export interface LogEntry {
  tid: Tid;
  /** 0..15, see the doc ("Art des Eintrags") */
  type: number;
  /** minutes since 2000, as the clock said */
  min: number;
}

/** One hour of the Activity Log app's own table (pld.dat). */
export interface HourEntry {
  tid: Tid;
  /** start of the hour, minutes since 2000 */
  min: number;
  /** seconds played in that hour */
  seconds: number;
}

/** One title of the software library (pld.dat). */
export interface LibraryEntry {
  tid: Tid;
  seconds: number;
  launches: number;
  /** days since 2000 */
  firstDay: number;
  lastDay: number;
}

export interface StepDay {
  /** start of the day, minutes since 2000 */
  min: number;
  hours: number[];
}

export interface TitleInfo {
  tid: Tid;
  name: string;
  publisher: string;
  /** RGBA, ready for ImageData: 48x48 (3DS) or 32x32 (DS) */
  icon?: Uint8ClampedArray;
  iconSize?: number;
  /** when the HOME Menu last showed it (minutes since 2000), to pick the newest of several slots */
  seen: number;
}

export interface ConsoleInfo {
  model: string;
  id: string;
  name: string;
}

export interface ClockNote {
  kind: "jump" | "end" | "set" | "unsure";
  /** entry number in playhistory.bin from which it applies; -1 when unknown */
  at: number;
  /** jump: minutes the clock was ahead (+) or behind (-) */
  minutes: number;
}

const hex8 = (v: number) => (v >>> 0).toString(16).toUpperCase().padStart(8, "0");
const tidAt = (v: DataView, o: number, highFirst: boolean) =>
  highFirst ? hex8(v.getUint32(o, true)) + hex8(v.getUint32(o + 4, true))
            : hex8(v.getUint32(o + 4, true)) + hex8(v.getUint32(o, true));

const text = (b: ArrayBuffer | Uint8Array, start = 0, len?: number) =>
  new TextDecoder().decode(new Uint8Array(b instanceof Uint8Array ? b.buffer : b,
    (b instanceof Uint8Array ? b.byteOffset : 0) + start, len ?? (b.byteLength - start)));

/** playhistory.bin (3DS Link archive): 16-byte header "3DSPLAY\0", version, entry size; then 12-byte entries */
export function readPlayHistory(buf: ArrayBuffer): LogEntry[] {
  const v = new DataView(buf);
  if (buf.byteLength < 16 || text(buf, 0, 7) !== "3DSPLAY" || v.getUint32(12, true) !== 12)
    throw new Error("playhistory.bin: kein Archiv von 3DS Link");
  const n = Math.floor((buf.byteLength - 16) / 12); // a cut-off last entry does not count
  const out: LogEntry[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = 16 + i * 12;
    const info = v.getUint32(o + 8, true);
    out[i] = { tid: tidAt(v, o, true), type: info & 15, min: info >>> 4 };
  }
  return out;
}

/** pld.dat (Activity Log app): 16-byte header, 50000 hour entries, 256 library entries */
export function readPld(buf: ArrayBuffer): { hours: HourEntry[]; library: LibraryEntry[] } {
  const v = new DataView(buf);
  if (buf.byteLength !== 806160) throw new Error("pld.dat: unerwartete Größe");
  const hours: HourEntry[] = [];
  for (let i = 0; i < 50000; i++) {
    const o = 16 + i * 16;
    const tid = tidAt(v, o, false);
    if (tid === SYSTEM_TID) continue;
    hours.push({ tid, min: Math.floor(v.getUint32(o + 8, true) / 60), seconds: v.getUint32(o + 12, true) });
  }
  const library: LibraryEntry[] = [];
  for (let i = 0; i < 256; i++) {
    const o = 0xC3510 + i * 24;
    const tid = tidAt(v, o, false);
    if (tid === SYSTEM_TID || tid === "0000000000000000") continue;
    library.push({
      tid, seconds: v.getUint32(o + 8, true), launches: v.getUint16(o + 12, true),
      firstDay: v.getUint16(o + 16, true), lastDay: v.getUint16(o + 18, true),
    });
  }
  return { hours, library };
}

/** steps.bin: "3DSSTEPS", version, record size (60); records: u64 start of day (ms since 2000), u32 hours, 24 x u16 */
export function readSteps(buf: ArrayBuffer): StepDay[] {
  const v = new DataView(buf);
  if (buf.byteLength < 16 || text(buf, 0, 8) !== "3DSSTEPS") throw new Error("steps.bin: unbekanntes Format");
  const size = v.getUint32(12, true);
  const out: StepDay[] = [];
  for (let o = 16; o + size <= buf.byteLength; o += size) {
    const ms = v.getUint32(o, true) + v.getUint32(o + 4, true) * 2 ** 32;
    const n = v.getUint32(o + 8, true);
    const hours: number[] = [];
    for (let h = 0; h < n; h++) hours.push(v.getUint16(o + 12 + h * 2, true));
    out.push({ min: Math.round(ms / 60000), hours });
  }
  return out;
}

const RECORD = 0x36a0;

/** idbt.dat + idb.dat: the HOME Menu's icon cache. lang: 1 English, 3 German, ... */
export function readIconCache(idbt: ArrayBuffer, idb: ArrayBuffer, lang: number): Map<Tid, TitleInfo> {
  const t = new DataView(idbt);
  const out = new Map<Tid, TitleInfo>();
  for (let i = 0; i < 512 && 8 + i * 16 + 16 <= idbt.byteLength; i++) {
    const tid = tidAt(t, 8 + i * 16, false);
    if (tid === "0000000000000000" || tid === SYSTEM_TID) continue;
    const seen = Math.floor(t.getUint32(8 + i * 16 + 8, true) / 60);
    const prev = out.get(tid);
    if (prev && prev.seen >= seen) continue;
    if ((i + 1) * RECORD > idb.byteLength) continue;
    const rec = new Uint8Array(idb, i * RECORD, RECORD);
    if (tid.startsWith("00048")) {
      // a DS title: its banner - name lines in the long field, a 32x32 icon with 16 colours
      // (stored like a DSi banner: 8 icon frames from 0x2020, their 8 palettes from 0x3020)
      const { name, publisher } = dsNames(rec, lang);
      // DSi-style banners have their palette at 0x3020; plain DS banners (no animation, e.g.
      // 3DSBank) only at 0x2220 - the other place is empty then
      const pal = rec.subarray(0x3020, 0x3040).some((b) => b) ? rec.subarray(0x3020, 0x3040) : rec.subarray(0x2220, 0x2240);
      out.set(tid, { tid, name, publisher, icon: decodeDsIcon(rec.subarray(0x2020, 0x2220), pal), iconSize: 32, seen });
    } else {
      const { name, publisher } = titleNames(rec, lang);
      out.set(tid, { tid, name, publisher, icon: decodeIcon(rec.subarray(0x24a0, 0x24a0 + 0x1200)), iconSize: 48, seen });
    }
  }
  return out;
}

/** a title's own icon file (SMDH, 0x36C0 bytes): names from 0x08, the 48x48 icon at 0x24C0 */
export function readSmdh(tid: Tid, buf: ArrayBuffer, lang: number): TitleInfo | null {
  if (buf.byteLength < 0x36c0 || text(buf, 0, 4) !== "SMDH") return null;
  const b = new Uint8Array(buf);
  const { name, publisher } = titleNames(b, lang, 0x08);
  return { tid, name, publisher, icon: decodeIcon(b.subarray(0x24c0, 0x24c0 + 0x1200)), iconSize: 48, seen: 0 };
}

function utf16(b: Uint8Array, start: number, bytes: number): string {
  let s = "";
  for (let i = start; i < start + bytes; i += 2) {
    const c = b[i] | (b[i + 1] << 8);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

function titleNames(rec: Uint8Array, lang: number, first = 0x20) {
  for (const l of [lang, 1, ...Array.from({ length: 16 }, (_, k) => k)]) {
    const base = first + l * 0x200;
    const name = utf16(rec, base, 0x80);
    if (name) return { name, publisher: utf16(rec, base + 0x180, 0x80) };
  }
  return { name: "", publisher: "" };
}

function dsNames(rec: Uint8Array, lang: number) {
  // DS banners: "Title\nSubtitle\nPublisher" in the long field (languages 0..7)
  for (const l of [lang, 1, 0, 2, 3, 4, 5, 6, 7]) {
    const lines = utf16(rec, 0x20 + l * 0x200 + 0x80, 0x100).split("\n").map((x) => x.trim()).filter(Boolean);
    if (lines.length) return { name: lines.length > 2 ? lines.slice(0, -1).join(" – ") : lines[0], publisher: lines.length > 1 ? lines[lines.length - 1] : "" };
  }
  return { name: "", publisher: "" };
}

/** a DS icon: 32x32, 4 bits per pixel in 8x8 tiles, 16 colours (BGR555, colour 0 transparent) */
export function decodeDsIcon(bmp: Uint8Array, pal: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(32 * 32 * 4);
  for (let tile = 0; tile < 16; tile++) {
    const tx = (tile % 4) * 8, ty = Math.floor(tile / 4) * 8;
    for (let p = 0; p < 64; p++) {
      const b = bmp[tile * 32 + (p >> 1)];
      const c = p & 1 ? b >> 4 : b & 15;
      const v = pal[c * 2] | (pal[c * 2 + 1] << 8);
      const o = ((ty + (p >> 3)) * 32 + tx + (p & 7)) * 4;
      out[o] = ((v & 31) * 255) / 31;
      out[o + 1] = (((v >> 5) & 31) * 255) / 31;
      out[o + 2] = (((v >> 10) & 31) * 255) / 31;
      out[o + 3] = c ? 255 : 0;
    }
  }
  return out;
}

/** 48x48 RGB565 in 8x8 tiles, pixels of a tile in Z order -> RGBA */
export function decodeIcon(data: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(48 * 48 * 4);
  let i = 0;
  for (let ty = 0; ty < 48; ty += 8)
    for (let tx = 0; tx < 48; tx += 8)
      for (let k = 0; k < 64; k++) {
        const x = (k & 1) | ((k >> 1) & 2) | ((k >> 2) & 4);
        const y = ((k >> 1) & 1) | ((k >> 2) & 2) | ((k >> 3) & 4);
        const px = data[i] | (data[i + 1] << 8);
        i += 2;
        const o = ((ty + y) * 48 + tx + x) * 4;
        out[o] = ((px >> 11) * 255) / 31;
        out[o + 1] = (((px >> 5) & 63) * 255) / 63;
        out[o + 2] = ((px & 31) * 255) / 31;
        out[o + 3] = 255;
      }
  return out;
}

export function readConsole(txt: string): ConsoleInfo {
  const kv: Record<string, string> = {};
  for (const line of txt.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0) kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return { model: kv.model ?? "3DS", id: kv.id ?? "", name: kv.name || kv.model || "3DS" };
}

export function readClock(txt: string): ClockNote[] {
  const out: ClockNote[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/);
    if (f[0] === "jump" && f.length >= 3) out.push({ kind: "jump", at: +f[1], minutes: +f[2] });
    else if (f[0] === "end" && f.length >= 2) out.push({ kind: "end", at: +f[1], minutes: 0 });
    else if (f[0] === "set" && f.length >= 2) out.push({ kind: "set", at: +f[1], minutes: 0 });
    else if (f[0] === "unsure") out.push({ kind: "unsure", at: -1, minutes: +(f[2] ?? 0) });
  }
  return out;
}

// ------------------------------------------------------------------ the PC (Azahar-Link, melonDS-Link)

export interface PcEntry {
  tid: Tid;
  /** minutes since 2000, the PC's local time */
  start: number;
  seconds: number;
  /** a 3DS was connected (then the 3DS may have it in its own log too) */
  with3ds: boolean;
}

/** azahar.bin / melonds.bin: "3DSLPCPL", version, entry size; 24-byte entries */
export function readPcActivity(buf: ArrayBuffer, file: string): PcEntry[] {
  const v = new DataView(buf);
  if (buf.byteLength < 16 || text(buf, 0, 8) !== "3DSLPCPL") throw new Error(`${file}: kein Spielzeit-Protokoll von Azahar-Link / melonDS-Link`);
  const size = v.getUint32(12, true);
  if (size < 24) throw new Error(`${file}: unbekannte Eintragsgröße ${size}`);
  const out: PcEntry[] = [];
  for (let o = 16; o + size <= buf.byteLength; o += size) {
    const tid = tidAt(v, o, false);
    if (/^0+$/.test(tid)) continue;
    out.push({ tid, start: Math.floor(v.getUint32(o + 8, true) / 60), seconds: v.getUint32(o + 12, true), with3ds: (v.getUint16(o + 20, true) & 1) !== 0 });
  }
  return out;
}

/** titles.txt: "title id<TAB>name" */
export function readTitlesTxt(txt: string): Map<Tid, string> {
  const out = new Map<Tid, string>();
  for (const line of txt.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{16})\t(.+)$/.exec(line);
    if (m) out.set(m[1].toUpperCase(), m[2].trim());
  }
  return out;
}
