// Getting the files in: a dropped or chosen folder (one or several activity folders inside),
// or a ZIP of it. Everything stays in the browser.

import { unzipSync } from "fflate";
import type { FolderFiles } from "./data/dataset.ts";

const WANTED = /^(playhistory\.bin|pld\.dat|steps\.bin|idb\.dat|idbt\.dat|clock\.txt|console\.txt|[0-9a-f]{16}\.smdh)$/i;

/** path -> data, for the files we read; grouped by the folder they are in */
function group(files: { path: string; data: ArrayBuffer }[]): FolderFiles[] {
  const dirs = new Map<string, FolderFiles>();
  for (const f of files) {
    const parts = f.path.replace(/\\/g, "/").split("/");
    const name = parts.pop()!.toLowerCase();
    if (!WANTED.test(name)) continue;
    // icons/<title id>.smdh belong to the activity folder above them
    if (name.endsWith(".smdh") && parts[parts.length - 1]?.toLowerCase() === "icons") parts.pop();
    const dir = parts.join("/");
    if (!dirs.has(dir)) dirs.set(dir, new Map());
    dirs.get(dir)!.set(name, f.data);
  }
  return [...dirs.values()].filter((d) => d.has("playhistory.bin") || d.has("pld.dat"));
}

async function fromZip(buf: ArrayBuffer): Promise<{ path: string; data: ArrayBuffer }[]> {
  const out: { path: string; data: ArrayBuffer }[] = [];
  const z = unzipSync(new Uint8Array(buf), { filter: (f) => WANTED.test(f.name.split("/").pop() ?? "") });
  for (const [path, d] of Object.entries(z)) out.push({ path, data: d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) as ArrayBuffer });
  return out;
}

export async function fromFileList(list: FileList | File[]): Promise<FolderFiles[]> {
  const files: { path: string; data: ArrayBuffer }[] = [];
  for (const f of Array.from(list)) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (/\.zip$/i.test(f.name)) files.push(...(await fromZip(await f.arrayBuffer())));
    else if (WANTED.test(f.name)) files.push({ path, data: await f.arrayBuffer() });
  }
  return group(files);
}

/** a drop: folders are walked */
export async function fromDrop(dt: DataTransfer): Promise<FolderFiles[]> {
  const files: File[] = [];
  const paths = new Map<File, string>();
  const walk = async (entry: FileSystemEntry, path: string): Promise<void> => {
    if (entry.isFile) {
      const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      files.push(f);
      paths.set(f, path + f.name);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, path + entry.name + "/");
      }
    }
  };
  const entries = Array.from(dt.items).map((i) => i.webkitGetAsEntry()).filter(Boolean) as FileSystemEntry[];
  if (entries.length) for (const e of entries) await walk(e, "");
  else files.push(...Array.from(dt.files));
  const all: { path: string; data: ArrayBuffer }[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) all.push(...(await fromZip(await f.arrayBuffer())));
    else if (WANTED.test(f.name)) all.push({ path: paths.get(f) ?? f.name, data: await f.arrayBuffer() });
  }
  return group(all);
}
