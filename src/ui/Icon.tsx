import type { TitleInfo } from "../data/formats.ts";

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

export const titleName = (t: TitleInfo | undefined, tid: string) => t?.name || tid;
