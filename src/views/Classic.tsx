// "Classic": the software album (every game as a tile, details on click), play time per
// day/week/month/year, and the step counter.

import { useMemo, useState } from "preact/hooks";
import { isSystem, nowMinutes, titleStats } from "../data/dataset.ts";
import type { Dataset, TitleStats } from "../data/dataset.ts";
import { periodNext, periods, periodStart, playByTitle, playPerPeriod, stepsPerDay } from "../data/periods.ts";
import type { Unit } from "../data/periods.ts";
import { asDate } from "../data/dataset.ts";
import { fmtDate, lang, T } from "../i18n.ts";
import { Bars } from "../ui/Bars.tsx";
import type { Bar } from "../ui/Bars.tsx";
import { Icon, Name, titleName } from "../ui/Icon.tsx";

type Tab = "album" | "stats" | "steps";
const loc = lang === "de" ? "de-DE" : "en";
const h1 = (min: number) => Math.round(min / 6) / 10;
/** under an hour in minutes, else hours */
const dur = (min: number) => (min < 60 ? T.minutes(Math.max(1, Math.round(min))) : T.hoursShort(h1(min)));

export function Classic({ ds }: { ds: Dataset }) {
  const [tab, setTab] = useState<Tab>("album");
  return (
    <div class="classic">
      <nav class="subtabs">
        <button class={tab === "album" ? "active" : ""} onClick={() => setTab("album")}>{T.album}</button>
        <button class={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>{T.statistics}</button>
        <button class={tab === "steps" ? "active" : ""} onClick={() => setTab("steps")}>{T.steps}</button>
      </nav>
      {tab === "album" && <Album ds={ds} />}
      {tab === "stats" && <Stats ds={ds} />}
      {tab === "steps" && <Steps ds={ds} />}
    </div>
  );
}

// ------------------------------------------------------------------ software album

function Album({ ds }: { ds: Dataset }) {
  const [sort, setSort] = useState<"time" | "last" | "name">("time");
  const [open, setOpen] = useState<string | null>(null);
  const [, redraw] = useState(0);
  const stats = useMemo(() => titleStats(ds, nowMinutes()), [ds]);
  const name = (s: TitleStats) => titleName(ds.titles.get(s.tid), s.tid);
  const list = [...stats.values()].filter((s) => !isSystem(s.tid)).sort((a, b) =>
    sort === "time" ? b.minutes - a.minutes : sort === "last" ? b.last - a.last : name(a).localeCompare(name(b)));
  const sel = open ? stats.get(open) : undefined;
  return (
    <>
      {sel && <Detail ds={ds} s={sel} onClose={() => setOpen(null)} onRename={() => redraw((x) => x + 1)} />}
      <section class="card">
        <div class="card-title">
          <h3>{T.album} <span class="muted">({list.length})</span></h3>
          <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)}>
            <option value="time">{T.sortTime}</option>
            <option value="last">{T.sortLast}</option>
            <option value="name">{T.sortName}</option>
          </select>
        </div>
        <div class="album">
          {list.map((s) => (
            <button key={s.tid} class={"tile" + (s.tid === open ? " sel" : "")} title={name(s)}
              onClick={() => { setOpen(s.tid); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <Icon title={ds.titles.get(s.tid)} size={64} />
              <span class="tile-name">{name(s)}</span>
              <span class="tile-time">{dur(s.minutes)}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Detail({ ds, s, onClose, onRename }: { ds: Dataset; s: TitleStats; onClose: () => void; onRename: () => void }) {
  const t = ds.titles.get(s.tid);
  const mine = useMemo(() => ds.sessions.filter((x) => x.tid === s.tid), [ds, s.tid]);
  const days = useMemo(() => {
    const set = new Set<number>();
    for (const x of mine) if (!Number.isNaN(x.start)) set.add(periodStart(x.start, "day"));
    return set.size;
  }, [mine]);
  const months = useMemo(() => {
    const per = playPerPeriod(mine, "month");
    if (!per.size) return [] as Bar[];
    const keys = [...per.keys()];
    return periods(Math.min(...keys), Math.max(...keys), "month").map((p) => ({
      key: String(p), label: monthLabel(p, true), value: h1(per.get(p) ?? 0),
      tip: `${monthLabel(p, false)}: ${T.hours(h1(per.get(p) ?? 0))}`,
    }));
  }, [mine]);
  const hours = useMemo(() => {
    const per = new Array(24).fill(0);
    for (const x of mine) if (!Number.isNaN(x.start)) per[asDate(x.start).getUTCHours()] += x.minutes;
    return per.map((v, i) => ({ key: String(i), label: String(i), value: h1(v), tip: `${i}:00–${i + 1}:00: ${T.hours(h1(v))}` }));
  }, [mine]);
  return (
    <section class="card detail">
      <button class="link close" onClick={onClose}>✕</button>
      <div class="detail-head">
        <Icon title={t} size={96} />
        <div>
          <h2><Name title={t} tid={s.tid} onChange={onRename} /></h2>
          <div class="muted">{t?.publisher}</div>
          <div class="muted small">{s.tid}</div>
        </div>
      </div>
      <div class="facts">
        <div><b>{T.hours(h1(s.minutes))}</b><span>{T.playtime}</span></div>
        <div><b>{s.launches || "–"}</b><span>{T.starts}</span></div>
        <div><b>{s.launches ? T.minutes(Math.round(s.minutes / s.launches)) : "–"}</b><span>{T.perStart}</span></div>
        <div><b>{days || "–"}</b><span>{T.daysPlayed}</span></div>
        <div><b>{fmtDate(s.first)}</b><span>{T.firstPlayed}</span></div>
        <div><b>{fmtDate(s.last)}</b><span>{T.lastPlayed}</span></div>
      </div>
      <h4>{T.perMonth}</h4>
      <Bars bars={months} unit=" h" />
      <h4>{T.timeOfDay}</h4>
      <Bars bars={hours} height={110} unit=" h" />
    </section>
  );
}

// ------------------------------------------------------------------ play time per period

const RANGE: Record<Unit, number> = { day: 60, week: 52, month: 0, year: 0 }; // 0: everything

function Stats({ ds }: { ds: Dataset }) {
  const [unit, setUnit] = useState<Unit>("month");
  const [sel, setSel] = useState<string | undefined>();
  const now = nowMinutes();
  const playable = useMemo(() => ds.sessions.filter((s) => !isSystem(s.tid) && !Number.isNaN(s.start)), [ds]);
  const per = useMemo(() => playPerPeriod(playable, unit), [playable, unit]);
  const bars = useMemo(() => {
    if (!per.size) return [] as Bar[];
    const first = Math.min(...per.keys());
    let ps = periods(first, now, unit);
    if (RANGE[unit]) ps = ps.slice(-RANGE[unit]);
    return ps.map((p) => ({
      key: String(p), label: periodLabel(p, unit, true), value: h1(per.get(p) ?? 0),
      tip: `${periodLabel(p, unit, false)}: ${T.hours(h1(per.get(p) ?? 0))}`,
    }));
  }, [per, unit, now]);
  const chosen = sel && bars.some((b) => b.key === sel) ? Number(sel) : bars.length ? Number(bars[bars.length - 1].key) : NaN;
  const top = useMemo(() => {
    if (Number.isNaN(chosen)) return [];
    return [...playByTitle(playable, chosen, periodNext(chosen, unit))].sort((a, b) => b[1] - a[1]);
  }, [playable, chosen, unit]);
  const total = bars.reduce((a, b) => a + b.value, 0);
  const active = bars.filter((b) => b.value > 0).length;
  const sum = top.reduce((a, [, m]) => a + m, 0);
  return (
    <>
      <section class="card">
        <div class="card-title">
          <h3>{T.playtime}</h3>
          <div class="controls">
            {(["day", "week", "month", "year"] as Unit[]).map((u) => (
              <button key={u} class={u === unit ? "active" : ""} onClick={() => { setUnit(u); setSel(undefined); }}>{T.units[u]}</button>
            ))}
          </div>
        </div>
        <div class="facts small-facts">
          <div><b>{T.hours(Math.round(total * 10) / 10)}</b><span>{T.inRange(bars.length, T.unitsPlural[unit])}</span></div>
          <div><b>{T.hours(active ? Math.round((total / active) * 10) / 10 : 0)}</b><span>{T.avgPer(T.units[unit])}</span></div>
        </div>
        <Bars bars={bars} selected={String(chosen)} onSelect={setSel} unit=" h" />
        <p class="muted small">{T.statsNote}</p>
      </section>
      {!Number.isNaN(chosen) && (
        <section class="card">
          <div class="card-title">
            <h3>{periodLabel(chosen, unit, false)}</h3>
            <span class="muted">{T.hours(h1(sum))}</span>
          </div>
          {top.length === 0 && <p class="muted">{T.nothingInPeriod}</p>}
          <table class="games">
            <tbody>
              {top.map(([tid, m]) => (
                <tr key={tid}>
                  <td><Icon title={ds.titles.get(tid)} size={32} /></td>
                  <td>{titleName(ds.titles.get(tid), tid)}</td>
                  <td class="share"><div style={{ width: `${(100 * m) / top[0][1]}%` }} /></td>
                  <td class="num">{dur(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ steps

function Steps({ ds }: { ds: Dataset }) {
  const [unit, setUnit] = useState<Exclude<Unit, "week">>("month");
  const perDay = useMemo(() => stepsPerDay(ds), [ds]);
  const now = nowMinutes();
  const withSteps = [...perDay].filter(([, n]) => n > 0);
  if (!withSteps.length) return <section class="card"><p class="muted">{T.noSteps}</p></section>;
  const first = Math.min(...withSteps.map(([d]) => d));
  const total = withSteps.reduce((a, [, n]) => a + n, 0);
  const best = withSteps.reduce((a, b) => (b[1] > a[1] ? b : a));
  const per = new Map<number, number>();
  for (const [d, n] of perDay) {
    const k = periodStart(d, unit);
    per.set(k, (per.get(k) ?? 0) + n);
  }
  let ps = periods(first, now, unit);
  if (unit === "day") ps = ps.slice(-60);
  const bars: Bar[] = ps.map((p) => ({
    key: String(p), label: periodLabel(p, unit, true), value: per.get(p) ?? 0,
    tip: `${periodLabel(p, unit, false)}: ${(per.get(p) ?? 0).toLocaleString(loc)} ${T.stepsWord}`,
  }));
  return (
    <section class="card">
      <div class="card-title">
        <h3>{T.steps}</h3>
        <div class="controls">
          {(["day", "month", "year"] as const).map((u) => (
            <button key={u} class={u === unit ? "active" : ""} onClick={() => setUnit(u)}>{T.units[u]}</button>
          ))}
        </div>
      </div>
      <div class="facts small-facts">
        <div><b>{total.toLocaleString(loc)}</b><span>{T.stepsTotal} {fmtDate(first)}</span></div>
        <div><b>{Math.round(total / withSteps.length).toLocaleString(loc)}</b><span>{T.stepsAvg}</span></div>
        <div><b>{best[1].toLocaleString(loc)}</b><span>{T.stepsBest} ({fmtDate(best[0])})</span></div>
      </div>
      <Bars bars={bars} />
    </section>
  );
}

// ------------------------------------------------------------------ labels

function monthLabel(min: number, short: boolean): string {
  const d = asDate(min);
  return short
    ? d.toLocaleDateString(loc, { timeZone: "UTC", month: "2-digit", year: "2-digit" })
    : d.toLocaleDateString(loc, { timeZone: "UTC", month: "long", year: "numeric" });
}

function periodLabel(min: number, unit: Unit, short: boolean): string {
  const d = asDate(min);
  if (unit === "year") return String(d.getUTCFullYear());
  if (unit === "month") return monthLabel(min, short);
  if (unit === "week") {
    const end = asDate(min + 6 * 1440);
    const f = (x: Date) => x.toLocaleDateString(loc, { timeZone: "UTC", day: "2-digit", month: "2-digit" });
    return short ? f(d) : `${f(d)}–${f(end)}.${end.getUTCFullYear()}`;
  }
  return short
    ? d.toLocaleDateString(loc, { timeZone: "UTC", day: "2-digit", month: "2-digit" })
    : d.toLocaleDateString(loc, { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
