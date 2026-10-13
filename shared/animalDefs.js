// WonderBlocks animal definitions: pure per-kind data (no three.js).
// Imported by client/js/animals.js for models/behavior and by node tests.
//
// TAMING MODEL (documented choice): THRESHOLD, not per-feed chance.
// Every feeding of the animal's favoriteFood adds +1 trust; the animal is
// tamed when trust >= feedsToTame. A per-feed probability variant was
// considered and rejected — deterministic thresholds are friendlier and
// easier to communicate in the UI ("trust 2/3").
//
// Biome vocabulary (see biomeNameAt() in worldgen.js; 'cave'/'water' are
// derived from block checks rather than biome names):
export const BIOMES = ['forest', 'beach', 'peaks', 'village', 'sky', 'cave', 'water', 'meadow'];

import { F_APPLE, F_CARROT, F_BERRIES, F_SEEDS, F_RAWFISH } from './foods.js';

// favoriteFood: food id from shared/foods.js
// feedsToTame: successful feeds needed to tame
// flags: hop / fly / wings / circle / swim / slow / graze (see animals.js)
// assist: true marks future bodyguard pets — no hostiles exist yet, so this
//   is currently a documented stub (CritterManager.assistTarget).
export const ANIMAL_DEFS = {
  rabbit:    { label: 'Rabbit',    favoriteFood: F_CARROT,  feedsToTame: 2, biomes: ['meadow', 'forest', 'village'], hop: true },
  chicken:   { label: 'Chicken',   favoriteFood: F_SEEDS,   feedsToTame: 2, biomes: ['meadow', 'village'], hop: true },
  butterfly: { label: 'Butterfly', favoriteFood: F_BERRIES, feedsToTame: 2, biomes: ['meadow', 'forest', 'beach'], fly: true, wings: true },
  bird:      { label: 'Bird',      favoriteFood: F_SEEDS,   feedsToTame: 3, biomes: ['forest', 'sky', 'meadow'], fly: true, wings: true, circle: true },
  fish:      { label: 'Fish',      favoriteFood: F_RAWFISH, feedsToTame: 2, biomes: ['water'], swim: true },
  deer:      { label: 'Deer',      favoriteFood: F_APPLE,   feedsToTame: 3, biomes: ['forest', 'meadow'], hop: true, graze: true },
  wolf:      { label: 'Wolf',      favoriteFood: F_RAWFISH, feedsToTame: 3, biomes: ['forest', 'peaks'], hop: true, assist: true },
  bear:      { label: 'Bear',      favoriteFood: F_BERRIES, feedsToTame: 4, biomes: ['forest', 'peaks'], hop: true, slow: true, assist: true },
  fox:       { label: 'Fox',       favoriteFood: F_BERRIES, feedsToTame: 3, biomes: ['forest', 'meadow'], hop: true },
  frog:      { label: 'Frog',      favoriteFood: F_RAWFISH, feedsToTame: 2, biomes: ['water', 'beach', 'meadow'], hop: true, swim: true },
  turtle:    { label: 'Turtle',    favoriteFood: F_CARROT,  feedsToTame: 3, biomes: ['water', 'beach'], swim: true, slow: true },
  bee:       { label: 'Bee',       favoriteFood: F_SEEDS,   feedsToTame: 3, biomes: ['forest', 'meadow', 'village'], fly: true, wings: true },
  sheep:     { label: 'Sheep',     favoriteFood: F_APPLE,   feedsToTame: 3, biomes: ['meadow', 'village'], hop: true, graze: true },
};

// Cute auto-names given on taming (also used by legacy adoptPet).
export const PET_NAMES = {
  rabbit: ['Mochi', 'Pip', 'Clover', 'Bunbun'],
  chicken: ['Nugget', 'Peep', 'Biscuit', 'Sunny-side'],
  butterfly: ['Flutter', 'Petal', 'Glimmer', 'Dottie'],
  bird: ['Sunny', 'Chirpy', 'Skye', 'Tweety'],
  fish: ['Bubbles', 'Splash', 'Ripple', 'Coral'],
  deer: ['Fern', 'Maple', 'Acorn', 'Willow'],
  wolf: ['Ash', 'Luna', 'Scout', 'Shadow'],
  bear: ['Honey', 'Bramble', 'Teddy', 'Maple-syrup'],
  fox: ['Rusty', 'Ember', 'Copper', 'Blaze'],
  frog: ['Hopper', 'Lily', 'Puddle', 'Sprig'],
  turtle: ['Shelly', 'Tilly', 'Pebble', 'Moss'],
  bee: ['Buzzy', 'Daisy', 'Pollen', 'Zippy'],
  sheep: ['Woolly', 'Cotton', 'Fluff', 'Marshmallow'],
};

export function petName(kind) {
  const pool = PET_NAMES[kind] || ['Buddy'];
  return pool[(Math.random() * pool.length) | 0];
}
