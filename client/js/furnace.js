// WonderBlocks furnace system (Phase 4): smelt raw food into cooked meals.
//
// Put a smeltable food + fuel (wood/planks) in a placed furnace; each item
// smelts over 10s. Right-click a furnace block (with a non-block selected) to
// open the UI. Furnace contents are client-side; breaking a furnace returns
// its contents to the inventory.

import { B, blockDef } from 'wb-shared/blocks.js?v=23';
import { SMELT_RECIPES, FUEL_IDS, foodDef } from 'wb-shared/foods.js?v=23';

export const SMELT_TIME = 10; // seconds per item

export class FurnaceSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui; // FurnaceUI instance
    this.furnaces = new Map(); // "x,y,z" -> { input:{id,n}, fuel, progress, output:{id,n} }
    this._tick = 0;
  }

  _key(x, y, z) { return `${x},${y},${z}`; }

  state(x, y, z) {
    const k = this._key(x, y, z);
    let s = this.furnaces.get(k);
    if (!s) { s = { input: null, fuel: 0, progress: 0, output: null }; this.furnaces.set(k, s); }
    return s;
  }

  open(x, y, z) {
    this.ui.open(this, x, y, z);
  }

  // Breaking a furnace returns its contents.
  onBreak(x, y, z) {
    const k = this._key(x, y, z);
    const s = this.furnaces.get(k);
    if (!s) return;
    const inv = this.game.inv;
    if (s.input) inv.add(s.input.id, s.input.n);
    if (s.output) inv.add(s.output.id, s.output.n);
    // fuel is consumed as burnable blocks; return remaining fuel count as planks
    if (s.fuel > 0) inv.add(B.PLANKS, s.fuel);
    this.furnaces.delete(k);
  }

  update(dt) {
    this._tick += dt;
    if (this._tick < 1) return;
    this._tick = 0;
    let changed = false;
    for (const [, s] of this.furnaces) {
      if (!s.input || s.fuel <= 0) { s.progress = 0; continue; }
      const recipe = SMELT_RECIPES[s.input.id];
      if (!recipe || s.input.n < recipe.n) { s.progress = 0; continue; }
      if (s.output && (s.output.id !== recipe.out || s.output.n >= 64)) { s.progress = 0; continue; }
      s.progress += 1;
      changed = true;
      if (s.progress >= SMELT_TIME) {
        s.progress = 0;
        s.input.n -= recipe.n;
        if (s.input.n <= 0) s.input = null;
        s.fuel -= 1;
        if (s.output) s.output.n += 1;
        else s.output = { id: recipe.out, n: 1 };
        const f = foodDef(recipe.out);
        this.game.ui.toast(`🔥 Smelted ${f.icon} ${f.name}!`);
        this.game.audio.pickup();
      }
    }
    if (changed && this.ui.isOpen()) this.ui.refresh();
  }
}

export class FurnaceUI {
  constructor() {
    this.sys = null;
    this.pos = null;
  }

  ensureDOM() {
    let p = document.getElementById('furnace');
    if (p) return p;
    const hud = document.getElementById('hud');
    if (!hud) return null;
    hud.insertAdjacentHTML('beforeend', '<div id="furnace" class="panel hidden"></div>');
    return document.getElementById('furnace');
  }

  isOpen() {
    const p = document.getElementById('furnace');
    return !!p && !p.classList.contains('hidden');
  }

  open(sys, x, y, z) {
    const p = this.ensureDOM();
    if (!p) return;
    document.querySelectorAll('#hud .panel').forEach(el => el.classList.add('hidden'));
    this.sys = sys;
    this.pos = { x, y, z };
    this.refresh();
    p.classList.remove('hidden');
  }

  hide() {
    const p = document.getElementById('furnace');
    if (p) p.classList.add('hidden');
    this.sys = null;
    this.pos = null;
  }

  _slotHTML(label, content, btnId, btnLabel) {
    return `<div class="frow"><span class="flabel">${label}</span>` +
      `<span class="fslot">${content}</span>` +
      (btnId ? `<button class="mbtn" id="${btnId}">${btnLabel}</button>` : '') + `</div>`;
  }

  refresh() {
    const p = document.getElementById('furnace');
    if (!p || !this.sys || !this.pos) return;
    const s = this.sys.state(this.pos.x, this.pos.y, this.pos.z);
    const inF = s.input ? foodDef(s.input.id) : null;
    const outF = s.output ? foodDef(s.output.id) : null;
    const pct = Math.round((s.progress / SMELT_TIME) * 100);
    p.innerHTML =
      `<h3>🔥 Furnace <button class="xbtn" id="furn_x" title="Close">✕</button></h3>` +
      this._slotHTML('Input', inF ? `${inF.icon} ${inF.name} ×${s.input.n}` : '<i>empty</i>', 'furn_addin', '+ Add') +
      this._slotHTML('Fuel', s.fuel > 0 ? `🪵 ×${s.fuel}` : '<i>empty</i>', 'furn_addfuel', '+ Add') +
      `<div class="fprog"><div class="fprogbar" style="width:${pct}%"></div></div>` +
      this._slotHTML('Output', outF ? `${outF.icon} ${outF.name} ×${s.output.n}` : '<i>empty</i>', 'furn_take', 'Take');
    const el = id => p.querySelector('#' + id);
    el('furn_x').onclick = () => this.hide();
    el('furn_addin').onclick = () => this._addInput();
    el('furn_addfuel').onclick = () => this._addFuel();
    el('furn_take').onclick = () => this._take();
  }

  _addInput() {
    const inv = this.sys.game.inv;
    const s = this.sys.state(this.pos.x, this.pos.y, this.pos.z);
    // Prefer whatever the player has selected if smeltable.
    const candidates = [];
    const sel = inv.selectedBlock();
    if (SMELT_RECIPES[sel]) candidates.push(sel);
    for (const id of Object.keys(SMELT_RECIPES).map(Number))
      if (id !== sel && inv.count(id) > 0) candidates.push(id);
    for (const id of candidates) {
      if (s.input && s.input.id !== id) continue; // one input type at a time
      const n = Math.min(inv.count(id), 8 - (s.input ? s.input.n : 0));
      if (n <= 0) continue;
      if (!inv.remove(id, n)) continue;
      if (s.input) s.input.n += n; else s.input = { id, n };
      this.sys.game.audio.pop();
      break;
    }
    this.refresh();
  }

  _addFuel() {
    const inv = this.sys.game.inv;
    const s = this.sys.state(this.pos.x, this.pos.y, this.pos.z);
    for (const fid of Object.keys(FUEL_IDS).map(Number)) {
      const space = 16 - s.fuel;
      if (space <= 0) break;
      // Convert fuel units: each block grants FUEL_IDS[fid] smelts.
      const blocks = Math.min(inv.count(fid), Math.ceil(space / FUEL_IDS[fid]));
      if (blocks <= 0) continue;
      if (!inv.remove(fid, blocks)) continue;
      s.fuel += blocks * FUEL_IDS[fid];
      this.sys.game.audio.pop();
      break;
    }
    this.refresh();
  }

  _take() {
    const s = this.sys.state(this.pos.x, this.pos.y, this.pos.z);
    if (!s.output) return;
    this.sys.game.inv.add(s.output.id, s.output.n);
    s.output = null;
    this.sys.game.audio.pickup();
    this.refresh();
  }
}
