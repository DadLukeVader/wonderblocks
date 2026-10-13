// WonderBlocks chibi character builder (also used for remote players + pets use animals.js).
import * as THREE from 'three';

export const SKIN_TONES = ['#ffe0bd', '#f7c08b', '#d99a63', '#a06a3e', '#6f4527'];
export const HAIR_STYLES = ['flat', 'spiky', 'long', 'puffy'];
export const HAIR_COLORS = ['#3b2a20', '#6b4a2f', '#c98a3b', '#e8b64c', '#b34a3f', '#7a5fc0', '#4d9de0', '#f2f2f2'];
export const SHIRT_COLORS = ['#ff8fab', '#74c0fc', '#8ce99a', '#ffe066', '#b197fc', '#ffa94d', '#f783ac', '#63e6be'];
export const PANTS_COLORS = ['#5c7cfa', '#748ffc', '#3b5bdb', '#9775fa', '#e8590c', '#2f9e44', '#f08c00'];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  m.castShadow = false;
  return m;
}

export function randomChar() {
  const pick = a => a[(Math.random() * a.length) | 0];
  return {
    skin: pick(SKIN_TONES), hairStyle: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS),
    shirt: pick(SHIRT_COLORS), pants: pick(PANTS_COLORS), accessory: 'none',
  };
}

let _faceTexs = null;
// Load Gemini-designed face sprites (client/art/faces.png, 2x2 grid). Null if missing.
export async function loadFaces() {
  if (_faceTexs !== undefined && _faceTexs !== null) return _faceTexs;
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'art/faces.png';
    });
    const S = 64, faces = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      cv.getContext('2d').drawImage(img, c * img.naturalWidth / 2, r * img.naturalHeight / 2, img.naturalWidth / 2, img.naturalHeight / 2, 0, 0, S, S);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      faces.push(t);
    }
    _faceTexs = faces;
  } catch { _faceTexs = null; }
  return _faceTexs;
}

export function buildCharacter(o = {}, faceTex = null) {
  const c = Object.assign(randomChar(), o);
  const g = new THREE.Group();
  const parts = {};

  // legs (pivot at hip y=0.7)
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.14, 0.7, 0);
    const upper = box(0.24, 0.45, 0.28, c.pants, 0, -0.22, 0);
    const shoe = box(0.26, 0.22, 0.34, '#6b4a8a', 0, -0.55, 0.03);
    leg.add(upper, shoe); g.add(leg);
    parts[s < 0 ? 'legL' : 'legR'] = leg;
  }
  // body
  const body = box(0.56, 0.62, 0.34, c.shirt, 0, 1.0, 0); g.add(body); parts.body = body;
  // arms (pivot at shoulder y=1.25)
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.38, 1.25, 0);
    arm.add(box(0.2, 0.42, 0.24, c.shirt, 0, -0.2, 0));
    arm.add(box(0.18, 0.2, 0.22, c.skin, 0, -0.5, 0));
    g.add(arm);
    parts[s < 0 ? 'armL' : 'armR'] = arm;
  }
  // head group (pivot at neck y=1.32)
  const headG = new THREE.Group(); headG.position.set(0, 1.32, 0); g.add(headG); parts.headG = headG;
  if (faceTex) {
    // Gemini-designed face decal on the front of the head
    const skinM = new THREE.MeshLambertMaterial({ color: c.skin });
    const faceM = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.48), [skinM, skinM, skinM, skinM, faceM, skinM]);
    head.position.set(0, 0.26, 0); headG.add(head); parts.head = head;
  } else {
    const head = box(0.52, 0.5, 0.48, c.skin, 0, 0.26, 0); headG.add(head); parts.head = head;
    // eyes + smile + blush (front = +z)
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x2b2b3a });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.02), eyeM);
      e.position.set(s * 0.12, 0.3, 0.245); headG.add(e);
      const blush = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xff9db0 }));
      blush.position.set(s * 0.19, 0.2, 0.245); headG.add(blush);
    }
    const smile = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x8a4a5a }));
    smile.position.set(0, 0.16, 0.245); headG.add(smile);
  }

  // hair
  const hairG = new THREE.Group(); headG.add(hairG); parts.hairG = hairG;
  const hc = c.hairColor;
  if (c.hairStyle === 'flat') hairG.add(box(0.56, 0.12, 0.52, hc, 0, 0.53, 0));
  else if (c.hairStyle === 'spiky') {
    hairG.add(box(0.56, 0.1, 0.52, hc, 0, 0.52, 0));
    for (const [sx, sz] of [[-0.16, -0.1], [0, -0.12], [0.16, -0.1], [-0.08, 0.12], [0.08, 0.12]])
      hairG.add(box(0.14, 0.18, 0.14, hc, sx, 0.62, sz));
  } else if (c.hairStyle === 'long') {
    hairG.add(box(0.56, 0.12, 0.52, hc, 0, 0.53, 0));
    hairG.add(box(0.1, 0.5, 0.5, hc, -0.28, 0.28, 0));
    hairG.add(box(0.1, 0.5, 0.5, hc, 0.28, 0.28, 0));
    hairG.add(box(0.56, 0.42, 0.1, hc, 0, 0.3, -0.26));
  } else if (c.hairStyle === 'puffy') {
    hairG.add(box(0.62, 0.3, 0.58, hc, 0, 0.58, 0));
    hairG.add(box(0.4, 0.18, 0.4, hc, 0, 0.76, 0));
  }
  // accessory
  if (c.accessory === 'cap') {
    const cap = new THREE.Group();
    cap.add(box(0.56, 0.14, 0.52, '#ff6b6b', 0, 0.6, 0));
    cap.add(box(0.56, 0.06, 0.3, '#ff6b6b', 0, 0.55, 0.38));
    cap.add(box(0.1, 0.1, 0.1, '#ffe066', 0, 0.68, 0));
    hairG.add(cap);
  } else if (c.accessory === 'glasses') {
    const gm = new THREE.MeshBasicMaterial({ color: 0x2b3a4a });
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.03), gm);
      lens.position.set(s * 0.12, 0.3, 0.25); headG.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), gm);
    bridge.position.set(0, 0.3, 0.25); headG.add(bridge);
  } else if (c.accessory === 'crown') {
    const cols = ['#ff6b6b', '#ffe066', '#74c0fc', '#8ce99a', '#b197fc'];
    cols.forEach((col, i) => hairG.add(box(0.09, 0.1, 0.09, col, -0.18 + i * 0.09, 0.62, 0.2)));
  }

  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  return { group: g, parts, opts: c };
}

// Simple procedural animation. mode: idle|walk|swim|jump|dance|wave|happy
export function animateCharacter(parts, mode, phase, speed = 1) {
  const s = Math.sin(phase), c2 = Math.cos(phase);
  const L = parts.legL, R = parts.legR, AL = parts.armL, AR = parts.armR;
  if (mode === 'walk') {
    L.rotation.x = s * 0.8; R.rotation.x = -s * 0.8;
    AL.rotation.x = -s * 0.7; AR.rotation.x = s * 0.7;
    AL.rotation.z = 0.12; AR.rotation.z = -0.12;
    parts.headG.rotation.x = 0.05;
  } else if (mode === 'swim') {
    L.rotation.x = 0.5 + s * 0.4; R.rotation.x = 0.5 - s * 0.4;
    AL.rotation.x = -2.4 + s * 0.5; AR.rotation.x = -2.4 - s * 0.5;
    AL.rotation.z = 0.5; AR.rotation.z = -0.5;
    parts.headG.rotation.x = -0.3;
  } else if (mode === 'jump') {
    L.rotation.x = -0.5; R.rotation.x = 0.3; AL.rotation.z = 2.6; AR.rotation.z = -2.6;
    AL.rotation.x = 0; AR.rotation.x = 0;
  } else if (mode === 'dance') {
    const t = phase * 2;
    L.rotation.x = Math.sin(t) * 0.5; R.rotation.x = -Math.sin(t) * 0.5;
    AL.rotation.z = 2.4 + Math.sin(t) * 0.4; AR.rotation.z = -2.4 - Math.cos(t) * 0.4;
    AL.rotation.x = 0; AR.rotation.x = 0;
    parts.headG.rotation.z = Math.sin(t * 0.5) * 0.15;
  } else if (mode === 'wave') {
    AL.rotation.z = 2.6; AL.rotation.x = Math.sin(phase * 3) * 0.4;
    AR.rotation.x = 0; AR.rotation.z = -0.12; L.rotation.x = 0; R.rotation.x = 0;
  } else { // idle / happy
    const b = mode === 'happy' ? Math.abs(Math.sin(phase * 2)) * 0.15 : Math.sin(phase * 0.8) * 0.04;
    L.rotation.x *= 0.9; R.rotation.x *= 0.9; AL.rotation.x *= 0.9; AR.rotation.x *= 0.9;
    AL.rotation.z = 0.1; AR.rotation.z = -0.1;
    parts.body.position.y = 1.0 + b * 0.4;
    parts.headG.rotation.x = b * 0.3;
  }
  void c2; void speed;
}
