// WonderBlocks fishing system (Phase 4): cast near water, wait, catch.
//
// Right-click with the fishing rod selected casts a line if water is within a
// 5-block radius. After a 5-15s random delay a fish is caught. Switching away
// from the rod cancels the cast. Client-side only.

import { B } from 'wb-shared/blocks.js?v=19';
import { foodDef } from 'wb-shared/foods.js?v=19';

const CATCH_TABLE = [
  [0.60, 134], // raw fish
  [0.90, 135], // raw salmon
  [1.01, 136], // pufferfish
];

export class FishingSystem {
  constructor(game) {
    this.game = game;
    this.fishing = false;
    this._t = 0;
    this._wait = 0;
  }

  cast() {
    if (this.fishing) return;
    const p = this.game.player.pos;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    let found = false;
    outer:
    for (let dx = -5; dx <= 5; dx++)
      for (let dy = -3; dy <= 2; dy++)
        for (let dz = -5; dz <= 5; dz++)
          if (this.game.world.get(px + dx, py + dy, pz + dz) === B.WATER) { found = true; break outer; }
    if (!found) {
      this.game.ui.toast('🎣 No water nearby! Find a lake, river, or ocean.');
      return;
    }
    this.fishing = true;
    this._t = 0;
    this._wait = 5 + Math.random() * 10;
    this.game.ui.toast('🎣 Line cast! Wait for a bite…');
    this.game.audio.pop();
  }

  update(_dt) {
    if (!this.fishing) return;
    // Switching items cancels the cast.
    if (this.game.inv.selectedBlock() !== 145) {
      this.fishing = false;
      return;
    }
    this._t += _dt;
    if (this._t < this._wait) return;
    this.fishing = false;
    const r = Math.random();
    let id = 134;
    for (const [limit, fid] of CATCH_TABLE) if (r < limit) { id = fid; break; }
    this.game.inv.add(id, 1);
    const f = foodDef(id);
    this.game.ui.toast(`🐟 Caught ${f.icon} ${f.name}!`);
    this.game.audio.pickup();
    this.game.player.swing();
  }
}
