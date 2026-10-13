// WonderBlocks quests: optional challenges with XP/coin rewards.
import { B } from 'wb-shared/blocks.js?v=23';

export const QUESTS = [
  { id: 'wood20', text: 'Collect 20 Wood', target: 20, ev: 'break', match: B.WOOD, reward: { coins: 15, xp: 20 } },
  { id: 'stone15', text: 'Collect 15 Stone', target: 15, ev: 'break', match: B.STONE, reward: { coins: 15, xp: 20 } },
  { id: 'flowers10', text: 'Plant 10 Flowers', target: 10, ev: 'plant', match: 'flower', reward: { coins: 20, xp: 25 } },
  { id: 'house', text: 'Build a house: place 1 Door + 4 Windows', target: 5, ev: 'house', reward: { coins: 40, xp: 50 } },
  { id: 'builder30', text: 'Place 30 blocks', target: 30, ev: 'place', reward: { coins: 20, xp: 30 } },
  { id: 'cave', text: 'Discover a hidden cave (dive below the surface)', target: 1, ev: 'depth', reward: { coins: 25, xp: 30 } },
  { id: 'rainbow12', text: 'Build with 12 Rainbow Blocks', target: 12, ev: 'place', match: B.RAINBOW, reward: { coins: 35, xp: 40 } },
  { id: 'crystal5', text: 'Collect 5 Crystals', target: 5, ev: 'break', match: B.CRYSTAL, reward: { coins: 30, xp: 40 } },
];

const FLOWERS = new Set([B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE]);

export class QuestManager {
  constructor() {
    this.progress = {};   // id -> count
    this.done = {};       // id -> true
    this.coins = 0;
    this.xp = 0;
    this.onUpdate = null;
    this.onReward = null;
  }
  handle(ev, data) {
    let changed = false;
    for (const q of QUESTS) {
      if (this.done[q.id] || q.ev !== ev) continue;
      let n = 0;
      if (q.match === undefined) n = 1;
      else if (q.match === 'flower' && FLOWERS.has(data)) n = 1;
      else if (data === q.match) n = 1;
      else if (q.id === 'house') n = (data === B.DOOR || data === B.WINDOW) ? 1 : 0;
      if (!n) continue;
      this.progress[q.id] = Math.min(q.target, (this.progress[q.id] || 0) + n);
      changed = true;
      if (this.progress[q.id] >= q.target) {
        this.done[q.id] = true;
        this.coins += q.reward.coins;
        this.xp += q.reward.xp;
        this.onReward && this.onReward(q);
      }
    }
    if (changed) this.onUpdate && this.onUpdate();
  }
  activeQuests() { return QUESTS.filter(q => !this.done[q.id]).slice(0, 3); }
  serialize() { return { progress: this.progress, done: this.done, coins: this.coins, xp: this.xp }; }
  deserialize(s) {
    if (!s) return;
    this.progress = s.progress || {}; this.done = s.done || {};
    this.coins = s.coins || 0; this.xp = s.xp || 0;
    this.onUpdate && this.onUpdate();
  }
}
