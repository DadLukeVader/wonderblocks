// WonderBlocks food items: taming currency for the animals subsystem.
// Pure ES module — no three.js, safe to import from client code and node tests.
//
// ID allocation: 130-139 are FOOD items (owned by the animals subsystem).
// 100-129 are tools/weapons/armor (owned by another subsystem) — do not use.
import { B } from './blocks.js';

export const F_APPLE = 130;
export const F_CARROT = 131;
export const F_BERRIES = 132;
export const F_SEEDS = 133;
export const F_RAWFISH = 134;

export const FOODS = {
  [F_APPLE]: { name: 'Apple', icon: '🍎', color: '#ff5a5a', desc: 'Crisp red apple. Shake leafy trees for more.' },
  [F_CARROT]: { name: 'Carrot', icon: '🥕', color: '#ff922b', desc: 'Crunchy garden carrot. Rarely pops out of tall grass.' },
  [F_BERRIES]: { name: 'Berries', icon: '🫐', color: '#7b6fd6', desc: 'Sweet wild berries. Break berry bushes to gather.' },
  [F_SEEDS]: { name: 'Seeds', icon: '🌾', color: '#e8c95a', desc: 'Handful of seeds. Falls from tall grass.' },
  [F_RAWFISH]: { name: 'Raw Fish', icon: '🐟', color: '#74c0fc', desc: 'Fresh-caught fish. (Fish it out of the water for now!)' },
};

export function foodDef(id) { return FOODS[id] || null; }
export function isFood(id) { return Object.prototype.hasOwnProperty.call(FOODS, id); }

// Bonus drops applied by main.js breakBlock() on top of the block's normal drop.
// { [blockId]: [{ food, chance, n }] } — chance is per-block-break probability.
export const FOOD_DROPS = {
  [B.LEAVES]: [{ food: F_APPLE, chance: 0.12, n: 1 }],
  [B.PALM_LEAVES]: [{ food: F_APPLE, chance: 0.12, n: 1 }],
  [B.BERRY_BUSH]: [{ food: F_BERRIES, chance: 1.0, n: 2 }],
  [B.TALL_GRASS]: [
    { food: F_SEEDS, chance: 0.25, n: 1 },
    { food: F_CARROT, chance: 0.04, n: 1 },
  ],
};
