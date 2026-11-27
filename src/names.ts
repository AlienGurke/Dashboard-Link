// Own names for titles (e.g. "Pokémon Rumble World (Free-to-Play)"), kept in this browser only.

const KEY = "dashboard-link.names";
let names: Record<string, string> = {};
try { names = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { names = {}; }

export const ownName = (tid: string): string | undefined => names[tid];

export function setOwnName(tid: string, name: string) {
  const v = name.trim();
  if (v) names[tid] = v; else delete names[tid];
  try { localStorage.setItem(KEY, JSON.stringify(names)); } catch { /* storage may be off: works until closed */ }
}
