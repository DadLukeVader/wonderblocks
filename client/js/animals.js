// WonderBlocks critters: 15 wild kinds + feed-to-tame pets + breeding,
// babies, pet collars, and rideable mounts (horse, pig).
// Procedural box models (THREE.BoxGeometry + flat pastel colors). If
// client/art/animals.json maps a kind to a texture, that texture replaces the
// flat color on the animal's MAIN BODY box (see animalArt.js) — everything
// else stays procedural, and a missing/failed texture never breaks the game.
//
// Taming: walk up to any wild animal carrying its favorite food and tap the
// floating feed button. Each feed = +1 trust; tamed at feedsToTame feeds
// (threshold model — see shared/animalDefs.js). Tamed pets follow you; the
// stay/follow toggle (setPetsMode) parks them in place.
import * as THREE from 'three';
import { B } from 'wb-shared/blocks.js?v=21';
import { biomeNameAt, getSpawn } from 'wb-shared/worldgen.js?v=21';
import { ANIMAL_DEFS, petName } from 'wb-shared/animalDefs.js?v=21';
import { foodDef } from 'wb-shared/foods.js?v=21';
import { loadAnimalTextures } from './animalArt.js?v=21';

// One box part. tex (optional) replaces the flat color — used for the body.
function part(w, h, d, color, x = 0, y = 0, z = 0, tex = null) {
  const mat = tex
    ? new THREE.MeshLambertMaterial({ map: tex })
    : new THREE.MeshLambertMaterial({ color });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- original five (kept, texture-aware) ----------
function makeRabbit(tex) {
  const g = new THREE.Group();
  const c = Math.random() < 0.5 ? '#f5f5f5' : '#c9b8a8';
  g.add(part(0.4, 0.35, 0.5, c, 0, 0.28, 0, tex));
  g.add(part(0.28, 0.28, 0.28, c, 0, 0.5, 0.3));
  g.add(part(0.08, 0.3, 0.08, c, -0.09, 0.78, 0.28));
  g.add(part(0.08, 0.3, 0.08, c, 0.09, 0.78, 0.28));
  g.add(part(0.14, 0.14, 0.14, '#ffffff', 0, 0.35, -0.3));
  return { g, kind: 'rabbit', hop: true };
}
function makeChicken(tex) {
  const g = new THREE.Group();
  g.add(part(0.35, 0.35, 0.4, '#ffffff', 0, 0.32, 0, tex));
  g.add(part(0.25, 0.25, 0.25, '#ffffff', 0, 0.55, 0.22));
  g.add(part(0.08, 0.08, 0.12, '#ffa94d', 0, 0.52, 0.4));
  g.add(part(0.1, 0.12, 0.06, '#ff6b6b', 0, 0.72, 0.22));
  g.add(part(0.3, 0.06, 0.25, '#fff3d6', 0, 0.42, -0.1));
  return { g, kind: 'chicken', hop: true };
}
function makeButterfly(tex) {
  const g = new THREE.Group();
  const cols = ['#ff9dcf', '#9dcfff', '#ffe066', '#c09dff'];
  const c = cols[(Math.random() * cols.length) | 0];
  const wm = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), wm); w1.position.x = -0.15;
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), wm); w2.position.x = 0.15;
  g.add(w1, w2, part(0.08, 0.08, 0.3, '#5b4a68', 0, 0, 0, tex));
  return { g, kind: 'butterfly', wings: [w1, w2], fly: true };
}
function makeBird(tex) {
  const g = new THREE.Group();
  const c = ['#74c0fc', '#ffd43b', '#ff8fab'][(Math.random() * 3) | 0];
  g.add(part(0.3, 0.22, 0.42, c, 0, 0, 0, tex));
  g.add(part(0.2, 0.2, 0.2, c, 0, 0.16, 0.26));
  const wm = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.25), wm); w1.position.x = -0.32;
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.25), wm); w2.position.x = 0.32;
  g.add(w1, w2);
  return { g, kind: 'bird', wings: [w1, w2], fly: true, circle: true };
}
function makeFish(tex) {
  const g = new THREE.Group();
  const c = ['#ffa94d', '#74c0fc', '#ff8fab'][(Math.random() * 3) | 0];
  g.add(part(0.35, 0.22, 0.18, c, 0, 0, 0, tex));
  g.add(part(0.14, 0.16, 0.06, c, -0.24, 0, 0));
  return { g, kind: 'fish', swim: true };
}

// ---------- new eight ----------
function makeDeer(tex) {
  const g = new THREE.Group();
  const tan = '#d9a86c';
  g.add(part(0.55, 0.5, 0.85, tan, 0, 0.62, 0, tex));
  for (const [sx, sz] of [[-0.15, 0.15], [0.15, -0.1], [0, 0.32]])
    g.add(part(0.14, 0.05, 0.14, '#fdf6ec', sx, 0.89, sz));
  const head = new THREE.Group(); head.position.set(0, 1.02, 0.45);
  head.add(part(0.34, 0.34, 0.34, tan, 0, 0.12, 0.1));
  head.add(part(0.18, 0.16, 0.16, '#f2e3c9', 0, 0.06, 0.32));
  head.add(part(0.08, 0.06, 0.05, '#5b4a68', 0, 0.08, 0.4));
  head.add(part(0.05, 0.08, 0.02, '#2b2b3a', -0.18, 0.16, 0.14));
  head.add(part(0.05, 0.08, 0.02, '#2b2b3a', 0.18, 0.16, 0.14));
  head.add(part(0.08, 0.14, 0.06, tan, -0.12, 0.34, 0.05));
  head.add(part(0.08, 0.14, 0.06, tan, 0.12, 0.34, 0.05));
  const a1 = part(0.06, 0.24, 0.06, '#8a5a32', -0.1, 0.44, 0); a1.rotation.z = 0.35;
  const a2 = part(0.06, 0.24, 0.06, '#8a5a32', 0.1, 0.44, 0); a2.rotation.z = -0.35;
  head.add(a1, a2);
  g.add(head);
  for (const [sx, sz] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]])
    g.add(part(0.12, 0.5, 0.12, '#b78d58', sx, 0.25, sz));
  g.add(part(0.14, 0.14, 0.12, '#fdf6ec', 0, 0.66, -0.48));
  return { g, kind: 'deer', hop: true, graze: true, head };
}
function makeWolf(tex) {
  const g = new THREE.Group();
  const fur = '#9aa3b2';
  g.add(part(0.6, 0.5, 0.9, fur, 0, 0.55, 0, tex));
  g.add(part(0.36, 0.36, 0.36, fur, 0, 0.95, 0.5));
  g.add(part(0.2, 0.18, 0.22, '#7d8794', 0, 0.88, 0.72));
  g.add(part(0.08, 0.07, 0.05, '#2b2b3a', 0, 0.9, 0.83));
  g.add(part(0.12, 0.2, 0.08, fur, -0.12, 1.2, 0.48));
  g.add(part(0.12, 0.2, 0.08, fur, 0.12, 1.2, 0.48));
  g.add(part(0.05, 0.07, 0.02, '#ffb347', -0.19, 1.0, 0.62));
  g.add(part(0.05, 0.07, 0.02, '#ffb347', 0.19, 1.0, 0.62));
  g.add(part(0.3, 0.3, 0.1, '#f2f4f7', 0, 0.5, 0.46));
  const tail = part(0.16, 0.16, 0.4, '#8b94a3', 0, 0.75, -0.6); tail.rotation.x = 0.5;
  g.add(tail);
  for (const [sx, sz] of [[-0.19, 0.3], [0.19, 0.3], [-0.19, -0.3], [0.19, -0.3]])
    g.add(part(0.13, 0.5, 0.13, '#7d8794', sx, 0.25, sz));
  return { g, kind: 'wolf', hop: true, assist: true };
}
function makeBear(tex) {
  const g = new THREE.Group();
  const fur = '#9c6b4f';
  g.add(part(0.75, 0.65, 0.9, fur, 0, 0.6, 0, tex));
  g.add(part(0.44, 0.42, 0.42, fur, 0, 1.12, 0.5));
  g.add(part(0.14, 0.14, 0.08, '#8a5a40', -0.16, 1.36, 0.48));
  g.add(part(0.14, 0.14, 0.08, '#8a5a40', 0.16, 1.36, 0.48));
  g.add(part(0.24, 0.2, 0.2, '#d9b48a', 0, 1.04, 0.72));
  g.add(part(0.1, 0.08, 0.05, '#2b2b3a', 0, 1.08, 0.82));
  g.add(part(0.06, 0.08, 0.02, '#2b2b3a', -0.23, 1.18, 0.62));
  g.add(part(0.06, 0.08, 0.02, '#2b2b3a', 0.23, 1.18, 0.62));
  for (const [sx, sz] of [[-0.24, 0.3], [0.24, 0.3], [-0.24, -0.3], [0.24, -0.3]])
    g.add(part(0.2, 0.5, 0.2, '#8a5a40', sx, 0.25, sz));
  return { g, kind: 'bear', hop: true, slow: true, assist: true };
}
function makeFox(tex) {
  const g = new THREE.Group();
  const fur = '#ef8f4c';
  g.add(part(0.5, 0.42, 0.75, fur, 0, 0.5, 0, tex));
  g.add(part(0.32, 0.32, 0.32, fur, 0, 0.85, 0.42));
  g.add(part(0.16, 0.14, 0.16, '#fdf6ec', 0, 0.79, 0.62));
  g.add(part(0.07, 0.06, 0.04, '#2b2b3a', 0, 0.81, 0.7));
  g.add(part(0.12, 0.26, 0.08, fur, -0.11, 1.1, 0.4));
  g.add(part(0.12, 0.26, 0.08, fur, 0.11, 1.1, 0.4));
  g.add(part(0.12, 0.08, 0.08, '#5b4a68', -0.11, 1.2, 0.4));
  g.add(part(0.12, 0.08, 0.08, '#5b4a68', 0.11, 1.2, 0.4));
  g.add(part(0.05, 0.07, 0.02, '#2b2b3a', -0.17, 0.9, 0.53));
  g.add(part(0.05, 0.07, 0.02, '#2b2b3a', 0.17, 0.9, 0.53));
  g.add(part(0.26, 0.28, 0.08, '#fdf6ec', 0, 0.44, 0.38));
  const tail = part(0.22, 0.22, 0.4, fur, 0, 0.55, -0.55); tail.rotation.x = 0.35;
  g.add(tail);
  g.add(part(0.2, 0.2, 0.16, '#fdf6ec', 0, 0.64, -0.78));
  for (const [sx, sz] of [[-0.16, 0.24], [0.16, 0.24], [-0.16, -0.24], [0.16, -0.24]])
    g.add(part(0.11, 0.42, 0.11, '#b06a35', sx, 0.21, sz));
  return { g, kind: 'fox', hop: true };
}
function makeFrog(tex) {
  const g = new THREE.Group();
  g.add(part(0.5, 0.3, 0.55, '#7bc96f', 0, 0.28, 0, tex));
  g.add(part(0.4, 0.12, 0.45, '#e8f7e0', 0, 0.16, 0.02));
  g.add(part(0.14, 0.14, 0.14, '#fdfdfd', -0.14, 0.52, 0.18));
  g.add(part(0.14, 0.14, 0.14, '#fdfdfd', 0.14, 0.52, 0.18));
  g.add(part(0.06, 0.08, 0.02, '#2b2b3a', -0.14, 0.52, 0.26));
  g.add(part(0.06, 0.08, 0.02, '#2b2b3a', 0.14, 0.52, 0.26));
  g.add(part(0.16, 0.22, 0.4, '#6ab85e', -0.3, 0.2, -0.05));
  g.add(part(0.16, 0.22, 0.4, '#6ab85e', 0.3, 0.2, -0.05));
  g.add(part(0.1, 0.22, 0.1, '#6ab85e', -0.18, 0.14, 0.28));
  g.add(part(0.1, 0.22, 0.1, '#6ab85e', 0.18, 0.14, 0.28));
  g.add(part(0.3, 0.03, 0.02, '#4a7a40', 0, 0.3, 0.29));
  return { g, kind: 'frog', hop: true, swim: true };
}
function makeTurtle(tex) {
  const g = new THREE.Group();
  g.add(part(0.62, 0.3, 0.72, '#4e9b5e', 0, 0.36, 0, tex));
  g.add(part(0.7, 0.12, 0.8, '#3f8250', 0, 0.26, 0));
  g.add(part(0.12, 0.05, 0.12, '#8fd6a0', -0.15, 0.53, 0.1));
  g.add(part(0.12, 0.05, 0.12, '#8fd6a0', 0.15, 0.53, -0.1));
  g.add(part(0.24, 0.22, 0.24, '#7bc96f', 0, 0.34, 0.45));
  g.add(part(0.05, 0.06, 0.02, '#2b2b3a', -0.13, 0.38, 0.56));
  g.add(part(0.05, 0.06, 0.02, '#2b2b3a', 0.13, 0.38, 0.56));
  for (const [sx, sz] of [[-0.3, 0.28], [0.3, 0.28], [-0.3, -0.28], [0.3, -0.28]])
    g.add(part(0.14, 0.12, 0.14, '#7bc96f', sx, 0.12, sz));
  g.add(part(0.1, 0.08, 0.12, '#7bc96f', 0, 0.2, -0.42));
  return { g, kind: 'turtle', swim: true, slow: true };
}
function makeBee(tex) {
  const g = new THREE.Group();
  g.add(part(0.34, 0.3, 0.44, '#ffd93b', 0, 0, 0, tex));
  g.add(part(0.36, 0.32, 0.09, '#5b4a68', 0, 0, -0.1));
  g.add(part(0.36, 0.32, 0.09, '#5b4a68', 0, 0, 0.12));
  g.add(part(0.2, 0.2, 0.16, '#5b4a68', 0, 0.02, 0.28));
  g.add(part(0.04, 0.06, 0.02, '#fdfdfd', -0.11, 0.05, 0.35));
  g.add(part(0.04, 0.06, 0.02, '#fdfdfd', 0.11, 0.05, 0.35));
  g.add(part(0.06, 0.06, 0.1, '#5b4a68', 0, 0, -0.26));
  const wm = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), wm); w1.position.set(-0.18, 0.18, 0);
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), wm); w2.position.set(0.18, 0.18, 0);
  g.add(w1, w2);
  return { g, kind: 'bee', wings: [w1, w2], fly: true };
}
function makeSheep(tex) {
  const g = new THREE.Group();
  g.add(part(0.62, 0.5, 0.78, '#f7f4ef', 0, 0.58, 0, tex));
  for (const [sx, sz] of [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]])
    g.add(part(0.22, 0.22, 0.22, '#ffffff', sx, 0.82, sz));
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.44);
  head.add(part(0.3, 0.3, 0.26, '#8d99a6', 0, 0, 0.08));
  head.add(part(0.1, 0.08, 0.06, '#8d99a6', -0.18, 0.05, 0.02));
  head.add(part(0.1, 0.08, 0.06, '#8d99a6', 0.18, 0.05, 0.02));
  head.add(part(0.05, 0.07, 0.02, '#2b2b3a', -0.08, 0.04, 0.22));
  head.add(part(0.05, 0.07, 0.02, '#2b2b3a', 0.08, 0.04, 0.22));
  g.add(head);
  for (const [sx, sz] of [[-0.2, 0.26], [0.2, 0.26], [-0.2, -0.26], [0.2, -0.26]])
    g.add(part(0.12, 0.42, 0.12, '#8d99a6', sx, 0.21, sz));
  return { g, kind: 'sheep', hop: true, graze: true, head };
}

const MAKERS = {
  rabbit: makeRabbit, chicken: makeChicken, butterfly: makeButterfly, bird: makeBird, fish: makeFish,
  deer: makeDeer, wolf: makeWolf, bear: makeBear, fox: makeFox, frog: makeFrog,
  turtle: makeTurtle, bee: makeBee, sheep: makeSheep, horse: makeHorse, pig: makePig,
};

// ---------- rideable mounts (Phase 5) ----------
function makeHorse(tex) {
  const g = new THREE.Group();
  const coat = '#b08954';
  g.add(part(0.7, 0.6, 1.1, coat, 0, 0.95, 0, tex));
  for (const [sx, sz] of [[-0.22, 0.38], [0.22, 0.38], [-0.22, -0.38], [0.22, -0.38]])
    g.add(part(0.16, 0.75, 0.16, '#8a6a42', sx, 0.375, sz));
  const neck = part(0.28, 0.6, 0.3, coat, 0, 1.4, 0.6); neck.rotation.x = -0.35; g.add(neck);
  g.add(part(0.3, 0.32, 0.55, coat, 0, 1.72, 0.78));
  g.add(part(0.12, 0.14, 0.12, coat, -0.1, 1.95, 0.72));
  g.add(part(0.12, 0.14, 0.12, coat, 0.1, 1.95, 0.72));
  g.add(part(0.1, 0.5, 0.12, '#5b4028', 0, 1.55, 0.42)); // mane
  g.add(part(0.06, 0.08, 0.02, '#2b2b3a', -0.08, 1.78, 1.06)); // eyes
  g.add(part(0.06, 0.08, 0.02, '#2b2b3a', 0.08, 1.78, 1.06));
  const tail = part(0.12, 0.5, 0.12, '#5b4028', 0, 1.0, -0.62); tail.rotation.x = 0.25; g.add(tail);
  return { g, kind: 'horse', hop: true, rideable: true };
}
function makePig(tex) {
  const g = new THREE.Group();
  const pink = '#f4a7b9';
  g.add(part(0.55, 0.45, 0.75, pink, 0, 0.5, 0, tex));
  for (const [sx, sz] of [[-0.18, 0.25], [0.18, 0.25], [-0.18, -0.25], [0.18, -0.25]])
    g.add(part(0.12, 0.35, 0.12, '#d98a9e', sx, 0.175, sz));
  g.add(part(0.34, 0.32, 0.3, pink, 0, 0.68, 0.45)); // head
  g.add(part(0.16, 0.12, 0.08, '#e88ba0', 0, 0.62, 0.62)); // snout
  g.add(part(0.1, 0.12, 0.06, pink, -0.12, 0.9, 0.42)); // ears
  g.add(part(0.1, 0.12, 0.06, pink, 0.12, 0.9, 0.42));
  g.add(part(0.05, 0.07, 0.02, '#2b2b3a', -0.08, 0.72, 0.6)); // eyes
  g.add(part(0.05, 0.07, 0.02, '#2b2b3a', 0.08, 0.72, 0.6));
  const tail = part(0.05, 0.05, 0.2, '#d98a9e', 0, 0.6, -0.45); tail.rotation.y = 0.5; g.add(tail);
  return { g, kind: 'pig', hop: true, rideable: true };
}

// Simple biome vocabulary mapped from worldgen's display names.
function biomeCat(x, z) {
  const n = biomeNameAt(x, z);
  if (n === 'Blossom Forest') return 'forest';
  if (n === 'Sunbeam Beach') return 'beach';
  if (n === 'Frosty Peaks') return 'peaks';
  if (n === 'Wonder Village') return 'village';
  if (n === 'Rainbow Sky Island') return 'sky';
  return 'meadow';
}

// Approximate neck anchor per kind: [y, z, torusRadius]. Used by setCollar().
const COLLAR_ANCHOR = {
  horse: [1.45, 0.55, 0.2], pig: [0.72, 0.4, 0.17],
  deer: [1.0, 0.5, 0.16], wolf: [0.95, 0.5, 0.17], bear: [1.1, 0.55, 0.2],
  fox: [0.85, 0.45, 0.15], sheep: [0.8, 0.45, 0.17], turtle: [0.4, 0.45, 0.14],
  frog: [0.35, 0.2, 0.13], rabbit: [0.45, 0.25, 0.11], chicken: [0.5, 0.2, 0.1],
  bird: [0.12, 0.2, 0.09], butterfly: [0.05, 0, 0.06], bee: [0.05, 0.15, 0.08],
  fish: [0, 0, 0.1],
};

// Collar color rotation when applying a new collar.
export const COLLAR_COLORS = ['#ff5a5a', '#4d96ff', '#6bcb77', '#ffd93d', '#c084fc'];

export class Critter {
  constructor(scene, kind, x, y, z, tex = null) {
    const m = (MAKERS[kind] || MAKERS.rabbit)(tex);
    this.kind = kind;
    this.g = m.g;
    // model flags (hop/fly/...) + pure data (favoriteFood, feedsToTame, ...)
    this.def = { ...m, ...ANIMAL_DEFS[kind] };
    // ANIMAL_DEFS has wings: true as a flag — restore the actual wing meshes
    if (m.wings) this.def.wings = m.wings;
    delete this.def.g; delete this.def.kind;
    this.g.position.set(x, y, z);
    scene.add(this.g);
    this.scene = scene;
    this.target = new THREE.Vector3(x, y, z);
    this.retarget = 0;
    this.phase = Math.random() * 10;
    this.petOf = null;
    this.name = null;
    this.trust = 0;        // feed-to-tame progress
    this.mode = 'follow';  // 'follow' | 'stay'
    this.head = m.head || null; // graze head-bob pivot (deer, sheep)
    // Phase 5: breeding / babies / collars / riding
    this.baby = false;         // baby animals render at 0.5x scale, grow after 5 min
    this.bornAt = 0;
    this.inLoveUntil = 0;      // breeding "in love" window (timestamp ms)
    this.lastBirth = 0;        // per-parent breeding cooldown
    this.collarColor = null;
    this.collarMesh = null;
    this.ridden = false;       // true while a player is mounted (movement handled by rider)
  }

  // Mark as a newborn: half scale, grows to full size after 5 minutes.
  setBaby() {
    this.baby = true;
    this.bornAt = Date.now();
    this.g.scale.setScalar(0.5);
  }

  // Put a colored collar (torus) around the pet's neck.
  setCollar(color) {
    if (this.collarMesh) { this.g.remove(this.collarMesh); this.collarMesh = null; }
    this.collarColor = color;
    if (!color) return;
    const a = COLLAR_ANCHOR[this.kind] || [0.7, 0.3, 0.15];
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(a[2], 0.045, 8, 20),
      new THREE.MeshLambertMaterial({ color })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, a[0], a[1]);
    this.g.add(mesh);
    this.collarMesh = mesh;
  }

  // Where a swimmer wants to rest: water surface if wet, else just off the ground.
  swimRestY(world, p) {
    const gx = Math.floor(p.x), gz = Math.floor(p.z);
    for (let y = Math.ceil(p.y) + 1; y > Math.ceil(p.y) - 3; y--)
      if (world.get(gx, y, gz) === B.WATER) return y + 0.55;
    return world.topY(gx, gz) + 0.9; // beached pet-fish floats like a bubble buddy
  }

  updatePet(dt, world, playerPos) {
    if (this.ridden) return; // mounted: the rider drives movement each frame
    const p = this.g.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 28) { // teleport catch-up when left far behind
      p.set(playerPos.x - 1.5, playerPos.y + 1, playerPos.z - 1.5);
      return;
    }
    if (this.mode === 'stay') { // park in place, face the owner
      const gy = this.def.fly ? playerPos.y + 1.5
        : this.def.swim ? this.swimRestY(world, p)
        : world.topY(Math.floor(p.x), Math.floor(p.z)) + 1;
      p.y += (gy - p.y) * Math.min(1, 4 * dt);
      if (d > 0.5) this.g.rotation.y = Math.atan2(dx, dz);
      return;
    }
    if (d > 2.2 || Math.abs(playerPos.y + 1 - p.y) > 3.5) {
      const a = Math.atan2(dx, dz);
      const sp = this.def.slow ? 2.6 : 4.2;
      p.x += Math.sin(a) * sp * dt; p.z += Math.cos(a) * sp * dt;
      this.g.rotation.y = a;
      let ty;
      if (this.def.fly) ty = playerPos.y + 2.1 + Math.sin(this.phase * 0.7) * 0.4;
      else if (this.def.swim) ty = this.swimRestY(world, p);
      else ty = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1 + Math.abs(Math.sin(this.phase)) * 0.35;
      p.y += (ty - p.y) * Math.min(1, 5 * dt);
    } else {
      let ty;
      if (this.def.fly) ty = playerPos.y + 2.1;
      else if (this.def.swim) ty = this.swimRestY(world, p);
      else ty = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1;
      p.y += (ty - p.y) * Math.min(1, 5 * dt);
    }
  }

  updateWild(dt, world) {
    const p = this.g.position;
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 2 + Math.random() * 4;
      const r = this.def.circle ? 14 : 8;
      this.target.set(
        THREE.MathUtils.clamp(p.x + (Math.random() - 0.5) * 2 * r, 4, 124),
        p.y,
        THREE.MathUtils.clamp(p.z + (Math.random() - 0.5) * 2 * r, 4, 124)
      );
      if (this.def.fly) this.target.y = p.y + (Math.random() - 0.5) * 3;
    }
    const dx = this.target.x - p.x, dz = this.target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const sp = this.def.circle ? 5 : (this.def.slow ? 0.8 : 1.6);
      p.x += dx / d * sp * dt; p.z += dz / d * sp * dt;
      this.g.rotation.y = Math.atan2(dx, dz);
      if (this.def.hop) {
        const gy = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1;
        p.y = gy + Math.abs(Math.sin(this.phase * 1.4)) * 0.45;
      } else if (this.def.swim) {
        p.y += (this.swimRestY(world, p) - p.y) * Math.min(1, 3 * dt);
      }
    } else if (this.def.hop) {
      const gy = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1;
      p.y += (gy - p.y) * Math.min(1, 6 * dt);
    } else if (this.def.swim) {
      p.y += (this.swimRestY(world, p) - p.y) * Math.min(1, 3 * dt);
    }
    if (this.def.fly && !this.def.circle) {
      p.y += Math.sin(this.phase * 0.7) * dt * 1.2;
    }
  }

  update(dt, world, playerPos) {
    this.phase += dt * 6;
    // Babies grow to adults after 5 minutes.
    if (this.baby && Date.now() - this.bornAt > 5 * 60 * 1000) {
      this.baby = false;
      this.g.scale.setScalar(1);
    }
    if (this.petOf) this.updatePet(dt, world, playerPos);
    else this.updateWild(dt, world);
    if (this.def.wings && Array.isArray(this.def.wings)) { // wing flap
      const f = Math.sin(this.phase * 3) * 0.7;
      if (this.def.wings[0]) this.def.wings[0].rotation.y = f;
      if (this.def.wings[1]) this.def.wings[1].rotation.y = -f;
    }
    if (this.head && this.def.graze) { // periodic head-dip grazing (deer, sheep)
      this.head.rotation.x = -Math.abs(Math.sin(this.phase * 0.35)) * 0.6;
    }
  }
  dispose() { this.scene.remove(this.g); }
}

export class CritterManager {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.critters = [];
    this.tex = new Map(); // kind -> THREE.Texture | null (art hook)
    // ASSIST HOOK (stub): no hostiles exist yet. When hostile AI lands, set
    // manager.assistTarget = { x, y, z } (or null) per tick; pets whose def
    // has assist:true (wolf, bear) will engage it instead of idling.
    this.assistTarget = null;
  }

  async spawnInitial() {
    // Art hook first — failures degrade silently to fully procedural models.
    try { this.tex = await loadAnimalTextures(); }
    catch { this.tex = new Map(); }
    const w = this.world;
    const put = (kind, n, test) => {
      let placed = 0, guard = 0;
      while (placed < n && guard++ < 800) {
        const x = 4 + ((Math.random() * 120) | 0), z = 4 + ((Math.random() * 120) | 0);
        const y = test(x, z);
        if (y === null || y === undefined) continue;
        this.critters.push(new Critter(this.scene, kind, x + 0.5, y, z + 0.5, this.tex.get(kind) || null));
        placed++;
      }
    };
    const topBlock = (x, z) => { const h = w.topY(x, z); return { h, b: w.get(x, h, z) }; };
    const groundOK = (x, z) => {
      const { h, b } = topBlock(x, z);
      return (b === B.GRASS || b === B.SAND) && h > 20 && h < 30 ? h + 1 : null;
    };
    const landFor = cats => (x, z) => cats.includes(biomeCat(x, z)) ? groundOK(x, z) : null;
    const peaksOK = (x, z) => { const { h, b } = topBlock(x, z); return b === B.SNOW ? h + 1 : null; };
    const nearWater = (x, z) => {
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]])
        for (let y = 24; y > 14; y--) if (w.get(x + dx, y, z + dz) === B.WATER) return true;
      return false;
    };
    const waterY = (x, z) => {
      for (let y = 24; y > 14; y--) if (w.get(x, y, z) === B.WATER) return y + 0.35;
      return null;
    };

    put('rabbit', 10, landFor(['meadow', 'forest', 'village']));
    put('chicken', 8, landFor(['meadow', 'village']));
    put('butterfly', 14, (x, z) => { const y = landFor(['meadow', 'forest', 'beach'])(x, z); return y == null ? null : y + 1.5 + Math.random(); });
    put('bird', 8, () => 30 + Math.random() * 8); // sky wanderers
    put('fish', 10, waterY);
    put('deer', 8, landFor(['forest', 'meadow']));
    put('wolf', 5, (x, z) => landFor(['forest'])(x, z) ?? peaksOK(x, z));
    put('bear', 3, (x, z) => landFor(['forest'])(x, z) ?? peaksOK(x, z));
    put('fox', 6, landFor(['forest', 'meadow']));
    put('frog', 6, (x, z) => { const y = groundOK(x, z); return (y != null && nearWater(x, z)) ? y : null; });
    put('turtle', 5, waterY);
    put('bee', 10, (x, z) => { const y = landFor(['meadow', 'forest', 'village'])(x, z); return y == null ? null : y + 1.5 + Math.random() * 1.5; });
    put('sheep', 8, landFor(['meadow', 'village']));
    put('horse', 6, landFor(['meadow', 'village']));
    put('pig', 8, landFor(['meadow', 'village']));
  }

  myPets() { return this.critters.filter(c => c.petOf === 'me'); }

  // Nearest tamed pet (any kind) within range.
  nearestPet(pos, maxD = 3.5) {
    let best = null, bd = maxD;
    for (const c of this.critters) {
      if (c.petOf !== 'me') continue;
      const d = Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Nearest tamed, adult, rideable mount within range.
  nearestRideable(pos, maxD = 3.5) {
    let best = null, bd = maxD;
    for (const c of this.critters) {
      if (c.petOf !== 'me' || c.baby || c.ridden || !c.def.rideable) continue;
      const d = Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Feed a TAMED pet its favorite food to put it in "love mode" (breeding).
  // If another tamed, adult, in-love pet of the same kind is nearby, a baby spawns.
  // Returns { ok, reason?, inLove?, bred?, baby? }.
  feedTamed(c, inv) {
    const def = ANIMAL_DEFS[c.kind];
    if (!def) return { ok: false, reason: 'unknown' };
    if (c.baby) return { ok: false, reason: 'baby' };
    if (Date.now() - c.lastBirth < 30000) return { ok: false, reason: 'cooldown' };
    const f = foodDef(def.favoriteFood);
    if (inv.count(def.favoriteFood) < 1) return { ok: false, reason: 'nofood', food: f };
    inv.remove(def.favoriteFood, 1);
    c.inLoveUntil = Date.now() + 60000;
    // find a nearby in-love partner of the same kind
    const now = Date.now();
    for (const o of this.critters) {
      if (o === c || o.petOf !== 'me' || o.kind !== c.kind || o.baby) continue;
      if (o.inLoveUntil < now || now - o.lastBirth < 30000) continue;
      const d = c.g.position.distanceTo(o.g.position);
      if (d > 5) continue;
      // 💕 baby!
      const bx = (c.g.position.x + o.g.position.x) / 2;
      const bz = (c.g.position.z + o.g.position.z) / 2;
      const baby = this.spawnBaby(c.kind, bx, c.g.position.y + 0.5, bz);
      c.inLoveUntil = 0; o.inLoveUntil = 0;
      c.lastBirth = now; o.lastBirth = now;
      return { ok: true, bred: true, baby, parents: [c, o] };
    }
    return { ok: true, inLove: true, critter: c };
  }

  // Spawn a tamed baby of the kind at the position.
  spawnBaby(kind, x, y, z) {
    const c = new Critter(this.scene, kind, x, y, z, this.tex.get(kind) || null);
    c.petOf = 'me';
    c.mode = 'follow';
    c.name = petName(kind) + ' Jr.';
    c.trust = ANIMAL_DEFS[kind].feedsToTame;
    c.setBaby();
    this.critters.push(c);
    return c;
  }

  // Put a collar on a pet (color cycles each application).
  setCollarOn(c, color) {
    const i = COLLAR_COLORS.indexOf(c.collarColor);
    c.setCollar(color || COLLAR_COLORS[(i + 1) % COLLAR_COLORS.length]);
    return c.collarColor;
  }

  // Any untamed critter within range (feed-to-tame).
  nearestTameable(pos, maxD = 3.5) {
    let best = null, bd = maxD;
    for (const c of this.critters) {
      if (c.petOf) continue;
      const d = Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Legacy instant-adopt: untamed rabbits/chickens within 4 blocks.
  nearestAdoptable(pos) {
    let best = null, bd = 4;
    for (const c of this.critters) {
      if (c.petOf || (c.kind !== 'rabbit' && c.kind !== 'chicken')) continue;
      const d = Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Feed a critter its favorite food. Returns a result object for main.js toasts.
  feed(c, inv) {
    const def = ANIMAL_DEFS[c.kind];
    if (!def) return { ok: false, reason: 'unknown' };
    const f = foodDef(def.favoriteFood);
    if (inv.count(def.favoriteFood) < 1) return { ok: false, reason: 'nofood', food: f };
    inv.remove(def.favoriteFood, 1);
    c.trust = (c.trust || 0) + 1;
    if (c.trust >= def.feedsToTame) {
      c.petOf = 'me';
      c.mode = 'follow';
      if (!c.name) c.name = petName(c.kind);
      return { ok: true, tamed: true, critter: c };
    }
    return { ok: true, tamed: false, critter: c, trust: c.trust, need: def.feedsToTame };
  }

  setPetsMode(mode) { for (const c of this.myPets()) c.mode = mode; }

  // Save-restore: re-tame an existing untamed critter of the kind, or spawn
  // one at the world spawn if none is left (e.g. it was tamed then deleted).
  tameByKind(kind, name) {
    if (!ANIMAL_DEFS[kind]) return null;
    let c = this.critters.find(x => x.kind === kind && !x.petOf);
    if (!c) {
      const [sx, sy, sz] = getSpawn();
      c = new Critter(this.scene, kind, sx, sy + 1, sz, this.tex.get(kind) || null);
      this.critters.push(c);
    }
    c.petOf = 'me'; c.mode = 'follow';
    c.name = name || petName(c.kind);
    c.trust = ANIMAL_DEFS[kind].feedsToTame;
    return c;
  }

  update(dt, playerPos) {
    for (const c of this.critters) c.update(dt, this.world, playerPos);
  }
}
