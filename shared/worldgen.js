// WonderBlocks procedural world generation (deterministic, shared client + server).
import { B } from './blocks.js';

export const WORLD_X = 128, WORLD_Y = 64, WORLD_Z = 128;
export const SEA_LEVEL = 20;

export const idx = (x, y, z) => (y * WORLD_Z + z) * WORLD_X + x;
export const inBounds = (x, y, z) =>
  x >= 0 && x < WORLD_X && y >= 0 && y < WORLD_Y && z >= 0 && z < WORLD_Z;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0;[p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = (ix, iy) => perm[(perm[ix & 255] + iy) & 255] / 255;
  const sm = t => t * t * (3 - 2 * t);
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = val(ix, iy), b = val(ix + 1, iy), c = val(ix, iy + 1), d = val(ix + 1, iy + 1);
    const ux = sm(fx), uy = sm(fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y, oct = 4) {
    let v = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return v / n;
  }
  return { noise2, fbm, rand };
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function buildWorld(seed) {
  const data = new Uint8Array(WORLD_X * WORLD_Y * WORLD_Z);
  const { fbm, rand } = makeNoise(seed);
  const set = (x, y, z, b) => { if (inBounds(x, y, z)) data[idx(x, y, z)] = b; };
  const get = (x, y, z) => (inBounds(x, y, z) ? data[idx(x, y, z)] : B.BEDROCK);

  const VX = 64, VZ = 64; // Wonder Village center
  const heights = new Int16Array(WORLD_X * WORLD_Z);

  // ---- terrain ----
  for (let x = 0; x < WORLD_X; x++) {
    for (let z = 0; z < WORLD_Z; z++) {
      let h = 20 + fbm(x * 0.015 + 7, z * 0.015 + 3) * 12 - 3;
      // Frosty Peaks (north)
      const m = clamp01((38 - z) / 38);
      h += m * m * 30 * (0.55 + 0.45 * fbm(x * 0.05, z * 0.05 + 40));
      // Ocean (southwest)
      const ox = clamp01((52 - x) / 52), oz = clamp01((z - 78) / 50);
      const od = Math.min(ox, oz);
      h -= od * od * 22;
      // Village plateau
      const vd = Math.hypot(x - VX, z - VZ);
      h = lerp(h, 22, smooth(1 - vd / 24));
      h = Math.max(2, Math.min(50, Math.round(h)));
      heights[z * WORLD_X + x] = h;

      const beachy = h <= SEA_LEVEL + 1;
      const snowy = h >= 30;
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === 0) b = B.BEDROCK;
        else if (y < h - 3) b = B.STONE;
        else if (y < h) b = beachy ? B.SAND : B.DIRT;
        else b = beachy ? B.SAND : snowy ? B.SNOW : B.GRASS;
        set(x, y, z, b);
      }
      for (let y = h + 1; y <= SEA_LEVEL; y++) set(x, y, z, B.WATER);
    }
  }

  const H = (x, z) => heights[z * WORLD_X + x];

  // ---- caves + crystals (skip village + ocean floor) ----
  for (let x = 2; x < WORLD_X - 2; x++) {
    for (let z = 2; z < WORLD_Z - 2; z++) {
      const h = H(x, z);
      if (h < 17) continue;
      if (Math.hypot(x - VX, z - VZ) < 26) continue;
      for (let y = 4; y < Math.min(h - 2, 20); y++) {
        if (fbm(x * 0.09, z * 0.09 + y * 0.16) > 0.74 && get(x, y, z) === B.STONE) {
          set(x, y, z, B.AIR);
          if (rand() < 0.05 && get(x, y - 1, z) !== B.AIR) set(x, y, z, B.CRYSTAL);
        }
      }
    }
  }

  // ---- ice cave in the peaks ----
  const icx = 64, icy = 30, icz = 14;
  for (let x = icx - 7; x <= icx + 7; x++)
    for (let y = icy - 5; y <= icy + 5; y++)
      for (let z = icz - 7; z <= icz + 7; z++) {
        const d = Math.hypot(x - icx, (y - icy) * 1.4, z - icz);
        if (d < 6 && get(x, y, z) !== B.BEDROCK) {
          set(x, y, z, B.AIR);
          if (d > 4.6 && d < 6 && rand() < 0.4) set(x, y, z, B.ICE);
        }
      }
  for (let i = 0; i < 14; i++) {
    const x = icx + ((rand() * 11) | 0) - 5, z = icz + ((rand() * 11) | 0) - 5;
    for (let y = icy - 4; y < icy + 4; y++)
      if (get(x, y, z) === B.AIR && get(x, y - 1, z) !== B.AIR) { set(x, y, z, B.CRYSTAL); break; }
  }
  set(icx, icy - 4, icz, B.GOLD); set(icx + 1, icy - 4, icz, B.GOLD); // treasure

  // ---- trees ----
  const tree = (x, z, leaf, trunkB = B.WOOD) => {
    const h = H(x, z);
    if (h < 21 || h > 31) return;
    if (Math.hypot(x - VX, z - VZ) < 25) return;
    const th = 4 + ((rand() * 3) | 0);
    for (let y = h + 1; y <= h + th; y++) set(x, y, z, trunkB);
    for (let dy = th - 2; dy <= th + 1; dy++) {
      const r = dy >= th ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        if (get(x + dx, h + dy, z + dz) === B.AIR) set(x + dx, h + dy, z + dz, leaf);
      }
    }
    set(x, h + th + 2, z, leaf);
  };
  for (let x = 3; x < WORLD_X - 3; x++) {
    for (let z = 3; z < WORLD_Z - 3; z++) {
      const h = H(x, z);
      if (h < 21 || h > 31 || get(x, h + 1, z) !== B.AIR) continue;
      const inBlossom = x > 82 && x < 124 && z > 40 && z < 88;
      const r = rand();
      if (inBlossom && r < 0.055) tree(x, z, rand() < 0.5 ? B.BERRY_BUSH : B.LEAVES);
      else if (!inBlossom && r < 0.012) tree(x, z, B.LEAVES);
      else if (h >= 21 && h <= 22 && get(x, h, z) === B.SAND && r < 0.05) {
        // palm
        if (Math.hypot(x - VX, z - VZ) < 25) continue;
        const th = 5;
        for (let y = h + 1; y <= h + th; y++) set(x, y, z, B.PALM_WOOD);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= 3 && get(x + dx, h + th + 1, z + dz) === B.AIR)
            set(x + dx, h + th + 1, z + dz, B.PALM_LEAVES);
        }
        set(x, h + th + 2, z, B.PALM_LEAVES);
      }
    }
  }

  // ---- flowers & tall grass ----
  for (let x = 2; x < WORLD_X - 2; x++) {
    for (let z = 2; z < WORLD_Z - 2; z++) {
      const h = H(x, z);
      if (h < 21 || h > 29) continue;
      if (get(x, h, z) !== B.GRASS || get(x, h + 1, z) !== B.AIR) continue;
      const r = rand();
      if (r < 0.03) set(x, h + 1, z, B.FLOWER_RED);
      else if (r < 0.06) set(x, h + 1, z, B.FLOWER_YELLOW);
      else if (r < 0.09) set(x, h + 1, z, B.FLOWER_BLUE);
      else if (r < 0.18) set(x, h + 1, z, B.TALL_GRASS);
    }
  }

  // ---- Wonder Village ----
  const house = (hx, hz) => {
    const gy = 22;
    const w = 7, d = 6, hh = 4;
    for (let x = hx; x < hx + w; x++) for (let z = hz; z < hz + d; z++) {
      set(x, gy, z, B.PLANKS); // floor
      for (let y = gy + 1; y <= gy + hh; y++) {
        const edge = x === hx || x === hx + w - 1 || z === hz || z === hz + d - 1;
        if (!edge) { set(x, y, z, B.AIR); continue; }
        const isDoor = z === hz && x === hx + 3 && (y === gy + 1 || y === gy + 2);
        const isWin = y === gy + 2 && !isDoor &&
          ((x === hx || x === hx + w - 1) && (z === hz + 2 || z === hz + 3) ||
           (z === hz + d - 1) && (x === hx + 1 || x === hx + 5));
        if (isDoor) set(x, y, z, y === gy + 1 ? B.DOOR : B.AIR);
        else if (isWin) set(x, y, z, B.WINDOW);
        else set(x, y, z, (x === hx || x === hx + w - 1) && (z === hz || z === hz + d - 1) ? B.WOOD : B.PLANKS);
      }
      // pyramid roof
      for (let ry = 1; ry <= 3; ry++)
        for (let x = hx - 1 + ry; x < hx + w + 1 - ry; x++)
          for (let z = hz - 1 + ry; z < hz + d + 1 - ry; z++)
            if (get(x, gy + hh + ry, z) === B.AIR) set(x, gy + hh + ry, z, B.ROOF);
    }
    set(hx + 3, gy + hh + 4, hz + 2, B.ROOF);
    set(hx - 2, gy + 1, hz + d, B.FENCE); set(hx - 2, gy + 2, hz + d, B.LANTERN);
  };
  house(50, 50); house(68, 50); house(50, 70); house(68, 70);
  // paths
  for (let i = -20; i <= 20; i++) {
    if (H(VX + i, VZ) === 22 && get(VX + i, 23, VZ) === B.AIR) set(VX + i, 22, VZ, B.CLAY);
    if (H(VX, VZ + i) === 22 && get(VX, 23, VZ + i) === B.AIR) set(VX, 22, VZ + i, B.CLAY);
  }
  // well
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
    set(VX + dx, 22, VZ + dz, edge ? B.STONE_BRICK : B.WATER);
    if (edge) set(VX + dx, 23, VZ + dz, B.STONE_BRICK);
  }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    set(VX + dx, 24, VZ + dz, B.WOOD); set(VX + dx, 25, VZ + dz, B.WOOD);
  }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
    set(VX + dx, 26, VZ + dz, B.ROOF);
  // garden flower patches
  for (let i = 0; i < 40; i++) {
    const x = VX + ((rand() * 36) | 0) - 18, z = VZ + ((rand() * 36) | 0) - 18;
    if (get(x, 22, z) === B.GRASS && get(x, 23, z) === B.AIR)
      set(x, 23, z, [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE][(rand() * 3) | 0]);
  }

  // ---- Rainbow Sky Island ----
  const ix = 92, iy = 46, izz = 28;
  for (let x = ix - 14; x <= ix + 14; x++)
    for (let z = izz - 10; z <= izz + 10; z++)
      for (let y = iy - 4; y <= iy + 2; y++) {
        const d = Math.hypot((x - ix) / 13, (y - iy) / 3.4, (z - izz) / 9);
        if (d < 1) {
          let b = B.STONE;
          if (y === iy + 2) b = B.GRASS;
          else if (y >= iy) b = B.DIRT;
          if (d > 0.86) b = B.CLOUD;
          set(x, y, z, b);
        }
      }
  for (let i = 0; i < 24; i++) { // island flowers + treasure
    const x = ix + ((rand() * 22) | 0) - 11, z = izz + ((rand() * 15) | 0) - 7;
    if (get(x, iy + 2, z) === B.GRASS && get(x, iy + 3, z) === B.AIR)
      set(x, iy + 3, z, [B.FLOWER_RED, B.FLOWER_BLUE, B.RAINBOW][(rand() * 3) | 0]);
  }
  set(ix, iy + 3, izz, B.GOLD); set(ix + 1, iy + 3, izz, B.CRYSTAL);
  // rainbow bridge arc down to the meadow
  for (let t = 0; t <= 1.001; t += 0.02) {
    const bx = lerp(ix - 13, 66, t), bz = lerp(izz, 46, t);
    const by = lerp(iy + 1, 24, t) + Math.sin(t * Math.PI) * 3;
    for (let w = -1; w <= 1; w++) {
      set(Math.round(bx + w), Math.round(by), Math.round(bz), B.RAINBOW);
      set(Math.round(bx + w), Math.round(by), Math.round(bz + 1), B.RAINBOW);
    }
  }

  // waterfall from sky island into a pond
  for (let y = iy - 1; y >= 24; y--) set(ix + 10, y, izz + 4, B.WATER);

  return data;
}

export function getSpawn() {
  return [64.5, 24.5, 58.5]; // south of the well, on the path
}

export function biomeNameAt(x, z) {
  if (Math.hypot(x - 64, z - 64) < 26) return 'Wonder Village';
  if (x > 82 && z > 40 && z < 88) return 'Blossom Forest';
  if (z < 38) return 'Frosty Peaks';
  if (x < 52 && z > 78) return 'Sunbeam Beach';
  const d = Math.hypot((x - 92) / 13, (z - 28) / 9);
  if (d < 1.2) return 'Rainbow Sky Island';
  return 'Meadow';
}
