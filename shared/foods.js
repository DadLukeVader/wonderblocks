// WonderBlocks food items: taming currency for the animals subsystem.
// Pure ES module — no three.js, safe to import from client code and node tests.
//
// ID allocation: 130-143 are FOOD items (130-134 animals subsystem, 135-139 & 142-143 Phase 4
// farming/fishing/cooking; 140-141 reserved by items.js pet accessories).
// 100-129 are tools/weapons/armor — do not use.
import { B } from './blocks.js';

export const F_APPLE = 130;
export const F_CARROT = 131;
export const F_BERRIES = 132;
export const F_SEEDS = 133;
export const F_RAWFISH = 134;
// Phase 4 additions
export const F_RAWSALMON = 135;
export const F_PUFFERFISH = 136;
export const F_COOKEDFISH = 137;
export const F_BAKEDPOTATO = 138;
export const F_BREAD = 139;
export const F_WHEAT = 142;
export const F_POTATO = 143;

export const FOODS = {
  [F_APPLE]: { name: 'Apple', icon: '🍎', color: '#ff5a5a', desc: 'Crisp red apple. Shake leafy trees for more.' },
  [F_CARROT]: { name: 'Carrot', icon: '🥕', color: '#ff922b', desc: 'Crunchy garden carrot. Rarely pops out of tall grass.' },
  [F_BERRIES]: { name: 'Berries', icon: '🫐', color: '#7b6fd6', desc: 'Sweet wild berries. Break berry bushes to gather.' },
  [F_SEEDS]: { name: 'Seeds', icon: '🌾', color: '#e8c95a', desc: 'Handful of seeds. Falls from tall grass. Plant on tilled soil!' },
  [F_RAWFISH]: { name: 'Raw Fish', icon: '🐟', color: '#74c0fc', desc: 'Fresh-caught fish. Smelt it in a furnace!' },
  [F_RAWSALMON]: { name: 'Raw Salmon', icon: '🍣', color: '#ff8a7a', desc: 'A prize catch. Smelt it in a furnace!' },
  [F_PUFFERFISH]: { name: 'Pufferfish', icon: '🐡', color: '#ffd94d', desc: 'Spiky little fellow. Barely edible.' },
  [F_COOKEDFISH]: { name: 'Cooked Fish', icon: '🍳', color: '#ffb84d', desc: 'Hot and delicious. Restores lots of hunger.' },
  [F_BAKEDPOTATO]: { name: 'Baked Potato', icon: '🥔', color: '#e8a83c', desc: 'Crispy outside, fluffy inside.' },
  [F_BREAD]: { name: 'Bread', icon: '🍞', color: '#d9a05e', desc: 'Fresh from the furnace. Smelt 3 wheat to bake.' },
  [F_WHEAT]: { name: 'Wheat', icon: '🌾', color: '#e8c95a', desc: 'Golden wheat. Smelt 3 into bread.' },
  [F_POTATO]: { name: 'Potato', icon: '🥔', color: '#c9a06a', desc: 'Raw potato. Smelt it for a baked potato.' },
};

// Hunger restored when eaten (player.eat). Raw = 1-2, cooked = 6.
export const FOOD_VALUES = {
  [F_APPLE]: 4, [F_CARROT]: 3, [F_BERRIES]: 2, [F_SEEDS]: 1,
  [F_RAWFISH]: 2, [F_RAWSALMON]: 2, [F_PUFFERFISH]: 1,
  [F_COOKEDFISH]: 6, [F_BAKEDPOTATO]: 6, [F_BREAD]: 6,
  [F_WHEAT]: 1, [F_POTATO]: 2,
};

// Furnace smelting: input food id -> { out, n } (n = inputs consumed per smelt).
export const SMELT_RECIPES = {
  [F_RAWFISH]: { out: F_COOKEDFISH, n: 1 },
  [F_RAWSALMON]: { out: F_COOKEDFISH, n: 1 },
  [F_POTATO]: { out: F_BAKEDPOTATO, n: 1 },
  [F_WHEAT]: { out: F_BREAD, n: 3 },
};

// Block ids usable as furnace fuel, with smelts granted per unit.
export const FUEL_IDS = { [B.WOOD]: 2, [B.PLANKS]: 1 };

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
  // Phase 4: mature crop harvests (immature stages drop seeds via block drop).
  [B.WHEAT_3]: [
    { food: F_WHEAT, chance: 1.0, n: 1 },
    { food: F_SEEDS, chance: 0.6, n: 2 },
  ],
  [B.CARROT_3]: [{ food: F_CARROT, chance: 1.0, n: 2 }],
  [B.POTATO_3]: [{ food: F_POTATO, chance: 1.0, n: 2 }],
};
