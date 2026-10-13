// WonderBlocks crafting panel: browse recipes by tab (Tools / Weapons / Armor),
// see have/need ingredient counts, craft, and assign owned items to the hotbar.
//
// Driven from main.js:
//   this.crafting = new CraftingUI({ onToast, onCrafted, isWorkbenchNearby, playSound });
//   this.crafting.toggle(this.inv);   // C key / 🛠️ toolbar button
//   this.crafting.refresh(this.inv);  // re-render while open
//
// Inventory mutation is client-side (inventories are local by architecture);
// onCrafted lets main.js announce the craft to multiplayer.

import { ITEMS, ITEM_CATS, itemDef, canCraft, craftItem, ingredientName } from 'wb-shared/items.js';
import { blockDef } from 'wb-shared/blocks.js';
import { loadItemIcons } from './itemArt.js';

const TOOL_BLURB = { pickaxe: 'stone, ore & brick', axe: 'wood & planks', shovel: 'dirt, sand & snow' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class CraftingUI {
  constructor({ onToast = () => {}, onCrafted = () => {}, isWorkbenchNearby = () => true, playSound = () => {} } = {}) {
    this.onToast = onToast;
    this.onCrafted = onCrafted;
    this.isWorkbenchNearby = isWorkbenchNearby;
    this.playSound = playSound;
    this.tab = 'tool';
    this.icons = new Map(); // itemId -> art/items/<file>.png (empty = emoji fallback)
    this.inv = null;
    this._built = false;
    loadItemIcons().then(m => { this.icons = m; if (this._built && this.inv) this.refresh(this.inv); });
  }

  ensureDOM() {
    let p = document.getElementById('crafting');
    if (p) { this._built = true; return p; }
    const hud = document.getElementById('hud');
    if (!hud) return null; // constructed before UI — toggle() retries
    hud.insertAdjacentHTML('beforeend', '<div id="crafting" class="panel hidden"></div>');
    this._built = true;
    return document.getElementById('crafting');
  }

  isOpen() {
    const p = document.getElementById('crafting');
    return !!p && !p.classList.contains('hidden');
  }

  toggle(inv) {
    const p = this.ensureDOM();
    if (!p) return;
    if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
    document.querySelectorAll('#hud .panel').forEach(x => x.classList.add('hidden'));
    this.hookInv(inv);
    this.refresh(inv);
    p.classList.remove('hidden');
  }

  // Re-render when the inventory changes while the panel is open
  // (chain onto the existing onChange handler; never clobber it).
  hookInv(inv) {
    if (!inv || inv._craftHooked) { this.inv = inv; return; }
    inv._craftHooked = true;
    const prev = inv.onChange;
    inv.onChange = () => { try { prev && prev(); } finally { if (this.isOpen()) this.refresh(inv); } };
    this.inv = inv;
  }

  refresh(inv) {
    const p = document.getElementById('crafting');
    if (!p || !inv) return;
    this.inv = inv;
    const nearWB = this.isWorkbenchNearby();
    const rows = Object.values(ITEMS)
      .filter(it => it.kind === this.tab)
      .map(it => this.rowHTML(inv, it, nearWB))
      .join('');
    p.innerHTML = `<h3>🛠️ Crafting</h3>
      <div class="cats">${ITEM_CATS.map(([k, label]) =>
        `<button class="cat ${k === this.tab ? 'sel' : ''}" data-t="${k}">${label}</button>`).join('')}</div>
      <div class="crows">${rows}</div>
      <p class="note">🔨 = needs a workbench placed nearby · tap ➕ to wield an item from your hotbar.</p>`;
    p.querySelectorAll('.cat').forEach(b => b.onclick = () => { this.tab = b.dataset.t; this.refresh(inv); });
    p.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => this.craft(+b.dataset.craft));
    p.querySelectorAll('[data-hotbar]').forEach(b => b.onclick = () => {
      inv.setHotbarSlot(inv.sel, +b.dataset.hotbar);
      this.onToast(`⌨️ ${esc(itemDef(+b.dataset.hotbar).name)} → hotbar slot ${inv.sel + 1}`);
    });
  }

  statsLine(it) {
    if (it.kind === 'tool' && it.toolType)
      return `${it.icon} ${it.toolType[0].toUpperCase() + it.toolType.slice(1)} · breaks ${TOOL_BLURB[it.toolType]} ${Math.round((1 - it.timeMultiplier) * 100)}% faster`;
    if (it.kind === 'tool' && it.placesBlock)
      return `${it.icon} Placeable · crafts ${RECIPES_PRODUCES(it)}`;
    if (it.kind === 'weapon')
      return `${it.icon} Damage ${it.damage} · cosmetic for now — no monsters yet`;
    if (it.kind === 'armor')
      return `${it.icon} ${it.slot[0].toUpperCase() + it.slot.slice(1)} · +${it.defense} defense`;
    return it.desc;
  }

  rowHTML(inv, it, nearWB) {
    const craftable = canCraft(inv.counts, it.id, { nearWorkbench: nearWB, unlimited: inv.unlimited });
    const needWB = it.needsWorkbench && !nearWB && !inv.unlimited;
    const iconURL = this.icons.get(it.id);
    const icon = iconURL
      ? `<img src="${esc(iconURL)}" onerror="this.remove()" style="width:30px;height:30px;image-rendering:pixelated" alt="">`
      : `<span style="font-size:22px">${it.icon}</span>`;
    const ings = Object.entries(ITEMS[it.id].recipe).map(([rid, need]) => {
      const have = inv.unlimited ? '∞' : (inv.counts.get(+rid) || 0);
      const ok = inv.unlimited || have >= need;
      return `<span style="color:${ok ? '#8ce99a' : '#ff8787'}">${have}/${need} ${esc(ingredientName(+rid))}</span>`;
    }).join(' · ');
    const owned = inv.unlimited ? '∞' : (inv.counts.get(it.id) || 0);
    const wieldable = !it.placesBlock && (inv.unlimited || owned > 0);
    const outName = it.placesBlock ? blockDef(it.placesBlock).name : it.name;
    return `<div class="crow" style="display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.08)">
      <div class="sw" style="background:${it.color};display:flex;align-items:center;justify-content:center;flex:none">${icon}</div>
      <div style="flex:1;min-width:0">
        <div><b>${esc(it.name)}</b> <small style="opacity:.75">×${owned} owned</small></div>
        <div style="font-size:12px;opacity:.85">${esc(this.statsLine(it))}</div>
        <div style="font-size:12px">${ings}</div>
        ${it.desc ? `<div style="font-size:11px;opacity:.65">${esc(it.desc)}</div>` : ''}
        ${needWB ? `<div style="font-size:12px;color:#ffd94d">🔨 needs a workbench placed nearby</div>` : ''}
        ${it.placesBlock ? `<div style="font-size:11px;opacity:.65">→ crafts ${esc(outName)} block</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="mbtn" data-craft="${it.id}" ${craftable ? '' : 'disabled'} style="${craftable ? '' : 'opacity:.45'}">Craft</button>
        ${wieldable ? `<button class="mbtn" data-hotbar="${it.id}" title="Wield from hotbar slot ${inv.sel + 1}">➕</button>` : ''}
      </div>
    </div>`;
  }

  craft(itemId) {
    const inv = this.inv;
    if (!inv) return;
    const nearWB = this.isWorkbenchNearby();
    const res = craftItem(inv, itemId, { nearWorkbench: nearWB, unlimited: inv.unlimited });
    if (!res.ok) { this.onToast('⚠️ ' + res.reason); return; }
    const label = res.outId >= 100 ? itemDef(res.outId).name : blockDef(res.outId).name;
    this.playSound();
    this.onToast(`🛠️ Crafted ${res.n > 1 ? res.n + '× ' : ''}${label}!`);
    this.onCrafted(itemId);
    this.refresh(inv);
  }
}

// small helper so the stats line reads "crafts 4× Torch"
function RECIPES_PRODUCES(it) {
  const n = it.yield ?? 1;
  return n > 1 ? `${n}× per craft` : '1 per craft';
}
