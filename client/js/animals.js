// WonderBlocks critters: rabbits, chickens, butterflies, birds, fish — plus adoptable pets.
import * as THREE from 'three';
import { B } from 'wb-shared/blocks.js';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

function makeRabbit() {
  const g = new THREE.Group();
  const c = Math.random() < 0.5 ? '#f5f5f5' : '#c9b8a8';
  g.add(box(0.4, 0.35, 0.5, c, 0, 0.28, 0));
  g.add(box(0.28, 0.28, 0.28, c, 0, 0.5, 0.3));
  g.add(box(0.08, 0.3, 0.08, c, -0.09, 0.78, 0.28));
  g.add(box(0.08, 0.3, 0.08, c, 0.09, 0.78, 0.28));
  const tail = box(0.14, 0.14, 0.14, '#ffffff', 0, 0.35, -0.3); g.add(tail);
  return { g, kind: 'rabbit', hop: true };
}
function makeChicken() {
  const g = new THREE.Group();
  g.add(box(0.35, 0.35, 0.4, '#ffffff', 0, 0.32, 0));
  g.add(box(0.25, 0.25, 0.25, '#ffffff', 0, 0.55, 0.22));
  g.add(box(0.08, 0.08, 0.12, '#ffa94d', 0, 0.52, 0.4));
  g.add(box(0.1, 0.12, 0.06, '#ff6b6b', 0, 0.72, 0.22));
  g.add(box(0.3, 0.06, 0.25, '#fff3d6', 0, 0.42, -0.1));
  return { g, kind: 'chicken', hop: true };
}
function makeButterfly() {
  const g = new THREE.Group();
  const cols = ['#ff9dcf', '#9dcfff', '#ffe066', '#c09dff'];
  const c = cols[(Math.random() * cols.length) | 0];
  const wm = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), wm); w1.position.x = -0.15;
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), wm); w2.position.x = 0.15;
  const bd = box(0.08, 0.08, 0.3, '#5b4a68', 0, 0, 0);
  g.add(w1, w2, bd);
  return { g, kind: 'butterfly', wings: [w1, w2], fly: true };
}
function makeBird() {
  const g = new THREE.Group();
  const c = ['#74c0fc', '#ffd43b', '#ff8fab'][(Math.random() * 3) | 0];
  g.add(box(0.3, 0.22, 0.42, c, 0, 0, 0));
  g.add(box(0.2, 0.2, 0.2, c, 0, 0.16, 0.26));
  const wm = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.25), wm); w1.position.x = -0.32;
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.25), wm); w2.position.x = 0.32;
  g.add(w1, w2);
  return { g, kind: 'bird', wings: [w1, w2], fly: true, circle: true };
}
function makeFish() {
  const g = new THREE.Group();
  const c = ['#ffa94d', '#74c0fc', '#ff8fab'][(Math.random() * 3) | 0];
  g.add(box(0.35, 0.22, 0.18, c, 0, 0, 0));
  g.add(box(0.14, 0.16, 0.06, c, -0.24, 0, 0));
  return { g, kind: 'fish', swim: true };
}

const MAKERS = { rabbit: makeRabbit, chicken: makeChicken, butterfly: makeButterfly, bird: makeBird, fish: makeFish };

export class Critter {
  constructor(scene, kind, x, y, z) {
    const m = MAKERS[kind]();
    this.kind = kind; this.g = m.g; this.def = m;
    this.g.position.set(x, y, z);
    scene.add(this.g);
    this.scene = scene;
    this.target = new THREE.Vector3(x, y, z);
    this.retarget = 0;
    this.phase = Math.random() * 10;
    this.petOf = null;
    this.name = null;
  }
  update(dt, world, playerPos) {
    this.phase += dt * 6;
    const p = this.g.position;
    if (this.petOf) {
      // follow owner
      const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
      if (d > 2.2) {
        const a = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
        p.x += Math.sin(a) * 4 * dt; p.z += Math.cos(a) * 4 * dt;
        this.g.rotation.y = a;
        p.y = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1 + Math.abs(Math.sin(this.phase)) * 0.35;
      } else {
        p.y += (world.topY(Math.floor(p.x), Math.floor(p.z)) + 1 - p.y) * Math.min(1, 5 * dt);
      }
      return;
    }
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
      const sp = this.def.circle ? 5 : 1.6;
      p.x += dx / d * sp * dt; p.z += dz / d * sp * dt;
      this.g.rotation.y = Math.atan2(dx, dz);
      if (this.def.hop) {
        const gy = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1;
        p.y = gy + Math.abs(Math.sin(this.phase * 1.4)) * 0.45;
      }
    } else if (this.def.hop) {
      const gy = world.topY(Math.floor(p.x), Math.floor(p.z)) + 1;
      p.y += (gy - p.y) * Math.min(1, 6 * dt);
    }
    if (this.def.wings) {
      const f = Math.sin(this.phase * 3) * 0.7;
      this.def.wings[0].rotation.y = f; this.def.wings[1].rotation.y = -f;
    }
    if (this.def.fly && !this.def.circle) {
      p.y += Math.sin(this.phase * 0.7) * dt * 1.2;
    }
    if (this.def.swim) {
      p.y += Math.sin(this.phase * 0.5) * dt * 0.6;
    }
  }
  dispose() { this.scene.remove(this.g); }
}

export class CritterManager {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.critters = [];
  }
  spawnInitial() {
    const w = this.world;
    const put = (kind, n, test) => {
      let placed = 0, guard = 0;
      while (placed < n && guard++ < 800) {
        const x = 4 + ((Math.random() * 120) | 0), z = 4 + ((Math.random() * 120) | 0);
        const y = test(x, z);
        if (y === null) continue;
        this.critters.push(new Critter(this.scene, kind, x + 0.5, y, z + 0.5));
        placed++;
      }
    };
    const groundOK = (x, z) => {
      const h = w.topY(x, z);
      const b = w.get(x, h, z);
      return (b === B.GRASS || b === B.SAND) && h > 20 && h < 30 ? h + 1 : null;
    };
    put('rabbit', 10, groundOK);
    put('chicken', 8, groundOK);
    put('butterfly', 14, (x, z) => { const y = groundOK(x, z); return y === null ? null : y + 1.5 + Math.random(); });
    put('bird', 8, () => 30 + Math.random() * 8);
    put('fish', 10, (x, z) => {
      for (let y = 20; y > 12; y--) if (w.get(x, y, z) === B.WATER) return y;
      return null;
    });
  }
  nearestAdoptable(pos) {
    let best = null, bd = 16;
    for (const c of this.critters) {
      if (c.petOf || (c.kind !== 'rabbit' && c.kind !== 'chicken')) continue;
      const d = Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z);
      if (d < 4 && d < bd) { bd = d; best = c; }
    }
    return best;
  }
  update(dt, playerPos) {
    for (const c of this.critters) c.update(dt, this.world, playerPos);
  }
}
