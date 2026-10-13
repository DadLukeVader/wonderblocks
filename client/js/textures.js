// WonderBlocks texture atlas: cute pastel pixel tiles, generated on a canvas.
// 8x8 grid of 32px tiles. Indices must match shared/blocks.js.
import * as THREE from 'three';

const T = 32, COLS = 8;

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawAtlas() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = T * COLS;
  const g = cv.getContext('2d');
  const R = mulberry(1234);
  const tile = i => { g.save(); g.translate((i % COLS) * T, ((i / COLS) | 0) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); };
  const done = () => g.restore();
  const fill = c => { g.fillStyle = c; g.fillRect(0, 0, T, T); };
  const speck = (n, colors, s = 2) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(R() * colors.length) | 0];
      g.fillRect((R() * T) | 0, (R() * T) | 0, s, s);
    }
  };
  const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

  // 0 grass_top
  tile(0); fill('#79c95c'); speck(46, ['#8bd96e', '#6ab84e', '#a4e58a'], 2);
  dot(8, 9, 1.6, '#fff'); dot(24, 22, 1.6, '#ffe27a'); dot(17, 26, 1.4, '#ffb3d9'); done();
  // 1 grass_side
  tile(1); fill('#9a6a44'); speck(40, ['#8a5c38', '#ab7a4e'], 2);
  fill('#79c95c'); g.fillRect(0, 0, T, 9);
  for (let x = 0; x < T; x += 4) g.fillRect(x, 9, 2, 3 + ((x * 7) % 4));
  speck(10, ['#8bd96e'], 2); done();
  // 2 dirt
  tile(2); fill('#9a6a44'); speck(52, ['#8a5c38', '#ab7a4e', '#7c5233'], 2); done();
  // 3 stone
  tile(3); fill('#b9b9c4'); speck(48, ['#a8a8b3', '#c9c9d4', '#9a9aa5'], 2);
  g.strokeStyle = '#9a9aa5'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(4, 20); g.lineTo(14, 24); g.lineTo(22, 19); g.stroke(); done();
  // 4 sand
  tile(4); fill('#f0dfa4'); speck(52, ['#e6d191', '#f7ecc0', '#dcc684'], 2); done();
  // 5 wood_side
  tile(5); fill('#8a5a32'); for (let x = 3; x < T; x += 7) { g.fillStyle = '#744a28'; g.fillRect(x, 0, 2, T); }
  speck(16, ['#9c6a3c'], 2); done();
  // 6 wood_top
  tile(6); fill('#a4713f'); speck(20, ['#8a5a32'], 2);
  g.strokeStyle = '#7c5233'; g.lineWidth = 2;
  for (const r of [4, 8, 12]) { g.beginPath(); g.arc(16, 16, r, 0, 7); g.stroke(); } done();
  // 7 leaves
  tile(7); fill('#58b368'); speck(60, ['#479e55', '#6fca7d', '#3f8f4c'], 3);
  dot(9, 10, 2, '#8fdc9a'); dot(23, 24, 2, '#8fdc9a'); done();
  // 8 snow_top
  tile(8); fill('#f2f7ff'); speck(36, ['#ffffff', '#dbe7f7'], 2); dot(20, 12, 1.6, '#cfe4ff'); done();
  // 9 snow_side
  tile(9); fill('#9a6a44'); speck(30, ['#8a5c38', '#ab7a4e'], 2);
  fill('#f2f7ff'); g.fillRect(0, 0, T, 10);
  for (let x = 0; x < T; x += 5) g.fillRect(x, 10, 2, 2 + ((x * 3) % 4)); done();
  // 10 clay
  tile(10); fill('#d99a86'); speck(44, ['#c98874', '#e8ab96'], 2); done();
  // 11 water
  tile(11); fill('#3fa7e8'); speck(26, ['#5dbdf5', '#2f8fd4'], 3);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 2; x < T; x += 9) g.fillRect(x, 6 + ((x * 5) % 18), 5, 2); done();
  // 12 planks
  tile(12); fill('#d9a05e'); speck(24, ['#c78f4f'], 2);
  g.fillStyle = '#b57e42'; for (let y = 7; y < T; y += 8) g.fillRect(0, y, T, 2);
  g.fillStyle = '#8a5f30'; for (const [x, y] of [[4, 4], [27, 12], [4, 20], [27, 28]]) g.fillRect(x, y, 2, 2); done();
  // 13 brick_red
  tile(13); fill('#e07864'); g.fillStyle = '#f7e8e0';
  for (let y = 0; y <= T; y += 8) g.fillRect(0, y, T, 2);
  for (let y = 0; y < T; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < T; x += 16) g.fillRect(x, y, 2, 8);
  speck(14, ['#d16552'], 2); done();
  // 14 brick_sky
  tile(14); fill('#7ec8e8'); g.fillStyle = '#f2fbff';
  for (let y = 0; y <= T; y += 8) g.fillRect(0, y, T, 2);
  for (let y = 0; y < T; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < T; x += 16) g.fillRect(x, y, 2, 8); done();
  // 15 glass
  tile(15); g.clearRect(0, 0, T, T); g.fillStyle = 'rgba(190,230,250,0.35)'; g.fillRect(0, 0, T, T);
  g.strokeStyle = '#dff3ff'; g.lineWidth = 3; g.strokeRect(1, 1, T - 2, T - 2);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(8, 24); g.lineTo(20, 8); g.stroke(); done();
  // 16 roof
  tile(16); fill('#d96a4e'); speck(20, ['#c75a40'], 2);
  g.fillStyle = '#b54e38'; for (let y = 6; y < T; y += 10) { g.fillRect(0, y, T, 3); }
  g.fillStyle = '#f0937a'; for (let y = 0; y < T; y += 10) { g.fillRect(0, y, T, 2); } done();
  // 17 glow
  tile(17); fill('#ffd76e'); speck(30, ['#ffef9e', '#ffc93e'], 3);
  dot(16, 16, 7, 'rgba(255,255,255,0.55)'); dot(16, 16, 3, '#fffbe8'); done();
  // flowers (cross quads, transparent bg)
  const flower = (i, petal, center) => {
    tile(i); g.clearRect(0, 0, T, T);
    g.fillStyle = '#3f9e4d'; g.fillRect(14, 14, 4, 18);
    g.fillRect(6, 22, 8, 3); g.fillRect(18, 26, 8, 3);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; dot(16 + Math.cos(a) * 7, 10 + Math.sin(a) * 7, 4.6, petal); }
    dot(16, 10, 4, center); done();
  };
  flower(18, '#ff7d9c', '#ffe27a'); flower(19, '#ffd94d', '#ff9d4d'); flower(20, '#7db8ff', '#fff');
  // 21 lantern
  tile(21); fill('#ff9d5c'); speck(16, ['#ff8a42'], 2);
  g.fillStyle = '#e87f3e'; for (let y = 4; y < T; y += 7) g.fillRect(0, y, T, 2);
  g.fillStyle = '#8a5a32'; g.fillRect(10, 0, 12, 4); g.fillRect(10, T - 4, 12, 4);
  dot(16, 16, 6, 'rgba(255,240,200,0.7)'); done();
  // 22 crystal
  tile(22); fill('#3b2d5c'); speck(20, ['#2e2349'], 2);
  const crys = (x, h, c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T - h); g.lineTo(x + 5, T - h - 6); g.lineTo(x + 10, T - h); g.lineTo(x + 10, T); g.fill(); g.fillStyle = c2; g.fillRect(x + 4, T - h, 2, h); };
  crys(3, 20, '#9d7bff', '#d3bdff'); crys(15, 26, '#7be8ff', '#c8f6ff'); crys(24, 15, '#c58aff', '#ecd4ff');
  dot(19, 8, 1.6, '#fff'); done();
  // 23 rainbow
  tile(23); const rb = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
  rb.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 6, T, 6); }); speck(10, ['#ffffff'], 1); done();
  // 24 gold
  tile(24); fill('#f5c542'); speck(30, ['#e0a92e', '#ffe08a'], 2);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(5, 5, 8, 3); g.fillRect(5, 5, 3, 8); done();
  // 25 ice
  tile(25); fill('#bfe6f7'); speck(24, ['#a5d8f0', '#d8f1fd'], 2);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(2, 26); g.lineTo(14, 12); g.lineTo(26, 20); g.stroke(); done();
  // 26 cloud
  tile(26); fill('#eef4fb'); dot(10, 20, 8, '#ffffff'); dot(20, 16, 10, '#ffffff'); dot(26, 22, 7, '#ffffff');
  speck(14, ['#dbe7f5'], 2); done();
  // 27 palm_wood_side
  tile(27); fill('#9c7040'); for (let y = 2; y < T; y += 7) { g.fillStyle = '#7c5630'; g.fillRect(0, y, T, 3); }
  speck(12, ['#ad8049'], 2); done();
  // 28 palm_leaves
  tile(28); fill('#3fa34d'); speck(40, ['#358a42', '#55b765'], 3);
  g.strokeStyle = '#2e7a39'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(16, 2); g.quadraticCurveTo(4 + i * 6, 14, 2 + i * 7, 30); g.stroke(); } done();
  // 29 berry_leaves
  tile(29); fill('#f0a8c0'); speck(44, ['#e28fae', '#f7c3d6'], 3);
  dot(8, 12, 3, '#ff5d7e'); dot(22, 20, 3, '#ff5d7e'); dot(14, 26, 3, '#ff8ba3'); dot(24, 8, 2.4, '#fff'); done();
  // 30 brick_lemon
  tile(30); fill('#f2d06b'); g.fillStyle = '#fff7e0';
  for (let y = 0; y <= T; y += 8) g.fillRect(0, y, T, 2);
  for (let y = 0; y < T; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < T; x += 16) g.fillRect(x, y, 2, 8); done();
  // 31 brick_rose
  tile(31); fill('#f0a0b8'); g.fillStyle = '#ffeef4';
  for (let y = 0; y <= T; y += 8) g.fillRect(0, y, T, 2);
  for (let y = 0; y < T; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < T; x += 16) g.fillRect(x, y, 2, 8); done();
  // 32 door
  tile(32); fill('#a4713f'); speck(18, ['#8a5a32'], 2);
  g.fillStyle = '#7c5233'; g.fillRect(0, 0, 3, T); g.fillRect(T - 3, 0, 3, T); g.fillRect(0, 0, T, 3);
  g.fillStyle = '#bfe6f7'; g.fillRect(19, 6, 8, 8); g.strokeStyle = '#7c5233'; g.strokeRect(19, 6, 8, 8);
  dot(6, 18, 2.4, '#f5c542'); done();
  // 33 window
  tile(33); fill('#bfe6f7'); g.fillStyle = '#8a5a32';
  g.fillRect(0, 0, T, 4); g.fillRect(0, T - 4, T, 4); g.fillRect(0, 0, 4, T); g.fillRect(T - 4, 0, 4, T);
  g.fillRect(14, 0, 4, T); g.fillRect(0, 14, T, 4);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(8, 24); g.lineTo(20, 8); g.stroke(); done();
  // 34 stone_brick
  tile(34); fill('#a9a9b5'); g.fillStyle = '#d5d5de';
  for (let y = 0; y <= T; y += 10) g.fillRect(0, y, T, 2);
  for (let y = 0; y < T; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < T; x += 20) g.fillRect(x, y, 2, 10);
  speck(12, ['#9898a4'], 2); done();
  // 35 bedrock
  tile(35); fill('#3d3d46'); speck(50, ['#2c2c33', '#4e4e59'], 3); done();
  // 36 bookshelf
  tile(36); fill('#a4713f'); g.fillStyle = '#7c5233'; g.fillRect(0, 14, T, 3); g.fillRect(0, 27, T, 3);
  const bc = ['#ff6b6b', '#74c0fc', '#8ce99a', '#ffe066', '#b197fc'];
  for (let s = 0; s < 2; s++) for (let x = 2; x < T - 3; x += 5) { g.fillStyle = bc[(x + s) % bc.length]; g.fillRect(x, 3 + s * 13, 3, 11); } done();
  // 37 fence
  tile(37); g.clearRect(0, 0, T, T); fill('#c78f4f');
  g.fillRect(4, 2, 6, T - 2); g.fillRect(22, 2, 6, T - 2);
  g.fillRect(0, 8, T, 5); g.fillRect(0, 20, T, 5);
  g.fillStyle = '#a4713f'; g.fillRect(4, 2, 6, 3); g.fillRect(22, 2, 6, 3); done();
  // 38 claim_flag
  tile(38); g.clearRect(0, 0, T, T);
  g.fillStyle = '#8a5a32'; g.fillRect(14, 6, 4, 26);
  g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(18, 6); g.lineTo(30, 11); g.lineTo(18, 16); g.fill();
  dot(24, 11, 2, '#fff'); done();
  // 39 tall_grass
  tile(39); g.clearRect(0, 0, T, T);
  g.strokeStyle = '#58b368'; g.lineWidth = 3; g.lineCap = 'round';
  for (const [x0, bend] of [[6, -4], [12, 3], [18, -3], [24, 4], [15, 0]]) {
    g.beginPath(); g.moveTo(x0, T); g.quadraticCurveTo(x0 + bend, 20, x0 + bend * 1.6, 8 + ((x0 * 3) % 8)); g.stroke();
  } done();
  // 40 torch (block 39): wooden stick with a warm flame
  tile(40); g.clearRect(0, 0, T, T);
  g.fillStyle = '#8a5a32'; g.fillRect(14, 12, 4, 20);
  g.fillStyle = '#ffb84d'; g.fillRect(11, 4, 10, 10);
  g.fillStyle = '#ffe066'; g.fillRect(13, 6, 6, 6);
  g.fillStyle = '#fff3c4'; g.fillRect(15, 8, 2, 3); done();
  // 41 workbench (block 40): sturdy top with tiny tools
  tile(41); fill('#d9a05e'); speck(24, ['#c78f4f'], 2);
  g.fillStyle = '#8a5a32'; g.fillRect(0, 0, T, 5);
  g.fillStyle = '#9d7bff'; g.fillRect(6, 12, 8, 3); g.fillRect(8, 8, 3, 12);
  g.fillStyle = '#e03131'; g.fillRect(20, 14, 6, 6); done();

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let _atlas = null;
export function getAtlas() {
  if (!_atlas) _atlas = drawAtlas();
  return _atlas;
}

let _atlasA = null, _atlasB = null;
function toTex(cv) {
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
// Load the Gemini-designed atlas (client/art/atlas.png + atlas_b.png for animation).
// Falls back to the procedural atlas if the files are missing.
export async function loadAtlas() {
  if (_atlasA) return { a: _atlasA, b: _atlasB || _atlasA };
  try {
    const img = await loadImage('art/atlas.png');
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    _atlasA = toTex(cv);
    try {
      const imgB = await loadImage('art/atlas_b.png');
      const cvB = document.createElement('canvas');
      cvB.width = imgB.naturalWidth; cvB.height = imgB.naturalHeight;
      cvB.getContext('2d').drawImage(imgB, 0, 0);
      _atlasB = toTex(cvB);
    } catch { _atlasB = _atlasA; }
  } catch {
    _atlasA = drawAtlas();
    _atlasB = _atlasA;
  }
  return { a: _atlasA, b: _atlasB };
}

// UV rect for a tile index, with a half-texel inset to avoid bleeding.
export function tileUV(i) {
  const s = 1 / COLS, inset = 0.6 / (T * COLS);
  const col = i % COLS, row = (i / COLS) | 0;
  const u0 = col * s + inset, u1 = (col + 1) * s - inset;
  const v1 = 1 - row * s - inset, v0 = 1 - (row + 1) * s + inset;
  return [u0, v0, u1, v1];
}

// Standalone animated water texture: 4 frames of soft blue wave noise with
// drifting highlights, redrawn into a single 32x32 canvas on a timer.
// Water quads use full-texture UVs so this texture is independent of the atlas
// (atlas frame swaps for glow/crystal/rainbow never touch it).
// Returns { tex, tick(t) } — call tick(seconds) once per frame.
export function makeWaterTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const g = cv.getContext('2d');
  const tex = toTex(cv);
  let frame = -1;
  function draw(f) {
    g.fillStyle = '#3fa7e8'; g.fillRect(0, 0, T, T);
    // soft wave noise: two phase-shifted sine fields
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x += 2) {
        const w = Math.sin((x + f * 8) * 0.45) * 0.5
                + Math.sin((y - f * 5) * 0.6 + x * 0.15) * 0.5;
        if (w > 0.55) { g.fillStyle = 'rgba(120,205,250,0.55)'; g.fillRect(x, y, 2, 1); }
        else if (w < -0.6) { g.fillStyle = 'rgba(38,125,190,0.5)'; g.fillRect(x, y, 2, 1); }
      }
    }
    // drifting white highlight dashes
    g.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 4; i++) {
      const hx = (i * 11 + f * 7) % 28, hy = (i * 13 + f * 5) % 28;
      g.fillRect(hx, hy, 5, 2);
    }
  }
  draw(0);
  return {
    tex,
    tick(t) {
      const f = Math.floor(t / 0.55) % 4;
      if (f !== frame) { frame = f; draw(f); tex.needsUpdate = true; }
    },
  };
}
