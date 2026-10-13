// WonderBlocks monster definitions: hostile creatures (original designs).
// Pure data — imported by client/js/monsters.js and node tests.

export const MONSTER_DEFS = {
  gloomling: {
    label: 'Gloomling', health: 10, damage: 2, speed: 3.2,
    spawnBiomes: ['forest', 'meadow', 'village'], nightOnly: true,
    drops: [{ item: 'coal', chance: 0.5 }, { item: 'bone', chance: 0.3 }],
    xp: 5, color: 0x3a3a5a,
  },
  mossjaw: {
    label: 'Mossjaw', health: 20, damage: 4, speed: 2.5,
    spawnBiomes: ['cave'], nightOnly: false,
    drops: [{ item: 'iron', chance: 0.4 }, { item: 'moss', chance: 0.6 }],
    xp: 10, color: 0x4a6a3a,
  },
  sparkbat: {
    label: 'Sparkbat', health: 6, damage: 1, speed: 5.0,
    spawnBiomes: ['forest', 'peaks', 'cave'], nightOnly: true, fly: true,
    drops: [{ item: 'feather', chance: 0.5 }],
    xp: 3, color: 0x6a5a8a,
  },
  gloomlord: {
    label: 'Gloomlord', health: 100, damage: 8, speed: 4.0,
    spawnBiomes: ['forest'], nightOnly: true, boss: true, rare: true,
    drops: [{ item: 'diamond', chance: 1.0 }, { item: 'gold', chance: 1.0 }],
    xp: 50, color: 0x2a1a3a, scale: 2.5,
  },
};
