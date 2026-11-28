// "Overview": a recap of one year (totals, top games, records, new games), a calendar of the
// days played, the latest sessions and, with several consoles, what each one contributed.

import { useMemo, useState } from "preact/hooks";
import { asDate, isSystem, nowMinutes } from "../data/dataset.ts";
import type { Dataset } from "../data/dataset.ts";
import { periodNext, periodStart, stepsPerDay } from "../data/periods.ts";
import type { Session } from "../data/timeline.ts";
import { fmtDate, lang, T } from "../i18n.ts";
import { Icon, titleName } from "../ui/Icon.tsx";

const loc = lang === "de" ? "de-DE" : "en";
const DAY = 1440;
const h1 = (min: number) => Math.round(min / 6) / 10;
const dur = (min: number) => (min < 60 ? T.minutes(Math.max(1, Math.round(min))) : T.hoursShort(h1(min)));
const yearStart = (y: number) => (Date.UTC(y, 0, 1) - Date.UTC(2000, 0, 1)) / 60000;

export function Overview({ ds, system }: { ds: Dataset; system: boolean }) {
  const play = useMemo(() => ds.sessions.filter((s) => (system || !isSystem(s.tid)) && !Number.isNaN(s.start)), [ds, system]);
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const s of play) set.add(asDate(s.start).getUTCFullYear());
    return [...set].sort((a, b) => b - a);
  }, [play]);
  const [year, setYear] = useState(years[0]);
  if (!years.length) return <section class="card"><p class="muted">{T.noData}</p></section>;
  const y = years.includes(year) ? year : years[0];
  return (
    <div class="overview">
      <nav class="subtabs years">
        {years.map((x) => <button key={x} class={x === y ? "active" : ""} onClick={() => setYear(x)}>{x}</button>)}
      </nav>
      <Recap ds={ds} play={play} year={y} system={system} />
      <Calendar play={play} year={y} />
      <Latest ds={ds} system={system} />
      {ds.sources.length > 1 && <Consoles ds={ds} />}
    </div>
  );
}

// ------------------------------------------------------------------ year recap

function Recap({ ds, play, year, system }: { ds: Dataset; play: Session[]; year: number; system: boolean }) {
  const from = yearStart(year), to = yearStart(year + 1);
  const r = useMemo(() => {
    const inYear = play.filter((s) => s.start >= from && s.start < to);
    const byTitle = new Map<string, number>();
    const days = new Map<number, number>();
    const months = new Array(12).fill(0);
    const weekdays = new Array(7).fill(0);
    let longest: Session | undefined;
    for (const s of inYear) {
      byTitle.set(s.tid, (byTitle.get(s.tid) ?? 0) + s.minutes);
      const d = periodStart(s.start, "day");
      days.set(d, (days.get(d) ?? 0) + s.minutes);
      const date = asDate(s.start);
      months[date.getUTCMonth()] += s.minutes;
      weekdays[(date.getUTCDay() + 6) % 7] += s.minutes;
    }
    // records need sessions known to the minute: the play log
    for (const s of ds.logSessions)
      if (!Number.isNaN(s.start) && s.start >= from && s.start < to && (system || !isSystem(s.tid)) && (!longest || s.minutes > longest.minutes)) longest = s;
    // first time ever played falls into this year
    const firstEver = new Map<string, number>();
    for (const s of play) firstEver.set(s.tid, Math.min(firstEver.get(s.tid) ?? Infinity, s.start));
    const newGames = [...firstEver].filter(([, m]) => m >= from && m < to).map(([t]) => t);
    const top = [...byTitle].sort((a, b) => b[1] - a[1]);
    const busiestDay = [...days].sort((a, b) => b[1] - a[1])[0];
    let steps = 0;
    for (const [d, n] of stepsPerDay(ds)) if (d >= from && d < to) steps += n;
    return {
      total: inYear.reduce((a, s) => a + s.minutes, 0), days: days.size, top, longest, busiestDay, steps,
      month: months.indexOf(Math.max(...months)), monthMin: Math.max(...months),
      weekday: weekdays.indexOf(Math.max(...weekdays)), newGames,
    };
  }, [ds, play, from, to, system]);
  if (!r.top.length) return <section class="card"><p class="muted">{T.nothingInPeriod}</p></section>;
  const fav = r.top[0];
  const monthName = new Date(Date.UTC(year, r.month, 1)).toLocaleDateString(loc, { timeZone: "UTC", month: "long" });
  const weekdayName = new Date(Date.UTC(2024, 0, 1 + r.weekday)).toLocaleDateString(loc, { timeZone: "UTC", weekday: "long" }); // 1.1.2024 was a Monday
  return (
    <section class="card recap">
      <div class="card-title"><h3>{T.recapTitle(year)}</h3></div>
      <div class="recap-hero">
        <Icon title={ds.titles.get(fav[0])} size={96} />
        <div>
          <div class="muted small">{T.mostPlayed}</div>
          <h2>{titleName(ds.titles.get(fav[0]), fav[0])}</h2>
          <div>{T.hours(h1(fav[1]))} · {Math.round((100 * fav[1]) / r.total)} % {T.ofYear}</div>
        </div>
      </div>
      <div class="facts">
        <div><b>{T.hours(h1(r.total))}</b><span>{T.playtime}</span></div>
        <div><b>{r.days}</b><span>{T.daysPlayed}</span></div>
        <div><b>{r.top.length}</b><span>{T.games}</span></div>
        <div><b>{r.newGames.length}</b><span>{T.newGames}</span></div>
        <div><b>{monthName}</b><span>{T.busiestMonth} ({dur(r.monthMin)})</span></div>
        <div><b>{weekdayName}</b><span>{T.busiestWeekday}</span></div>
        {r.busiestDay && <div><b>{fmtDate(r.busiestDay[0])}</b><span>{T.busiestDay} ({dur(r.busiestDay[1])})</span></div>}
        {r.longest && <div><b>{dur(r.longest.minutes)}</b><span>{T.longestSession}: {titleName(ds.titles.get(r.longest.tid), r.longest.tid)}</span></div>}
        {r.steps > 0 && <div><b>{r.steps.toLocaleString(loc)}</b><span>{T.steps}</span></div>}
      </div>
      <h4>{T.topGames}</h4>
      <table class="games">
        <tbody>
          {r.top.slice(0, 10).map(([tid, m], i) => (
            <tr key={tid}>
              <td class="rank">{i + 1}</td>
              <td><Icon title={ds.titles.get(tid)} size={32} /></td>
              <td>{titleName(ds.titles.get(tid), tid)}{r.newGames.includes(tid) && <span class="badge">{T.newBadge}</span>}</td>
              <td class="share"><div style={{ width: `${(100 * m) / fav[1]}%` }} /></td>
              <td class="num">{dur(m)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ------------------------------------------------------------------ calendar

function Calendar({ play, year }: { play: Session[]; year: number }) {
  const from = yearStart(year), to = yearStart(year + 1);
  const perDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of play) if (s.start >= from && s.start < to) {
      const d = periodStart(s.start, "day");
      m.set(d, (m.get(d) ?? 0) + s.minutes);
    }
    return m;
  }, [play, from, to]);
  const max = Math.max(1, ...perDay.values());
  const first = periodStart(from, "week"); // the Monday of the first week
  const weeks: number[][] = [];
  for (let w = first; w < to; w = periodNext(w, "week")) weeks.push([0, 1, 2, 3, 4, 5, 6].map((i) => w + i * DAY));
  const level = (m: number) => (m <= 0 ? 0 : m < max * 0.15 ? 1 : m < max * 0.35 ? 2 : m < max * 0.65 ? 3 : 4);
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(year, i, 1)).toLocaleDateString(loc, { timeZone: "UTC", month: "short" }));
  return (
    <section class="card">
      <div class="card-title">
        <h3>{T.calendar}</h3>
        <span class="legend muted small">{T.less} {[0, 1, 2, 3, 4].map((l) => <i key={l} class={"cell l" + l} />)} {T.more}</span>
      </div>
      <div class="calendar">
        <div class="cal-months">{months.map((m) => <span key={m}>{m}</span>)}</div>
        <div class="cal-grid">
          {weeks.map((w) => (
            <div class="cal-week" key={w[0]}>
              {w.map((d) => {
                const inYear = d >= from && d < to;
                const m = perDay.get(d) ?? 0;
                return <i key={d} class={"cell " + (inYear ? "l" + level(m) : "out")}
                  title={inYear ? `${fmtDate(d)}: ${m ? dur(m) : "–"}` : ""} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ latest sessions

function Latest({ ds, system }: { ds: Dataset; system: boolean }) {
  const [n, setN] = useState(20);
  const list = useMemo(() => ds.logSessions
    .filter((s) => !Number.isNaN(s.start) && (system || !isSystem(s.tid)) && s.minutes >= 1)
    .sort((a, b) => b.start - a.start), [ds, system]);
  const now = nowMinutes();
  return (
    <section class="card">
      <div class="card-title"><h3>{T.latestSessions}</h3></div>
      {list.length === 0 && <p class="muted">{T.noSessions}</p>}
      <table class="games">
        <tbody>
          {list.slice(0, n).map((s, i) => {
            const d = asDate(s.start);
            const time = d.toLocaleTimeString(loc, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
            return (
              <tr key={i}>
                <td><Icon title={ds.titles.get(s.tid)} size={32} /></td>
                <td>{titleName(ds.titles.get(s.tid), s.tid)}</td>
                <td class="num muted">{s.start > now - 7 * DAY ? d.toLocaleDateString(loc, { timeZone: "UTC", weekday: "short" }) + " " : ""}{fmtDate(s.start)} {time}</td>
                <td class="num">{dur(s.minutes)}</td>
                {ds.sources.length > 1 && <td class="muted small">{ds.sources.find((x) => (x.console.id || x.console.name) === s.source)?.console.name}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {list.length > n && <button class="more" onClick={() => setN(n + 50)}>{T.showMore}</button>}
    </section>
  );
}

// ------------------------------------------------------------------ several consoles

function Consoles({ ds }: { ds: Dataset }) {
  return (
    <section class="card">
      <div class="card-title"><h3>{T.consoles}</h3></div>
      <table class="games">
        <tbody>
          {ds.sources.map((src) => {
            const id = src.console.id || src.console.name;
            const mine = ds.sessions.filter((s) => s.source === id && !Number.isNaN(s.start));
            const total = mine.reduce((a, s) => a + s.minutes, 0);
            const first = Math.min(...mine.map((s) => s.start)), last = Math.max(...mine.map((s) => s.start));
            return (
              <tr key={id}>
                <td>{src.console.name}<div class="muted small">{src.console.model}</div></td>
                <td class="num">{T.hours(h1(total))}</td>
                <td class="num muted">{fmtDate(first)} – {fmtDate(last)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
