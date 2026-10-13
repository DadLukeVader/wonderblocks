// WonderBlocks villager NPCs: friendly traders in Wonder Village.
// Simple humanoid box models with profession colors. They wander during the
// day and head indoors at night. Right-click a villager to trade.
//
// This module must never throw or break the game when art/saves are absent.
import {
  VILLAGER_PROFESSIONS, VILLAGER_GREETINGS, EMERALD,
  REP_DISCOUNT_THRESHOLD, applyRepDiscount,
} from 'wb-shared/villagerDefs.js?v=22';
import { itemDef } from 'wb-shared/items.js?v=22';
import { foodDef } from 'wb-shared/foods.js?v=22';
import { blockDef } from 'wb-shared/blocks.js?v=22';

// Village center (matches shared/worldgen.js Wonder Village)
const VILLAGE_X = 64, VILLAGE_Z = 64, VILLAGE_R = 20;
// House interiors (from worldgen house() calls: house(50,50) etc., floor y=22)
const HOUSES = [
  { x: 53.5, z: 53 }, { x: 71.5, z: 53 }, { x: 53.5, z: 73 }, { x: 71.5, z: 73 },
];
const FLOOR_Y = 23; // stand on floor (floor block at y=22)

export class VillagerManager {
  constructor(scene, world, player, inv, ui, audio) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inv = inv;
    this.ui = ui;
    this.audio = audio;
    this.villagers = [];
    this.reputation = 0;
    this._tradePanel = null;
    this._activeVillager = null;
    this._greeted = new Set();
  }

  // ---- lifecycle ----

  spawnAll() {
    const profKeys = Object.keys(VILLAGER_PROFESSIONS);
    const n = 3 + ((Math.random() * 3) | 0); // 3-5 villagers
    for (let i = 0; i < n; i++) {
      const prof = profKeys[i % profKeys.length];
      // Scatter around the village plaza, avoiding the well
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 6 + Math.random() * 10;
      const x = VILLAGE_X + Math.cos(ang) * dist;
      const z = VILLAGE_Z + Math.sin(ang) * dist;
      this.spawn(prof, x, z);
    }
  }

  spawn(profKey, x, z) {
    const def = VILLAGER_PROFESSIONS[profKey];
    if (!def) return null;
    const y = this.world.groundY ? this.world.groundY(x, z) + 1 : FLOOR_Y;
    const mesh = this._buildMesh(def);
    const pos = new THREE.Vector3(x, y, z);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const v = {
      id: 'v' + Math.random().toString(36).slice(2, 8),
      profKey, def, mesh, pos,
      home: { x, z },
      state: 'wander', // wander | indoors | trading
      _wt: 0, _wx: 0, _wz: 0,
      _greeted: false,
    };
    this.villagers.push(v);
    return v;
  }

  _buildMesh(def) {
    const g = new THREE.Group();
    // Gemini sprite billboard (profession: farmer/blacksmith/butcher/shopkeeper)
    const profession = (def.profession || '').toLowerCase();
    if (['farmer', 'blacksmith', 'butcher', 'shopkeeper'].includes(profession)) {
      try {
        const tex = new THREE.TextureLoader().load(`art/sprites/${profession}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sprite.scale.set(1.1, 1.6, 1);
        sprite.position.y = 0.8;
        g.add(sprite);
      } catch { /* fall through to box model */ }
      if (g.children.length > 0) {
        // Keep the name label below
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
        const ctx = cv.getContext('2d');
        ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
        ctx.strokeText(def.name, 128, 40); ctx.fillText(def.name, 128, 40);
        const tex = new THREE.CanvasTexture(cv);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        label.scale.set(1.6, 0.4, 1);
        label.position.y = 1.9;
        g.add(label);
        return g;
      }
    }
    const mat = c => new THREE.MeshLambertMaterial({ color: c });
    // Body (shirt)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), mat(def.shirtColor));
    body.position.y = 0.85; g.add(body);
    // Apron (front panel)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.05), mat(def.apronColor));
    apron.position.set(0, 0.82, 0.2); g.add(apron);
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat(0xe8b88a));
    head.position.y = 1.45; g.add(head);
    // Eyes (simple dark squares)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    for (const ex of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.02), eyeMat);
      eye.position.set(ex, 1.48, 0.24); g.add(eye);
    }
    // Hat (profession color)
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), mat(def.hatColor));
    hat.position.y = 1.76; g.add(hat);
    // Arms
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), mat(def.shirtColor));
      arm.position.set(s * 0.36, 0.85, 0); g.add(arm);
    }
    // Legs
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), mat(0x5a4a3a));
      leg.position.set(s * 0.14, 0.25, 0); g.add(leg);
    }
    // Name/profession label sprite (canvas)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const cx = cv.getContext('2d');
    cx.font = 'bold 28px sans-serif'; cx.textAlign = 'center';
    cx.fillStyle = 'rgba(0,0,0,0.55)'; cx.fillRect(0, 8, 256, 44);
    cx.fillStyle = '#fff'; cx.fillText(def.label, 128, 40);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(1.6, 0.4, 1); spr.position.y = 2.15;
    g.add(spr);
    return g;
  }

  // ---- per-frame update ----

  update(dt, isNight) {
    for (const v of this.villagers) {
      if (v.state === 'trading') continue; // stand still while trading
      if (isNight) {
        this._goIndoors(v, dt);
      } else {
        this._wander(v, dt);
      }
      // Face movement direction (or player when close)
      const dx = this.player.pos.x - v.pos.x, dz = this.player.pos.z - v.pos.z;
      const pd = Math.hypot(dx, dz);
      if (pd < 4) v.mesh.lookAt(this.player.pos.x, v.pos.y, this.player.pos.z);
    }
  }

  _wander(v, dt) {
    v._wt -= dt;
    if (v._wt <= 0) {
      v._wt = 3 + Math.random() * 4;
      // Pick a target near home (within village)
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * 12;
      v._tx = v.home.x + Math.cos(ang) * dist;
      v._tz = v.home.z + Math.sin(ang) * dist;
    }
    if (v._tx == null) return;
    const dx = v._tx - v.pos.x, dz = v._tz - v.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const sp = 1.6 * dt;
      v.pos.x += (dx / d) * sp;
      v.pos.z += (dz / d) * sp;
      v.mesh.lookAt(v._tx, v.pos.y, v._tz);
      // Gentle bob while walking
      v.mesh.position.y = v.pos.y + Math.abs(Math.sin(performance.now() / 300)) * 0.05;
    } else {
      v.mesh.position.y = v.pos.y;
    }
    v.mesh.position.x = v.pos.x;
    v.mesh.position.z = v.pos.z;
    // Keep on ground
    if (this.world.groundY) {
      const gy = this.world.groundY(v.pos.x, v.pos.z) + 1;
      if (Math.abs(v.pos.y - gy) < 3) v.pos.y += (gy - v.pos.y) * Math.min(1, dt * 5);
    }
  }

  _goIndoors(v, dt) {
    // Head to the nearest house interior
    let best = HOUSES[0], bestD = 1e9;
    for (const h of HOUSES) {
      const d = Math.hypot(h.x - v.pos.x, h.z - v.pos.z);
      if (d < bestD) { best = h; bestD = d; }
    }
    const dx = best.x - v.pos.x, dz = best.z - v.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.2) {
      const sp = 2.2 * dt;
      v.pos.x += (dx / d) * sp;
      v.pos.z += (dz / d) * sp;
      v.mesh.lookAt(best.x, v.pos.y, best.z);
      v.mesh.position.y = v.pos.y + Math.abs(Math.sin(performance.now() / 300)) * 0.05;
    } else {
      v.mesh.position.y = v.pos.y;
      // Settle at floor height inside
      v.pos.y += (FLOOR_Y - v.pos.y) * Math.min(1, dt * 3);
    }
    v.mesh.position.x = v.pos.x;
    v.mesh.position.z = v.pos.z;
  }

  // ---- interaction: right-click a villager to greet + trade ----

  // Called from main.js on right-click. Returns true if a villager was hit.
  tryInteract() {
    const px = this.player.pos.x, pz = this.player.pos.z;
    let best = null, bestD = 4.0;
    for (const v of this.villagers) {
      const d = Math.hypot(v.pos.x - px, v.pos.z - pz);
      if (d < bestD) { best = v; bestD = d; }
    }
    if (!best) return false;
    // Greet on first interaction
    if (!best._greeted) {
      best._greeted = true;
      const g = VILLAGER_GREETINGS[(Math.random() * VILLAGER_GREETINGS.length) | 0];
      this.ui.toast(`🧑‍🌾 ${best.def.label}: "${g}"`);
      this.audio.click();
    }
    this.openTrade(best);
    return true;
  }

  // ---- trading UI ----

  openTrade(v) {
    this._activeVillager = v;
    v.state = 'trading';
    let p = document.getElementById('villager-trade');
    if (!p) {
      const hud = document.getElementById('hud');
      if (!hud) return;
      hud.insertAdjacentHTML('beforeend', '<div id="villager-trade" class="panel hidden"></div>');
      p = document.getElementById('villager-trade');
    }
    document.querySelectorAll('#hud .panel').forEach(x => x.classList.add('hidden'));
    this._renderTrades();
    p.classList.remove('hidden');
  }

  closeTrade() {
    const p = document.getElementById('villager-trade');
    if (p) p.classList.add('hidden');
    if (this._activeVillager) this._activeVillager.state = 'wander';
    this._activeVillager = null;
  }

  isOpen() {
    const p = document.getElementById('villager-trade');
    return !!p && !p.classList.contains('hidden');
  }

  _itemLabel(id) {
    const n = +id;
    try {
      const it = itemDef(n);
      if (it) return `${it.icon || '📦'} ${it.name}`;
    } catch { /* ignore */ }
    try {
      const f = foodDef(n);
      if (f) return `${f.icon || '🍎'} ${f.name}`;
    } catch { /* ignore */ }
    try {
      const b = blockDef(n);
      if (b) return `🧱 ${b.name}`;
    } catch { /* ignore */ }
    return `📦 #${n}`;
  }

  _tradeLabel(id, n) {
    return `${n}× ${this._itemLabel(id)}`;
  }

  _renderTrades() {
    const p = document.getElementById('villager-trade');
    const v = this._activeVillager;
    if (!p || !v) return;
    const disc = this.reputation >= REP_DISCOUNT_THRESHOLD;
    const rows = v.def.trades.map((t, i) => {
      const trade = applyRepDiscount(t, this.reputation);
      const giveId = +Object.keys(trade.give)[0], giveN = trade.give[giveId];
      const getId = +Object.keys(trade.get)[0], getN = trade.get[getId];
      const have = this.inv.count(giveId);
      const can = have >= giveN;
      return `<div class="trow">
        <span class="tlabel">${this._tradeLabel(giveId, giveN)} → ${this._tradeLabel(getId, getN)}</span>
        <span class="thave">${have}/${giveN}</span>
        <button class="tbtn ${can ? '' : 'dis'}" data-t="${i}" ${can ? '' : 'disabled'}>Trade</button>
      </div>`;
    }).join('');
    p.innerHTML = `<h3>🧑‍🌾 ${v.def.label} <button class="xbtn" id="vtrade_x" title="Close">✕</button></h3>
      <p class="note">${disc ? '⭐ Friend discount active (10% off)!' : `Reputation: ${this.reputation}/${REP_DISCOUNT_THRESHOLD} for friend discount`}</p>
      <div class="trows">${rows}</div>
      <p class="note">💚 Emeralds: ${this.inv.count(EMERALD)}</p>`;
    p.querySelector('#vtrade_x').onclick = () => this.closeTrade();
    p.querySelectorAll('.tbtn').forEach(b => b.onclick = () => this.doTrade(+b.dataset.t));
  }

  doTrade(i) {
    const v = this._activeVillager;
    if (!v || !this.inv) return;
    const trade = applyRepDiscount(v.def.trades[i], this.reputation);
    const giveId = +Object.keys(trade.give)[0], giveN = trade.give[giveId];
    const getId = +Object.keys(trade.get)[0], getN = trade.get[getId];
    if (this.inv.count(giveId) < giveN) {
      this.ui.toast('❌ You don\'t have enough for that trade.');
      return;
    }
    this.inv.remove(giveId, giveN);
    this.inv.add(getId, getN);
    this.reputation += 1;
    this.audio.pickup();
    this.ui.toast(`✅ Traded! Reputation: ${this.reputation}${this.reputation === REP_DISCOUNT_THRESHOLD ? ' — friend discount unlocked! ⭐' : ''}`);
    if (this.inv.onChange) this.inv.onChange();
    this._renderTrades();
  }

  // ---- persistence ----

  save() {
    return {
      reputation: this.reputation,
      villagers: this.villagers.map(v => ({ profKey: v.profKey, x: v.home.x, z: v.home.z })),
    };
  }

  load(data) {
    if (!data) { this.spawnAll(); return; }
    this.reputation = data.reputation || 0;
    // Clear any existing
    for (const v of this.villagers) this.scene.remove(v.mesh);
    this.villagers = [];
    const list = data.villagers && data.villagers.length ? data.villagers : null;
    if (list) {
      for (const s of list) this.spawn(s.profKey, s.x, s.z);
    } else {
      this.spawnAll();
    }
  }

  dispose() {
    for (const v of this.villagers) this.scene.remove(v.mesh);
    this.villagers = [];
    this.closeTrade();
  }
}
