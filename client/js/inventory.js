// WonderBlocks inventory: block counts, 9-slot hotbar, starter kit.
import { B, BLOCKS, CATEGORIES, blockDef, STARTER_KIT } from 'wb-shared/blocks.js';

const DEFAULT_HOTBAR = [B.PLANKS, B.WOOD, B.GLASS, B.WINDOW, B.ROOF, B.DOOR, B.LANTERN, B.FLOWER_RED, B.GRASS];

export class Inventory {
  constructor() {
    this.counts = new Map();
    this.hotbar = [...DEFAULT_HOTBAR];
    this.sel = 0;
    this.unlimited = false;
    for (const [id, n] of STARTER_KIT) this.add(id, n);
  }
  add(id, n = 1) {
    if (!id || id === B.AIR) return;
    this.counts.set(id, (this.counts.get(id) || 0) + n);
    this.onChange && this.onChange();
  }
  remove(id, n = 1) {
    if (this.unlimited) return true;
    const c = this.counts.get(id) || 0;
    if (c < n) return false;
    this.counts.set(id, c - n);
    this.onChange && this.onChange();
    return true;
  }
  count(id) { return this.unlimited ? Infinity : (this.counts.get(id) || 0); }
  selectedBlock() { return this.hotbar[this.sel]; }
  canPlace(id) { return this.unlimited || (this.counts.get(id) || 0) > 0; }
  setHotbarSlot(i, id) { this.hotbar[i] = id; this.onChange && this.onChange(); }

  itemsByCat() {
    const out = {};
    for (const c of CATEGORIES) out[c] = [];
    for (const [id, def] of Object.entries(BLOCKS)) {
      const bid = +id;
      if (!def.selectable) continue;
      out[def.cat].push({ id: bid, name: def.name, count: this.counts.get(bid) || 0 });
    }
    return out;
  }
  serialize() {
    return { counts: [...this.counts.entries()], hotbar: this.hotbar, sel: this.sel };
  }
  deserialize(s) {
    if (!s) return;
    this.counts = new Map(s.counts || []);
    if (Array.isArray(s.hotbar) && s.hotbar.length === 9) this.hotbar = s.hotbar;
    this.sel = s.sel || 0;
    this.onChange && this.onChange();
  }
}
