// WonderBlocks shared item registry: craftable tools, weapons and armor.
//
// Item ids 100-129 (blocks are 0-40; food items 130-139 belong to another agent).
// Torch (108) and Workbench (109) are "utility items": crafting them yields the
// placeable blocks B.TORCH (39) / B.WORKBENCH (40) instead of an inventory item.
//
// Pure ES module: no DOM, no three.js — safe to import on client and server.
// RECIPES is DERIVED from ITEMS (single source of truth): each ITEMS entry
// carries `recipe` (ingredients), optional `yield` (default 1), optional
// `placesBlock` (crafting yields a block id instead of the item), and optional
// `needsWorkbench` (a placed workbench must be nearby to craft).

import { B, blockDef } from './blocks.js';

// worksOn block sets, shared by tier (pickaxe / axe / shovel).
const ORE_LIKE = [B.STONE, B.CLAY, B.BRICK_RED, B.BRICK_SKY, B.BRICK_LEMON, B.BRICK_ROSE,
  B.GLASS, B.CRYSTAL, B.GOLD, B.ICE, B.STONE_BRICK, B.SNOW_BLOCK];
const WOOD_LIKE = [B.WOOD, B.PALM_WOOD, B.PLANKS, B.DOOR, B.BOOKSHELF, B.FENCE];
const DIRT_LIKE = [B.GRASS, B.DIRT, B.SAND, B.SNOW, B.CLAY, B.SNOW_BLOCK];

export const ITEMS = {
  // ---------------- tools & utilities (100-109) ----------------
  100: { name: 'Wooden Pickaxe', kind: 'tool', tier: 'wood', toolType: 'pickaxe',
    timeMultiplier: 0.7, worksOn: ORE_LIKE, recipe: { [B.WOOD]: 3, [B.PLANKS]: 2 },
    icon: '⛏️', color: '#a4713f', desc: 'Breaks stone-like blocks 30% faster.' },
  101: { name: 'Stone Pickaxe', kind: 'tool', tier: 'stone', toolType: 'pickaxe',
    timeMultiplier: 0.55, worksOn: ORE_LIKE, recipe: { [B.STONE]: 3, [B.WOOD]: 2 },
    icon: '⛏️', color: '#9aa0a8', desc: 'Breaks stone-like blocks 45% faster.' },
  102: { name: 'Gold Pickaxe', kind: 'tool', tier: 'gold', toolType: 'pickaxe',
    timeMultiplier: 0.4, worksOn: ORE_LIKE, recipe: { [B.GOLD]: 3, [B.WOOD]: 2 },
    needsWorkbench: true, icon: '⛏️', color: '#f5c542', desc: 'Breaks stone-like blocks 60% faster.' },
  103: { name: 'Crystal Pickaxe', kind: 'tool', tier: 'crystal', toolType: 'pickaxe',
    timeMultiplier: 0.25, worksOn: ORE_LIKE, recipe: { [B.CRYSTAL]: 3, [B.GOLD]: 2 },
    needsWorkbench: true, icon: '⛏️', color: '#9d7bff', desc: 'Breaks stone-like blocks 75% faster.' },
  104: { name: 'Wooden Axe', kind: 'tool', tier: 'wood', toolType: 'axe',
    timeMultiplier: 0.7, worksOn: WOOD_LIKE, recipe: { [B.WOOD]: 3, [B.PLANKS]: 2 },
    icon: '🪓', color: '#a4713f', desc: 'Chops wood-like blocks 30% faster.' },
  105: { name: 'Stone Axe', kind: 'tool', tier: 'stone', toolType: 'axe',
    timeMultiplier: 0.55, worksOn: WOOD_LIKE, recipe: { [B.STONE]: 3, [B.WOOD]: 2 },
    icon: '🪓', color: '#9aa0a8', desc: 'Chops wood-like blocks 45% faster.' },
  106: { name: 'Wooden Shovel', kind: 'tool', tier: 'wood', toolType: 'shovel',
    timeMultiplier: 0.7, worksOn: DIRT_LIKE, recipe: { [B.WOOD]: 2, [B.PLANKS]: 1 },
    icon: '⛏️', color: '#c78f4f', desc: 'Digs dirt-like blocks 30% faster. (Art: rounded spade.)' },
  107: { name: 'Stone Shovel', kind: 'tool', tier: 'stone', toolType: 'shovel',
    timeMultiplier: 0.55, worksOn: DIRT_LIKE, recipe: { [B.STONE]: 2, [B.WOOD]: 1 },
    icon: '⛏️', color: '#8f959e', desc: 'Digs dirt-like blocks 45% faster. (Art: rounded spade.)' },
  108: { name: 'Torch', kind: 'tool', tier: 'wood', placesBlock: 39, // 39 = B.TORCH (added to blocks.js)
    recipe: { [B.PLANKS]: 1, [B.GLOW]: 1 }, yield: 4,
    icon: '🔥', color: '#ffb84d', desc: 'Placeable light. Crafts 4 at a time.' },
  109: { name: 'Workbench', kind: 'tool', tier: 'wood', placesBlock: 40, // 40 = B.WORKBENCH (added to blocks.js)
    recipe: { [B.PLANKS]: 4, [B.WOOD]: 2 },
    icon: '🛠️', color: '#d9a05e', desc: 'Place nearby to unlock gold & crystal recipes.' },

  // ---------------- weapons (110-119) ----------------
  // NOTE: no hostiles exist in WonderBlocks yet, so damage is data + UI only.
  110: { name: 'Wooden Sword', kind: 'weapon', tier: 'wood', damage: 3,
    recipe: { [B.WOOD]: 2, [B.PLANKS]: 1 },
    icon: '🗡️', color: '#a4713f', desc: 'A trusty starter blade.' },
  111: { name: 'Stone Sword', kind: 'weapon', tier: 'stone', damage: 5,
    recipe: { [B.STONE]: 2, [B.WOOD]: 1 },
    icon: '🗡️', color: '#9aa0a8', desc: 'Heavier swing, bigger numbers.' },
  112: { name: 'Gold Sword', kind: 'weapon', tier: 'gold', damage: 7,
    recipe: { [B.GOLD]: 2, [B.WOOD]: 1 }, needsWorkbench: true,
    icon: '🗡️', color: '#f5c542', desc: 'Shiny and surprisingly hurty.' },
  113: { name: 'Crystal Sword', kind: 'weapon', tier: 'crystal', damage: 10,
    recipe: { [B.CRYSTAL]: 2, [B.GOLD]: 1 }, needsWorkbench: true,
    icon: '🗡️', color: '#9d7bff', desc: 'Hums with pastel power.' },
  114: { name: 'Wooden Bow', kind: 'weapon', tier: 'wood', damage: 2,
    recipe: { [B.WOOD]: 3, [B.LEAVES]: 1 },
    icon: '🏹', color: '#a4713f', desc: 'Ranged style. (Arrows sold separately: nowhere.)' },
  115: { name: 'Stone Spear', kind: 'weapon', tier: 'stone', damage: 6,
    recipe: { [B.STONE]: 1, [B.WOOD]: 2 },
    icon: '🔱', color: '#9aa0a8', desc: 'Pokey. Great reach, in theory.' },
  116: { name: 'Golden Hammer', kind: 'weapon', tier: 'gold', damage: 8,
    recipe: { [B.GOLD]: 3, [B.WOOD]: 2 }, needsWorkbench: true,
    icon: '🔨', color: '#f5c542', desc: 'Bonk, but make it fashion.' },
  117: { name: 'Crystal Dagger', kind: 'weapon', tier: 'crystal', damage: 9,
    recipe: { [B.CRYSTAL]: 1, [B.GOLD]: 1 }, needsWorkbench: true,
    icon: '🗡️', color: '#b197fc', desc: 'Tiny, sparkly, alarming.' },
  118: { name: 'Wooden Mallet', kind: 'weapon', tier: 'wood', damage: 4,
    recipe: { [B.WOOD]: 2, [B.PLANKS]: 2 },
    icon: '🔨', color: '#c78f4f', desc: 'For whacking… tent pegs.' },
  119: { name: 'Slingshot', kind: 'weapon', tier: 'wood', damage: 2,
    recipe: { [B.WOOD]: 1, [B.LEAVES]: 1 },
    icon: '🎯', color: '#8a5a32', desc: 'Pebble-flinger. Target practice only.' },

  // ---------------- armor (120-129) ----------------
  // Defense is display-only for now (no combat); shown in the Gear panel.
  120: { name: 'Wooden Cap', kind: 'armor', slot: 'head', tier: 'wood', defense: 1,
    recipe: { [B.WOOD]: 4 },
    icon: '🪖', color: '#a4713f', desc: 'Better than nothing. Slightly.' },
  121: { name: 'Wooden Tunic', kind: 'armor', slot: 'chest', tier: 'wood', defense: 2,
    recipe: { [B.PLANKS]: 5 },
    icon: '🦺', color: '#d9a05e', desc: 'Rustic chic.' },
  122: { name: 'Wooden Boots', kind: 'armor', slot: 'feet', tier: 'wood', defense: 1,
    recipe: { [B.WOOD]: 2, [B.PLANKS]: 2 },
    icon: '🥾', color: '#8a5a32', desc: 'Clomp clomp.' },
  123: { name: 'Stone Helm', kind: 'armor', slot: 'head', tier: 'stone', defense: 2,
    recipe: { [B.STONE]: 4, [B.WOOD]: 1 },
    icon: '🪖', color: '#9aa0a8', desc: 'Heavy thoughts protector.' },
  124: { name: 'Stone Chestplate', kind: 'armor', slot: 'chest', tier: 'stone', defense: 4,
    recipe: { [B.STONE]: 6 },
    icon: '🦺', color: '#b9b9c4', desc: 'Doubles as a garden wall.' },
  125: { name: 'Stone Boots', kind: 'armor', slot: 'feet', tier: 'stone', defense: 2,
    recipe: { [B.STONE]: 3, [B.WOOD]: 1 },
    icon: '🥾', color: '#8f959e', desc: 'Built like a curb.' },
  126: { name: 'Golden Crown', kind: 'armor', slot: 'head', tier: 'gold', defense: 3,
    recipe: { [B.GOLD]: 3, [B.GLOW]: 1 }, needsWorkbench: true,
    icon: '👑', color: '#f5c542', desc: 'Royalty-grade headgear.' },
  127: { name: 'Golden Chestplate', kind: 'armor', slot: 'chest', tier: 'gold', defense: 6,
    recipe: { [B.GOLD]: 5 }, needsWorkbench: true,
    icon: '🦺', color: '#ffd94d', desc: 'Blindingly protective.' },
  128: { name: 'Crystal Helm', kind: 'armor', slot: 'head', tier: 'crystal', defense: 5,
    recipe: { [B.CRYSTAL]: 3, [B.GOLD]: 1 }, needsWorkbench: true,
    icon: '🪖', color: '#9d7bff', desc: 'Sees the future. Probably.' },
  129: { name: 'Crystal Boots', kind: 'armor', slot: 'feet', tier: 'crystal', defense: 4,
    recipe: { [B.CRYSTAL]: 2, [B.GOLD]: 2 }, needsWorkbench: true,
    icon: '🥾', color: '#b197fc', desc: 'Floaty steps, sparkly toes.' },
};

// stamp numeric ids onto entries for convenient iteration
for (const [id, it] of Object.entries(ITEMS)) it.id = +id;

// RECIPES derived from ITEMS (documented single source of truth).
// { [itemId]: { produces, block (placeable block id or null), needsWorkbench, ingredients } }
export const RECIPES = {};
for (const [id, it] of Object.entries(ITEMS)) {
  RECIPES[id] = {
    produces: it.yield ?? 1,
    block: it.placesBlock ?? null,
    needsWorkbench: !!it.needsWorkbench,
    ingredients: { ...it.recipe },
  };
}

export const ITEM_CATS = [
  ['tool', '🛠️ Tools'],
  ['weapon', '⚔️ Weapons'],
  ['armor', '🛡️ Armor'],
];

export function itemDef(id) { return ITEMS[id] || null; }
// ids >= 100 are items (blocks are 0-40); covers future food items 130+ too.
export function isItem(id) { return Number.isInteger(id) && id >= 100; }

// invCounts: Map or plain object id->count.
export function canCraft(invCounts, itemId, opts = {}) {
  const r = RECIPES[itemId];
  if (!r) return false;
  if (r.needsWorkbench && !opts.nearWorkbench && !opts.unlimited) return false;
  if (opts.unlimited) return true;
  const get = invCounts instanceof Map
    ? id => invCounts.get(id) || 0
    : id => invCounts[id] || 0;
  return Object.entries(r.ingredients).every(([id, n]) => get(+id) >= n);
}

// Perform the craft against an Inventory-like ({remove, add, unlimited}).
// Returns {ok, outId, n} or {ok:false, reason}.
export function craftItem(inv, itemId, opts = {}) {
  const r = RECIPES[itemId];
  if (!r) return { ok: false, reason: 'Unknown recipe.' };
  if (r.needsWorkbench && !opts.nearWorkbench && !opts.unlimited)
    return { ok: false, reason: 'Place a workbench nearby first.' };
  if (!opts.unlimited) {
    for (const [id, n] of Object.entries(r.ingredients)) {
      if (!inv.remove(+id, n)) return { ok: false, reason: 'Missing ingredients.' };
    }
  }
  const outId = r.block ?? itemId;
  inv.add(outId, r.produces);
  return { ok: true, outId, n: r.produces };
}

// Break-time multiplier for the wielded item against a block id.
// 1 = no bonus (bare hands, wrong tool, weapon, armor, torch…).
export function toolTimeMultiplier(selectedId, blockId) {
  const def = itemDef(selectedId);
  if (!def || def.kind !== 'tool' || !def.toolType || !def.timeMultiplier) return 1;
  return (def.worksOn || []).includes(blockId) ? def.timeMultiplier : 1;
}

export function totalDefense(equipment) {
  let d = 0;
  for (const slot of ['head', 'chest', 'feet']) {
    const def = itemDef(equipment?.[slot]);
    if (def && def.kind === 'armor' && def.slot === slot) d += def.defense || 0;
  }
  return d;
}

// Display name for an ingredient id (item or block).
export function ingredientName(id) {
  const it = itemDef(id);
  return it ? it.name : blockDef(id).name;
}
