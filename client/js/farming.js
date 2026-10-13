// WonderBlocks farming system (Phase 4): crop growth over time.
//
// Crops are planted on tilled soil and advance through 4 stages (~30s each).
// Growth is client-side; stage changes go through game.applyEdit so they sync
// in multiplayer. Crop tracking is not persisted across reloads (acceptable).

import { B } from 'wb-shared/blocks.js?v=19';

export const CROPS = {
  wheat:  { stages: [B.WHEAT_0, B.WHEAT_1, B.WHEAT_2, B.WHEAT_3], seed: 133, name: 'Wheat' },
  carrot: { stages: [B.CARROT_0, B.CARROT_1, B.CARROT_2, B.CARROT_3], seed: 131, name: 'Carrot' },
  potato: { stages: [B.POTATO_0, B.POTATO_1, B.POTATO_2, B.POTATO_3], seed: 143, name: 'Potato' },
};

const STAGE_IDS = new Map();
for (const [crop, def] of Object.entries(CROPS))
  for (let s = 0; s < def.stages.length; s++) STAGE_IDS.set(def.stages[s], { crop, stage: s });

export const STAGE_TIME = 30; // seconds per growth stage

export class FarmingSystem {
  constructor(game) {
    this.game = game;
    this.crops = new Map(); // "x,y,z" -> { x, y, z, crop, stage, t }
    this._tick = 0;
  }

  plant(x, y, z, crop) {
    const def = CROPS[crop];
    if (!def) return false;
    if (!this.game.applyEdit(x, y, z, def.stages[0])) return false;
    this.crops.set(`${x},${y},${z}`, { x, y, z, crop, stage: 0, t: 0 });
    return true;
  }

  // Called when any block is broken — drop crop tracking if it was a crop.
  onBreak(x, y, z) {
    this.crops.delete(`${x},${y},${z}`);
  }

  update(dt) {
    this._tick += dt;
    if (this._tick < 1) return;
    this._tick = 0;
    const world = this.game.world;
    for (const [key, c] of this.crops) {
      // Crop needs tilled soil below; otherwise it pops off.
      if (world.get(c.x, c.y - 1, c.z) !== B.TILLED_SOIL) {
        this.crops.delete(key);
        this.game.applyEdit(c.x, c.y, c.z, B.AIR);
        continue;
      }
      if (c.stage >= 3) continue;
      c.t += 1;
      if (c.t >= STAGE_TIME) {
        c.t = 0;
        c.stage += 1;
        this.game.applyEdit(c.x, c.y, c.z, CROPS[c.crop].stages[c.stage]);
      }
    }
  }
}
