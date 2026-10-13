// WonderBlocks animal art hook: optional per-kind texture overrides.
// Reads client/art/animals.json — { "<kind>": "animals/<file>.png" } where the
// path is relative to client/art/ (e.g. "deer": "animals/deer.png").
// Every kind without a working texture maps to null and the game renders the
// fully procedural box model instead. This function NEVER throws: a missing
// manifest, bad JSON, a failed download, or a headless environment all degrade
// silently to procedural art.
import * as THREE from 'three';

const MANIFEST_URL = 'art/animals.json';
const ART_BASE = 'art/';

export async function loadAnimalTextures() {
  const out = new Map();
  let manifest = {};
  try {
    const r = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (r.ok) manifest = await r.json();
  } catch { /* no art manifest — stay fully procedural */ }
  if (!manifest || typeof manifest !== 'object') return out;
  await Promise.all(Object.entries(manifest).map(async ([kind, rel]) => {
    if (typeof rel !== 'string' || !rel) { out.set(kind, null); return; }
    try {
      const tex = await new THREE.TextureLoader().loadAsync(ART_BASE + rel);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter; // crisp pixel look like the atlas
      tex.minFilter = THREE.NearestFilter;
      out.set(kind, tex);
    } catch { out.set(kind, null); } // 404 / corrupt file — procedural fallback
  }));
  return out;
}
