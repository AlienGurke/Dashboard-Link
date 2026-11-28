import { render } from "preact";
import { useRef, useState } from "preact/hooks";
import { combine } from "./data/dataset.ts";
import type { Dataset } from "./data/dataset.ts";
import { smdhLang, T } from "./i18n.ts";
import { fromDrop, fromFileList } from "./load.ts";
import { Classic } from "./views/Classic.tsx";
import { Overview } from "./views/Overview.tsx";
import { Profile } from "./views/Profile.tsx";
import "./style.css";

type View = "profile" | "classic" | "overview";

function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("profile");
  const [over, setOver] = useState(false);
  const dirInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const load = async (get: () => Promise<Awaited<ReturnType<typeof fromFileList>>>) => {
    setBusy(true);
    setError("");
    try {
      const folders = await get();
      if (!folders.length) { setError(T.nothing); return; }
      setDs(combine(folders, smdhLang));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ds)
    return (
      <main class="start">
        <h1>{T.title}</h1>
        <p>{T.intro}</p>
        <div
          class={"dropzone" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer) { const dt = e.dataTransfer; load(() => fromDrop(dt)); } }}
        >
          <b>{busy ? T.reading : T.drop}</b>
          <span class="muted">{T.dropHint}</span>
          <div class="buttons">
            <button onClick={() => dirInput.current?.click()}>{T.choose}</button>
            <button onClick={() => zipInput.current?.click()}>{T.chooseZip}</button>
          </div>
          <input ref={dirInput} type="file" hidden {...{ webkitdirectory: "" }} multiple
            onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f) load(() => fromFileList(f)); }} />
          <input ref={zipInput} type="file" hidden accept=".zip"
            onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f) load(() => fromFileList(f)); }} />
        </div>
        {error && <p class="error">{error}</p>}
        <p class="muted small">{T.privacy}</p>
      </main>
    );

  return (
    <main>
      <header class="top">
        <h1>{T.title}</h1>
        <nav>
          <button class={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>{T.viewProfile}</button>
          <button class={view === "classic" ? "active" : ""} onClick={() => setView("classic")}>{T.viewClassic}</button>
          <button class={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>{T.viewOverview}</button>
        </nav>
        <button class="link" onClick={() => setDs(null)}>{T.other}</button>
      </header>
      {ds.notes.map((n) => <p class="note" key={n}>{T.noteLabel}: {n}</p>)}
      {view === "profile" && <Profile ds={ds} />}
      {view === "classic" && <Classic ds={ds} />}
      {view === "overview" && <Overview ds={ds} />}
    </main>
  );
}

render(<App />, document.getElementById("app")!);
