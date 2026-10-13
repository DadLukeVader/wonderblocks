// WonderBlocks voxel world: STREAMING chunked storage, face-culled meshing, DDA raycast.
//
// Endless mode: the world is an unbounded grid of 16x64x16 chunks generated on
// demand from shared/worldgen.js (buildChunkData). Each frame, chunks within
// STREAM_R (6) chunks of the player are generated + meshed nearest-first
// (max BUILDS_PER_FRAME mesh builds per frame); chunks beyond UNLOAD_R (8)
// have their meshes disposed and are dropped from the cache. Player edits
// overlay base terrain and are re-applied if a chunk regenerates after eviction.
import * as THREE from 'three';
import { B, blockDef } from 'wb-shared/blocks.js?v=8';
import { CHUNK, WORLD_Y, ENDLESS_WORLD, buildChunkData } from 'wb-shared/worldgen.js?v=8';
import { getAtlas, tileUV, makeWaterTexture } from './textures.js?v=8';

export { CHUNK, WORLD_Y };

const HIDE_SAME = new Set([B.GLASS, B.LEAVES, B.ICE, B.CLOUD, B.BERRY_BUSH, B.PALM_LEAVES]);
const SHORE = new Set([B.SAND, B.GRASS, B.DIRT, B.STONE, B.SNOW]); // shoreline-foam blocks
const FINITE_MAX = 7; // !ENDLESS_WORLD: only chunks cx,cz in [0,7] ever exist (legacy 128x128 world)

const STREAM_R = 6;          // chunk radius kept generated + meshed around the player
const UNLOAD_R = STREAM_R + 2;
const BUILDS_PER_FRAME = 3;  // max chunk mesh builds per frame (streaming)
const DIRTY_PER_FRAME = 4;   // max dirty-chunk remeshes per frame

const cidx = (lx, y, lz) => (y * CHUNK + lz) * CHUNK + lx; // contract index order

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
    this.atlas = atlas || getAtlas();
    this.chunkCache = new Map(); // "cx,cz" -> Uint8Array(16*64*16)
    this.edits = new Map();      // "x,y,z" -> [x,y,z,b] (overlay on generated terrain)
    this._editChunks = new Map();// "cx,cz" -> Set("x,y,z") (re-apply edits after eviction)
    this.chunks = new Map();     // "cx,cz" -> {opaque,cutout,water} meshes
    this.dirty = new Set();      // "cx,cz" awaiting remesh

    // Standalone animated water texture (independent of the atlas frame swap).
    this.waterAnim = makeWaterTexture();
    this.waterTime = { value: 0 };

    this.opaqueMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.cutoutMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
    this.waterMat = new THREE.MeshLambertMaterial({ map: this.waterAnim.tex, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
    // Realistic water surface: gentle sine bob on upward-facing vertices + traveling shimmer.
    const waterTime = this.waterTime;
    this.waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = waterTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_MAP
  float wbPhase = position.x * 0.9 + position.z * 1.3;
  transformed.y += sin(uTime * 1.7 + wbPhase) * 0.035 * clamp(normal.y, 0.0, 1.0);
#endif`
      );
      shader.fragmentShader = 'uniform float uTime;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
  float wShim = sin(uTime * 2.3 + vMapUv.x * 22.0 + vMapUv.y * 17.0);
  diffuseColor.rgb *= 0.965 + 0.035 * wShim;
#endif`
      );
    };
  }

  // Swap atlas frame for opaque/cutout (animated tiles: glow, crystal, rainbow).
  // Water has its own animated texture and is intentionally left alone.
  setAtlasFrame(tex) {
    for (const m of [this.opaqueMat, this.cutoutMat]) {
      if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
    }
  }

  // Advance the water clock (seconds). Drives the uTime vertex/fragment motion
  // and the 4-frame canvas texture cycle. Call once per frame from the game loop.
  setTime(t) {
    this.waterTime.value = t;
    if (this.waterAnim) this.waterAnim.tick(t);
  }

  // ---- chunk storage ----
  _chunkAllowed(cx, cz) {
    return ENDLESS_WORLD || (cx >= 0 && cz >= 0 && cx <= FINITE_MAX && cz <= FINITE_MAX);
  }

  getChunkData(cx, cz) {
    if (!this._chunkAllowed(cx, cz)) return null;
    const key = cx + ',' + cz;
    let d = this.chunkCache.get(key);
    if (!d) {
      d = buildChunkData(this.seed, cx, cz);
      this._applyEditsToChunk(cx, cz, d);
      this.chunkCache.set(key, d);
    }
    return d;
  }

  _applyEditsToChunk(cx, cz, d) {
    const s = this._editChunks.get(cx + ',' + cz);
    if (!s) return;
    for (const ek of s) {
      const e = this.edits.get(ek);
      if (e) d[cidx(e[0] - cx * CHUNK, e[1], e[2] - cz * CHUNK)] = e[3];
    }
  }

  get(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_Y) return B.AIR;
    const e = this.edits.get(x + ',' + y + ',' + z);
    if (e !== undefined) return e[3];
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const d = this.getChunkData(cx, cz);
    if (!d) return B.AIR;
    return d[cidx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  set(x, y, z, b) {
    if (y < 0 || y >= WORLD_Y) return false;
    if (this.get(x, y, z) === b) return false;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const d = this.getChunkData(cx, cz);
    if (!d) return false;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    d[cidx(lx, y, lz)] = b;
    const ek = x + ',' + y + ',' + z;
    this.edits.set(ek, [x, y, z, b]);
    const ck = cx + ',' + cz;
    let s = this._editChunks.get(ck);
    if (!s) { s = new Set(); this._editChunks.set(ck, s); }
    s.add(ek);
    this._markDirty(cx, cz);
    if (lx === 0) this._markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this._markDirty(cx + 1, cz);
    if (lz === 0) this._markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this._markDirty(cx, cz + 1);
    return true;
  }

  _markDirty(cx, cz) {
    // Only meshed chunks need a remesh; unmeshed ones read fresh data when streamed in.
    const key = cx + ',' + cz;
    if (this.chunks.has(key)) this.dirty.add(key);
  }

  // All recorded edits, for saving (localStorage) — single source of truth.
  editsList() { return [...this.edits.values()]; }

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
    if (!this._chunkAllowed(cx, cz)) return;
    const key = cx + ',' + cz;
    const data = this.getChunkData(cx, cz);
    if (!data) return;
    let ch = this.chunks.get(key);
    const op = makeArrays(), cu = makeArrays(), wa = makeArrays();
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const waterUV = [[0, 0], [0, 1], [1, 1], [1, 0]]; // standalone water texture

    for (let x = x0; x < x0 + CHUNK; x++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        const lx = x - x0, lz = z - z0;
        for (let y = 0; y < WORLD_Y; y++) {
          const id = data[cidx(lx, y, lz)];
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
            let corners = f.c.map(c => [x + c[0], y + c[1], z + c[2]]);
            let tint = [1, 1, 1], uvs;
            if (id === B.WATER) {
              uvs = waterUV;
              tint = [0.75, 0.9, 1.0];
              if (f.n[1] === 1) {
                if (this.get(x, y + 1, z) === B.AIR)
                  corners = corners.map(c => [c[0], c[1] - 0.12, c[2]]); // lowered water surface
                // shoreline foam: lighten quads touching a shore block
                if (SHORE.has(this.get(x + 1, y, z)) || SHORE.has(this.get(x - 1, y, z)) ||
                    SHORE.has(this.get(x, y, z + 1)) || SHORE.has(this.get(x, y, z - 1)))
                  tint = [1.0, 1.0, 1.0];
              }
            } else {
              const [u0, v0, u1, v1] = tileUV(def.tiles[f.k]);
              uvs = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
            }
            pushQuad(arr, corners, f.n, uvs, f.s, tint);
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

  unloadChunk(cx, cz) {
    const key = cx + ',' + cz;
    const ch = this.chunks.get(key);
    if (!ch) return;
    for (const k of ['opaque', 'cutout', 'water']) {
      if (ch[k]) { this.scene.remove(ch[k]); ch[k].geometry.dispose(); ch[k] = null; }
    }
    this.chunks.delete(key);
    this.chunkCache.delete(key);
    this.dirty.delete(key);
    // NOTE: _editChunks entries are kept — edits are re-applied if the chunk regenerates.
  }

  // Progressive boot: mesh every chunk within STREAM_R of (px,pz), nearest-first.
  async bootAround(px, pz, onProgress) {
    const list = this._chunksInRadius(px, pz, STREAM_R);
    let n = 0;
    const total = list.length;
    for (const [, cx, cz] of list) {
      this.buildChunk(cx, cz);
      if (++n % 4 === 0) {
        onProgress && onProgress(n / total);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    onProgress && onProgress(1);
  }

  _chunksInRadius(px, pz, r) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const list = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cx = pcx + dx, cz = pcz + dz;
        if (!this._chunkAllowed(cx, cz)) continue;
        list.push([dx * dx + dz * dz, cx, cz]);
      }
    }
    list.sort((a, b) => a[0] - b[0]);
    return list;
  }

  _stream(px, pz) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    // generate + mesh missing chunks within STREAM_R, nearest-first, budgeted
    let n = 0;
    for (const [, cx, cz] of this._chunksInRadius(px, pz, STREAM_R)) {
      if (this.chunks.has(cx + ',' + cz)) continue;
      if (n++ >= BUILDS_PER_FRAME) break;
      this.buildChunk(cx, cz);
    }
    // unload chunks beyond UNLOAD_R (meshes disposed, data dropped from cache)
    for (const key of this.chunks.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > UNLOAD_R) this.unloadChunk(cx, cz);
    }
    // also sweep cached terrain that was pulled in as a meshing neighbor but never meshed
    for (const key of this.chunkCache.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > UNLOAD_R) this.chunkCache.delete(key);
    }
  }

  // Per-frame driver. Call as world.update(playerX, playerZ) from the game loop,
  // plus world.setTime(t) once per frame for the water animation clock.
  update(px, pz) {
    if (px !== undefined && pz !== undefined) this._stream(px, pz);
    if (!this.dirty.size) return;
    let n = 0;
    for (const key of this.dirty) {
      if (n++ >= DIRTY_PER_FRAME) break;
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
