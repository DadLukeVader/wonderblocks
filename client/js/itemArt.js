// WonderBlocks item icon art hook: optional per-item PNGs in client/art/.
//
// client/art/items.json maps "<itemId>" -> "items/<file>.png"
// (paths relative to client/art/). Missing file, missing entry, bad JSON,
// or no network -> the loader simply returns no entry for that id and the
// caller falls back to the item's emoji icon + color swatch.
// This module must never throw or break the game when art is absent.

export async function loadItemIcons() {
  const map = new Map(); // itemId -> 'art/items/<file>.png'
  try {
    const res = await fetch('art/items.json', { cache: 'no-store' });
    if (!res.ok) return map; // 404: no custom art yet — emoji fallback
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return map;
    for (const [id, file] of Object.entries(data)) {
      const n = Number(id);
      if (!Number.isInteger(n)) continue;
      if (typeof file !== 'string' || !file) continue;
      if (file.includes('..') || file.startsWith('/')) continue; // stay inside art/
      map.set(n, 'art/' + file.replace(/^\.\//, ''));
    }
  } catch {
    /* art is decorative — never let it break the game */
  }
  return map;
}
