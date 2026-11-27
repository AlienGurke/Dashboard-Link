// "Profile": recently played, the past two weeks, and every game with its time.

import { useMemo, useState } from "preact/hooks";
import { isSystem, nowMinutes, titleStats } from "../data/dataset.ts";
import type { Dataset, TitleStats } from "../data/dataset.ts";
import { fmtDate, T } from "../i18n.ts";
import { Icon, titleName } from "../ui/Icon.tsx";

const h = (min: number) => min / 60;

export function Profile({ ds }: { ds: Dataset }) {
  const [sort, setSort] = useState<"time" | "last" | "name">("time");
  const [system, setSystem] = useState(false);
  const now = nowMinutes();
  const since = now - 14 * 24 * 60;
  const stats = useMemo(() => titleStats(ds, since), [ds, since]);
  const list = [...stats.values()].filter((s) => system || !isSystem(s.tid));
  const name = (s: TitleStats) => titleName(ds.titles.get(s.tid), s.tid);

  const recent = list.filter((s) => s.recent > 0).sort((a, b) => b.last - a.last);
  const recentMin = recent.reduce((a, s) => a + s.recent, 0);
  const totalMin = list.reduce((a, s) => a + s.minutes, 0);
  const first = Math.min(...list.map((s) => s.first).filter(Number.isFinite));
  const sorted = [...list].sort((a, b) =>
    sort === "time" ? b.minutes - a.minutes : sort === "last" ? b.last - a.last : name(a).localeCompare(name(b)));
  const consoles = ds.sources.map((s) => s.console.name).join(" · ");

  return (
    <div class="profile">
      <section class="card profile-head">
        <div>
          <h2>{consoles}</h2>
          <div class="muted">{T.since} {fmtDate(first)}</div>
        </div>
        <div class="big-numbers">
          <div><b>{T.hoursShort(Math.round(h(totalMin)))}</b><span>{T.playtime}</span></div>
          <div><b>{list.length}</b><span>{T.games}</span></div>
          <div><b>{T.hoursShort(Math.round(h(recentMin) * 10) / 10)}</b><span>{T.last2weeks}</span></div>
        </div>
      </section>

      <section class="card">
        <div class="card-title">
          <h3>{T.recentGames}</h3>
          <span class="muted">{T.recentTotal(T.hours(Math.round(h(recentMin) * 10) / 10))}</span>
        </div>
        {recent.length === 0 && <p class="muted">{T.nothingRecent}</p>}
        <div class="recent">
          {recent.slice(0, 3).map((s) => (
            <div class="recent-game" key={s.tid}>
              <Icon title={ds.titles.get(s.tid)} size={96} />
              <div class="recent-info">
                <div class="game-name">{name(s)}</div>
                <div>{T.hours(Math.round(h(s.recent) * 10) / 10)} <span class="muted">{T.last2weeks}</span></div>
                <div>{T.hours(Math.round(h(s.minutes) * 10) / 10)} <span class="muted">{T.total}</span></div>
                <div class="muted">{T.lastPlayed} {fmtDate(s.last)}</div>
              </div>
            </div>
          ))}
        </div>
        {recent.length > 3 && (
          <table class="games compact">
            <tbody>
              {recent.slice(3).map((s) => (
                <tr key={s.tid}>
                  <td><Icon title={ds.titles.get(s.tid)} size={32} /></td>
                  <td>{name(s)}</td>
                  <td class="num">{T.hoursShort(Math.round(h(s.recent) * 10) / 10)}</td>
                  <td class="num muted">{T.hoursShort(Math.round(h(s.minutes)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section class="card">
        <div class="card-title">
          <h3>{T.allGames} <span class="muted">({list.length})</span></h3>
          <div class="controls">
            <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)}>
              <option value="time">{T.sortTime}</option>
              <option value="last">{T.sortLast}</option>
              <option value="name">{T.sortName}</option>
            </select>
            <label><input type="checkbox" checked={system} onChange={(e) => setSystem((e.target as HTMLInputElement).checked)} /> {T.showSystem}</label>
          </div>
        </div>
        <table class="games">
          <thead><tr><th /><th /><th class="num">{T.playtime}</th><th class="num">{T.starts}</th><th class="num">{T.firstPlayed}</th><th class="num">{T.lastPlayed}</th></tr></thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.tid}>
                <td><Icon title={ds.titles.get(s.tid)} size={40} /></td>
                <td>{name(s)}</td>
                <td class="num">{T.hoursShort(Math.round(h(s.minutes) * 10) / 10)}</td>
                <td class="num">{s.launches || "–"}</td>
                <td class="num muted">{fmtDate(s.first)}</td>
                <td class="num muted">{fmtDate(s.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
