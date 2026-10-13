// WonderBlocks player: AABB voxel physics, swimming, third-person orbit camera.
import * as THREE from 'three';
import { B, isSolid } from 'wb-shared/blocks.js?v=11';
import { buildCharacter, animateCharacter } from './character.js?v=11';

const PW = 0.3, PH = 1.8, EYE = 1.62;

export class Player {
  constructor(scene, world, charOpts, spawn, faceTex = null) {
    this.world = world;
    const built = buildCharacter(charOpts, faceTex);
    this.mesh = built.group;
    this.parts = built.parts;
    this.charOpts = built.opts;
    scene.add(this.mesh);
    this.scene = scene;

    this.pos = new THREE.Vector3(spawn[0], spawn[1], spawn[2]);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI * 0.9;
    this.pitch = 0.35;
    this.dist = 6;
    this.onGround = false;
    this.inWater = false;
    this.walkPhase = 0;
    this.anim = 'idle';
    this.emote = null;
    this.emoteUntil = 0;
    this.firstPerson = false;
    this.speed2d = 0;
  }

  solidAt(bx, by, bz) { return isSolid(this.world.get(bx, by, bz)); }

  collideAxis(axis) {
    const p = this.pos;
    let hit = false;
    for (let iter = 0; iter < 4; iter++) {
      const minX = Math.floor(p.x - PW), maxX = Math.floor(p.x + PW);
      const minY = Math.floor(p.y), maxY = Math.floor(p.y + PH);
      const minZ = Math.floor(p.z - PW), maxZ = Math.floor(p.z + PW);
      let resolved = false;
      for (let bx = minX; bx <= maxX && !resolved; bx++)
        for (let by = minY; by <= maxY && !resolved; by++)
          for (let bz = minZ; bz <= maxZ && !resolved; bz++) {
            if (!this.solidAt(bx, by, bz)) continue;
            // true AABB overlap (epsilon avoids re-triggering on exact boundaries)
            const ox = Math.min(p.x + PW, bx + 1) - Math.max(p.x - PW, bx);
            const oy = Math.min(p.y + PH, by + 1) - Math.max(p.y, by);
            const oz = Math.min(p.z + PW, bz + 1) - Math.max(p.z - PW, bz);
            if (ox <= 1e-6 || oy <= 1e-6 || oz <= 1e-6) continue;
            // minimal-penetration resolution along the motion axis
            if (axis === 0) {
              if ((bx + 1) - (p.x - PW) < (p.x + PW) - bx) p.x += (bx + 1) - (p.x - PW);
              else p.x -= (p.x + PW) - bx;
              this.vel.x = 0;
            } else if (axis === 2) {
              if ((bz + 1) - (p.z - PW) < (p.z + PW) - bz) p.z += (bz + 1) - (p.z - PW);
              else p.z -= (p.z + PW) - bz;
              this.vel.z = 0;
            } else {
              if ((by + 1) - p.y <= (p.y + PH) - by) {
                p.y += (by + 1) - p.y;
                if (this.vel.y <= 0.01) this.onGround = true;
              } else {
                p.y -= (p.y + PH) - by;
              }
              this.vel.y = 0;
            }
            hit = true; resolved = true;
          }
      if (!resolved) break;
    }
    return hit;
  }

  update(dt, mv) {
    // mv: {f, s, jump, sprint}
    const w = this.world;
    const feetB = w.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.25), Math.floor(this.pos.z));
    const headB = w.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.3), Math.floor(this.pos.z));
    this.inWater = feetB === B.WATER || headB === B.WATER;

    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    let wx = fx * mv.f + rx * mv.s, wz = fz * mv.f + rz * mv.s;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    const speed = this.inWater ? 3.4 : mv.sprint ? 6.8 : 4.4;
    const accel = this.inWater ? 18 : this.onGround ? 42 : 14;
    this.vel.x += (wx * speed - this.vel.x) * Math.min(1, accel * dt / Math.max(1, speed));
    this.vel.z += (wz * speed - this.vel.z) * Math.min(1, accel * dt / Math.max(1, speed));

    if (this.inWater) {
      this.vel.y -= 9 * dt;
      if (mv.jump) this.vel.y = Math.min(this.vel.y + 30 * dt, 4.2);
      this.vel.y = Math.max(-3.2, Math.min(4.2, this.vel.y));
      this.onGround = false;
    } else {
      this.vel.y -= 26 * dt;
      if (this.vel.y < -30) this.vel.y = -30;
      if (mv.jump && this.onGround) { this.vel.y = 8.8; this.onGround = false; }
    }

    this.pos.x += this.vel.x * dt;
    this.collideAxis(0);
    this.pos.z += this.vel.z * dt;
    this.collideAxis(2);
    this.onGround = false;
    this.pos.y += this.vel.y * dt;
    this.collideAxis(1);

    // world borders
    this.pos.x = Math.max(1.5, Math.min(126.5, this.pos.x));
    this.pos.z = Math.max(1.5, Math.min(126.5, this.pos.z));
    if (this.pos.y < 1) { this.pos.y = 1; this.vel.y = 0; this.onGround = true; }

    this.speed2d = Math.hypot(this.vel.x, this.vel.z);

    // face movement
    if (this.speed2d > 0.6) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.mesh.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.mesh.rotation.y += d * Math.min(1, 12 * dt);
    }
    this.mesh.position.copy(this.pos);

    // animation
    this.walkPhase += dt * (2 + this.speed2d * 1.9);
    let mode = 'idle';
    if (this.emote && performance.now() < this.emoteUntil) mode = this.emote;
    else if (this.inWater && this.speed2d > 0.5) mode = 'swim';
    else if (!this.onGround && !this.inWater) mode = 'jump';
    else if (this.speed2d > 0.6) mode = 'walk';
    this.anim = mode;
    animateCharacter(this.parts, mode, this.walkPhase);
  }

  playEmote(e) { this.emote = e; this.emoteUntil = performance.now() + 2600; }

  viewDir() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, -Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z); }

  updateCamera(camera) {
    const head = this.headPos();
    if (this.firstPerson) {
      camera.position.copy(head);
      const d = this.viewDir();
      camera.lookAt(head.x + d.x, head.y + d.y, head.z + d.z);
      camera.fov = 75; camera.updateProjectionMatrix();
      this.parts.headG.visible = false;
      return;
    }
    this.parts.headG.visible = true;
    camera.fov = 60; camera.updateProjectionMatrix();
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    // pull camera in when terrain blocks the view
    let t = this.dist;
    for (let tt = this.dist; tt > 0.8; tt -= 0.5) {
      const px = head.x + dir.x * tt, py = head.y + dir.y * tt, pz = head.z + dir.z * tt;
      if (!isSolid(this.world.get(Math.floor(px), Math.floor(py), Math.floor(pz)))) { t = tt; break; }
      t = tt - 0.5;
    }
    t = Math.max(0.8, t);
    camera.position.set(head.x + dir.x * t, Math.max(1.2, head.y + dir.y * t), head.z + dir.z * t);
    camera.lookAt(head.x, head.y + 0.25, head.z);
  }
}

// Lightweight remote-player avatar (position lerped toward network updates).
export class RemotePlayer {
  constructor(scene, charOpts, name, faceTex = null) {
    const built = buildCharacter(charOpts, faceTex);
    this.mesh = built.group;
    this.parts = built.parts;
    this.name = name;
    scene.add(this.mesh);
    this.target = new THREE.Vector3();
    this.ry = 0;
    this.phase = Math.random() * 10;
    this.mode = 'idle';
    this.label = null;
  }
  setTarget(x, y, z, ry, anim) {
    this.target.set(x, y, z); this.ry = ry;
    if (anim) this.mode = anim;
  }
  snap(x, y, z) { this.mesh.position.set(x, y, z); this.target.set(x, y, z); }
  update(dt) {
    const m = this.mesh.position;
    const dx = this.target.x - m.x, dy = this.target.y - m.y, dz = this.target.z - m.z;
    const d = Math.hypot(dx, dz);
    m.x += dx * Math.min(1, 10 * dt);
    m.y += dy * Math.min(1, 12 * dt);
    m.z += dz * Math.min(1, 10 * dt);
    if (d > 0.1) {
      const target = Math.atan2(dx, dz);
      let dd = target - this.mesh.rotation.y;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      this.mesh.rotation.y += dd * Math.min(1, 10 * dt);
    }
    this.phase += dt * (2 + d * 4);
    animateCharacter(this.parts, d > 0.4 ? 'walk' : this.mode, this.phase);
  }
  dispose(scene) { scene.remove(this.mesh); }
}
