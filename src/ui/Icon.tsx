import type { TitleInfo } from "../data/formats.ts";
import { ownName, setOwnName } from "../names.ts";
import { T } from "../i18n.ts";

const cache = new Map<string, string>();

/** the title's picture from the icon cache, as a data URL (made once) */
export function iconUrl(t: TitleInfo | undefined): string | undefined {
  if (!t?.icon) return undefined;
  const hit = cache.get(t.tid);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const n = t.iconSize ?? 48;
  c.width = c.height = n;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(t.icon), n, n), 0, 0);
  const url = c.toDataURL();
  cache.set(t.tid, url);
  return url;
}

export function Icon({ title, size = 48 }: { title?: TitleInfo; size?: number }) {
  const url = iconUrl(title);
  return url
    ? <img class="icon" src={url} width={size} height={size} alt="" />
    : <div class="icon icon-empty" style={{ width: size, height: size }} />;
}

export const titleName = (t: TitleInfo | undefined, tid: string) => ownName(tid) || t?.name || tid;

/** a title's name; a click lets you give it your own (kept in this browser) */
export function Name({ title, tid, onChange }: { title?: TitleInfo; tid: string; onChange: () => void }) {
  const shown = titleName(title, tid);
  return (
    <span class="name" title={`${tid}${title?.name && ownName(tid) ? " · " + title.name : ""}\n${T.renameHint}`}
      onClick={() => {
        const v = prompt(T.renamePrompt(title?.name || tid), ownName(tid) ?? shown);
        if (v !== null) { setOwnName(tid, v); onChange(); }
      }}>{shown}</span>
  );
}
