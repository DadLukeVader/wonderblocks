// WonderBlocks villager definitions: professions, trades, greetings, appearance.
// Pure ES module — no three.js, safe to import from client code and node tests.
//
// Trade format: { give: {id: n}, get: {id: n} }
// IDs reference shared/items.js (100+), shared/foods.js (130+), shared/blocks.js (0-94).
// Emerald (ITEM 147) is the trading currency.

import { B } from './blocks.js';
import { F_WHEAT, F_CARROT, F_POTATO, F_BREAD, F_RAWFISH, F_COOKEDFISH, F_BAKEDPOTATO, F_APPLE, F_BERRIES } from './foods.js';

// Emerald currency item id (defined in shared/items.js)
export const EMERALD = 147;

export const VILLAGER_PROFESSIONS = {
  farmer: {
    label: 'Farmer',
    // Visual: straw hat (yellow), green apron
    hatColor: 0xe8c95a,
    shirtColor: 0x5aa95a,
    apronColor: 0x7a5a2a,
    trades: [
      { give: { [F_WHEAT]: 8 }, get: { [EMERALD]: 1 }, label: '8 Wheat → 1 Emerald' },
      { give: { [F_CARROT]: 6 }, get: { [EMERALD]: 1 }, label: '6 Carrots → 1 Emerald' },
      { give: { [F_POTATO]: 6 }, get: { [EMERALD]: 1 }, label: '6 Potatoes → 1 Emerald' },
      { give: { [EMERALD]: 2 }, get: { [F_BREAD]: 3 }, label: '2 Emeralds → 3 Bread' },
    ],
  },
  blacksmith: {
    label: 'Blacksmith',
    // Visual: dark apron, gray cap
    hatColor: 0x4a4a4a,
    shirtColor: 0x8a6a4a,
    apronColor: 0x3a3a3a,
    trades: [
      { give: { [B.STONE]: 16 }, get: { [EMERALD]: 1 }, label: '16 Stone → 1 Emerald' },
      { give: { [B.GOLD]: 4 }, get: { [EMERALD]: 3 }, label: '4 Gold Ore → 3 Emeralds' },
      { give: { [B.IRON_BLOCK]: 2 }, get: { [EMERALD]: 2 }, label: '2 Iron Blocks → 2 Emeralds' },
      { give: { [EMERALD]: 5 }, get: { 101: 1 }, label: '5 Emeralds → Stone Pickaxe' },
    ],
  },
  butcher: {
    label: 'Butcher',
    // Visual: white apron, red shirt
    hatColor: 0xffffff,
    shirtColor: 0xc05a5a,
    apronColor: 0xf0f0f0,
    trades: [
      { give: { [F_RAWFISH]: 4 }, get: { [EMERALD]: 1 }, label: '4 Raw Fish → 1 Emerald' },
      { give: { [F_APPLE]: 6 }, get: { [EMERALD]: 1 }, label: '6 Apples → 1 Emerald' },
      { give: { [F_BERRIES]: 8 }, get: { [EMERALD]: 1 }, label: '8 Berries → 1 Emerald' },
      { give: { [EMERALD]: 2 }, get: { [F_COOKEDFISH]: 2 }, label: '2 Emeralds → 2 Cooked Fish' },
    ],
  },
};

export const VILLAGER_GREETINGS = [
  'Hello, traveler! Care to trade?',
  'Fine day for trading, eh?',
  'I\'ve got wares if you\'ve got emeralds!',
  'Welcome to Wonder Village!',
  'Psst… I give better deals to my friends.',
  'Back again? Let\'s do business!',
];

// Reputation: +1 per successful trade. At 10+, 10% discount on emerald costs.
export const REP_DISCOUNT_THRESHOLD = 10;
export const REP_DISCOUNT_RATE = 0.1;

// Apply reputation discount to a trade's emerald cost (rounds up, min 1)
export function applyRepDiscount(trade, reputation) {
  if (reputation < REP_DISCOUNT_THRESHOLD) return trade;
  const out = { give: { ...trade.give }, get: { ...trade.get }, label: trade.label };
  if (out.give[EMERALD]) {
    out.give[EMERALD] = Math.max(1, Math.ceil(out.give[EMERALD] * (1 - REP_DISCOUNT_RATE)));
  }
  return out;
}
