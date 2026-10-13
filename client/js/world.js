// WonderBlocks voxel world: chunked storage, greedy-free face-culled meshing, DDA raycast.
import * as THREE from 'three';
import { B, blockDef } from 'wb-shared/blocks.js';
import { WORLD_X, WORLD_Y, WORLD_Z, idx, inBounds, buildWorld } from 'wb-shared/worldgen.js';
import { getAtlas, tileUV } from './textures.js';

export { WORLD_X, WORLD_Y, WORLD_Z };

const CHUNK = 16, CX = WORLD_X / CHUNK, CZ = WORLD_Z / CHUNK;
const HIDE_SAME = new Set([B.GLASS, B.LEAVES, B.ICE, B.CLOUD, B.BERRY_BUSH, B.PALM_LEAVES]);

// corner offsets for each face: [normal, 4 corners, shade, tileKind]
// uv per corner: [u0,v0],[u0,v1],[u1,v1],[u1,v0]
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.80, k: 'side' },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.80, k: 'side' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.00, k: 'top' },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.55, k: 'bottom' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.70, k: 'side' },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.70, k: 'side' },
];

function makeArrays() {
  return { pos: [], nrm: [], uv: [], col: [], idx: [] };
}
function pushQuad(a, corners, normal, uvs, shade, tint) {
  const base = a.pos.length / 3;
  for (let i = 0; i < 4; i++) {
    a.pos.push(corners[i][0], corners[i][1], corners[i][2]);
    a.nrm.push(normal[0], normal[1], normal[2]);
    a.uv.push(uvs[i][0], uvs[i][1]);
    a.col.push(shade * tint[0], shade * tint[1], shade * tint[2]);
  }
  a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export class World {
  constructor(scene, seed, atlas) {
    this.scene = scene;
    this.seed = seed;
    this.data = buildWorld(seed);
    this.atlas = atlas || getAtlas();
    this.chunks = new Map();
    this.dirty = new Set();

    this.opaqueMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.cutoutMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
    this.waterMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
  }

  // Swap atlas frame (for animated tiles: water, glow, crystal, rainbow).
  setAtlasFrame(tex) {
    for (const m of [this.opaqueMat, this.cutoutMat, this.waterMat]) {
      if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
    }
  }

  get(x, y, z) {
    if (!inBounds(x, y, z)) return y < 0 ? B.BEDROCK : B.AIR;
    return this.data[idx(x, y, z)];
  }

  set(x, y, z, b) {
    if (!inBounds(x, y, z)) return false;
    const i = idx(x, y, z);
    if (this.data[i] === b) return false;
    this.data[i] = b;
    const cx = (x / CHUNK) | 0, cz = (z / CHUNK) | 0;
    this.dirty.add(cx + ',' + cz);
    if (x % CHUNK === 0 && cx > 0) this.dirty.add((cx - 1) + ',' + cz);
    if (x % CHUNK === 15 && cx < CX - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (z % CHUNK === 0 && cz > 0) this.dirty.add(cx + ',' + (cz - 1));
    if (z % CHUNK === 15 && cz < CZ - 1) this.dirty.add(cx + ',' + (cz + 1));
    return true;
  }

  topY(x, z) {
    for (let y = WORLD_Y - 1; y >= 0; y--) {
      const b = this.get(x, y, z);
      if (b !== B.AIR && b !== B.WATER) return y;
    }
    return 0;
  }

  isWaterAt(x, y, z) { return this.get(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER; }

  shouldDraw(id, nid) {
    if (nid === B.AIR) return true;
    if (id === B.WATER) return nid === B.AIR;
    if (nid === B.WATER) return true;
    if (blockDef(nid).opaque) return false;
    if (nid === id && HIDE_SAME.has(id)) return false;
    return true;
  }

  buildChunk(cx, cz) {
    const key = cx + ',' + cz;
    let ch = this.chunks.get(key);
    const op = makeArrays(), cu = makeArrays(), wa = makeArrays();
    const x0 = cx * CHUNK, z0 = cz * CHUNK;

    for (let x = x0; x < x0 + CHUNK; x++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let y = 0; y < WORLD_Y; y++) {
          const id = this.data[idx(x, y, z)];
          if (id === B.AIR) continue;
          const def = blockDef(id);
          const arr = id === B.WATER ? wa : def.opaque ? op : cu;

          if (def.cross) {
            const [u0, v0, u1, v1] = tileUV(def.tiles.side);
            const q = [
              [[x + 0.15, y, z + 0.15], [x + 0.15, y + 1, z + 0.15], [x + 0.85, y + 1, z + 0.85], [x + 0.85, y, z + 0.85]],
              [[x + 0.85, y, z + 0.15], [x + 0.85, y + 1, z + 0.15], [x + 0.15, y + 1, z + 0.85], [x + 0.15, y, z + 0.85]],
            ];
            for (const corners of q)
              pushQuad(arr, corners, [0, 1, 0], [[u0, v0], [u0, v1], [u1, v1], [u1, v0]], 0.95, [1, 1, 1]);
            continue;
          }

          for (const f of FACES) {
            const nid = this.get(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (!this.shouldDraw(id, nid)) continue;
            const [u0, v0, u1, v1] = tileUV(def.tiles[f.k]);
            let corners = f.c.map(c => [x + c[0], y + c[1], z + c[2]]);
            if (id === B.WATER && f.n[1] === 1 && this.get(x, y + 1, z) === B.AIR)
              corners = corners.map(c => [c[0], c[1] - 0.12, c[2]]); // lowered water surface
            const tint = id === B.WATER ? [0.75, 0.9, 1.0] : [1, 1, 1];
            pushQuad(arr, corners, f.n, [[u0, v0], [u0, v1], [u1, v1], [u1, v0]], f.s, tint);
          }
        }
      }
    }

    const mkMesh = (a, mat) => {
      if (!a.idx.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3));
      geo.setIndex(a.idx);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      return mesh;
    };

    if (!ch) { ch = {}; this.chunks.set(key, ch); }
    for (const k of ['opaque', 'cutout', 'water']) {
      if (ch[k]) { this.scene.remove(ch[k]); ch[k].geometry.dispose(); ch[k] = null; }
    }
    ch.opaque = mkMesh(op, this.opaqueMat);
    ch.cutout = mkMesh(cu, this.cutoutMat);
    ch.water = mkMesh(wa, this.waterMat);
    for (const k of ['opaque', 'cutout', 'water']) if (ch[k]) this.scene.add(ch[k]);
    this.dirty.delete(key);
  }

  async buildAll(onProgress) {
    let n = 0;
    const total = CX * CZ;
    for (let cx = 0; cx < CX; cx++) {
      for (let cz = 0; cz < CZ; cz++) {
        this.buildChunk(cx, cz);
        if (++n % 8 === 0) {
          onProgress && onProgress(n / total);
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
    onProgress && onProgress(1);
  }

  update() {
    if (!this.dirty.size) return;
    let n = 0;
    for (const key of this.dirty) {
      if (n++ >= 4) break;
      const [cx, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cz);
    }
  }

  // Voxel DDA raycast. Returns {x,y,z,nx,ny,nz} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = sx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tdy = sy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tdz = sz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tmx = sx !== 0 ? (sx > 0 ? (x + 1 - ox) : (ox - x)) * tdx : Infinity;
    let tmy = sy !== 0 ? (sy > 0 ? (y + 1 - oy) : (oy - y)) * tdy : Infinity;
    let tmz = sz !== 0 ? (sz > 0 ? (z + 1 - oz) : (oz - z)) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256; i++) {
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (t > maxDist) return null;
      const id = this.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { x, y, z, nx, ny, nz, id };
    }
    return null;
  }
}
