// WonderBlocks shared block registry (used by client + server).
// tile: index into the 8x8 texture atlas (see client/js/textures.js)

export const B = {
  AIR: 0,
  GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6, SNOW: 7,
  CLAY: 8, WATER: 9, PLANKS: 10, BRICK_RED: 11, BRICK_SKY: 12,
  BRICK_LEMON: 13, BRICK_ROSE: 14, GLASS: 15, ROOF: 16, GLOW: 17,
  FLOWER_RED: 18, FLOWER_YELLOW: 19, FLOWER_BLUE: 20, LANTERN: 21,
  CRYSTAL: 22, RAINBOW: 23, GOLD: 24, ICE: 25, CLOUD: 26,
  PALM_WOOD: 27, PALM_LEAVES: 28, BERRY_BUSH: 29, TALL_GRASS: 30,
  DOOR: 31, WINDOW: 32, STONE_BRICK: 33, SNOW_BLOCK: 34, BEDROCK: 35,
  BOOKSHELF: 36, FENCE: 37, CLAIM_FLAG: 38, TORCH: 39, WORKBENCH: 40,
};

const D = (name, cat, tiles, opts = {}) => ({
  name, cat,
  tiles: typeof tiles === 'number' ? { top: tiles, side: tiles, bottom: tiles } : tiles,
  solid: opts.solid !== false,
  liquid: !!opts.liquid,
  cross: !!opts.cross,            // rendered as two diagonal quads (flowers, grass tufts)
  opaque: opts.opaque !== false,  // hides neighbor faces
  selectable: opts.selectable !== false,
  unbreakable: !!opts.unbreakable,
  hardness: opts.hardness ?? 0.6, // seconds to break
  drop: opts.drop,                // item id granted (default: self)
  glow: !!opts.glow,
});

export const BLOCKS = {
  [B.AIR]: D('Air', 'natural', 0, { solid: false, selectable: false, opaque: false }),
  [B.GRASS]: D('Grass', 'natural', { top: 0, side: 1, bottom: 2 }, { hardness: 0.45, drop: B.DIRT }),
  [B.DIRT]: D('Dirt', 'natural', 2, { hardness: 0.4 }),
  [B.STONE]: D('Stone', 'natural', 3, { hardness: 1.1 }),
  [B.SAND]: D('Sand', 'natural', 4, { hardness: 0.4 }),
  [B.WOOD]: D('Wood', 'natural', { top: 6, side: 5, bottom: 6 }, { hardness: 0.7 }),
  [B.LEAVES]: D('Leaves', 'natural', 7, { hardness: 0.25, opaque: false }),
  [B.SNOW]: D('Snowy Grass', 'natural', { top: 8, side: 9, bottom: 2 }, { hardness: 0.45, drop: B.DIRT }),
  [B.CLAY]: D('Clay', 'natural', 10, { hardness: 0.6 }),
  [B.WATER]: D('Water', 'natural', 11, { solid: false, liquid: true, opaque: false, hardness: 0.1 }),
  [B.PLANKS]: D('Planks', 'building', 12, { hardness: 0.7 }),
  [B.BRICK_RED]: D('Red Bricks', 'building', 13, { hardness: 1.0 }),
  [B.BRICK_SKY]: D('Sky Bricks', 'building', 14, { hardness: 1.0 }),
  [B.BRICK_LEMON]: D('Lemon Bricks', 'building', 30, { hardness: 1.0 }),
  [B.BRICK_ROSE]: D('Rose Bricks', 'building', 31, { hardness: 1.0 }),
  [B.GLASS]: D('Glass', 'building', 15, { hardness: 0.3, opaque: false }),
  [B.ROOF]: D('Roof Tiles', 'building', 16, { hardness: 0.8 }),
  [B.GLOW]: D('Glow Block', 'special', 17, { hardness: 0.5, glow: true }),
  [B.FLOWER_RED]: D('Red Flower', 'decor', 18, { solid: false, cross: true, opaque: false, hardness: 0.1 }),
  [B.FLOWER_YELLOW]: D('Yellow Flower', 'decor', 19, { solid: false, cross: true, opaque: false, hardness: 0.1 }),
  [B.FLOWER_BLUE]: D('Blue Flower', 'decor', 20, { solid: false, cross: true, opaque: false, hardness: 0.1 }),
  [B.LANTERN]: D('Lantern', 'decor', 21, { solid: false, cross: true, opaque: false, hardness: 0.3, glow: true }),
  [B.CRYSTAL]: D('Crystal', 'special', 22, { solid: false, cross: true, opaque: false, hardness: 1.4, glow: true }),
  [B.RAINBOW]: D('Rainbow Block', 'special', 23, { hardness: 0.8 }),
  [B.GOLD]: D('Gold Block', 'special', 24, { hardness: 1.2 }),
  [B.ICE]: D('Ice', 'natural', 25, { hardness: 0.6, opaque: false }),
  [B.CLOUD]: D('Cloud', 'building', 26, { hardness: 0.4, opaque: false }),
  [B.PALM_WOOD]: D('Palm Wood', 'natural', { top: 6, side: 27, bottom: 6 }, { hardness: 0.7 }),
  [B.PALM_LEAVES]: D('Palm Leaves', 'natural', 28, { hardness: 0.25, opaque: false }),
  [B.BERRY_BUSH]: D('Berry Leaves', 'natural', 29, { hardness: 0.25, opaque: false }),
  [B.TALL_GRASS]: D('Tall Grass', 'decor', 30 + 8, { solid: false, cross: true, opaque: false, hardness: 0.05, selectable: true }),
  [B.DOOR]: D('Door', 'building', 32, { hardness: 0.7 }),
  [B.WINDOW]: D('Window', 'building', 33, { hardness: 0.3, opaque: false }),
  [B.STONE_BRICK]: D('Stone Bricks', 'building', 34, { hardness: 1.1 }),
  [B.SNOW_BLOCK]: D('Snow Block', 'natural', 8, { hardness: 0.4 }),
  [B.BEDROCK]: D('Bedrock', 'natural', 35, { unbreakable: true, selectable: false }),
  [B.BOOKSHELF]: D('Bookshelf', 'decor', { top: 12, side: 36, bottom: 12 }, { hardness: 0.7 }),
  [B.FENCE]: D('Fence', 'building', 37, { hardness: 0.5, opaque: false }),
  [B.CLAIM_FLAG]: D('Claim Flag', 'special', 38, { solid: false, cross: true, opaque: false, hardness: 0.2 }),
  [B.TORCH]: D('Torch', 'decor', 40, { solid: false, cross: true, opaque: false, hardness: 0.2, glow: true }),
  [B.WORKBENCH]: D('Workbench', 'building', 41, { hardness: 0.7 }),
};

// Fix tall grass tile index (kept readable above)
BLOCKS[B.TALL_GRASS].tiles = { top: 39, side: 39, bottom: 39 };

export const CATEGORIES = ['natural', 'building', 'decor', 'special'];

export function blockDef(id) { return BLOCKS[id] || BLOCKS[B.AIR]; }
export function isOpaque(id) { return id !== B.AIR && blockDef(id).opaque; }
export function isSolid(id) { return id !== B.AIR && blockDef(id).solid; }
export function isBreakable(id) { const d = blockDef(id); return id !== B.AIR && !d.unbreakable; }

// Starter kit: enough for a small house immediately.
export const STARTER_KIT = [
  [B.PLANKS, 64], [B.WOOD, 32], [B.GLASS, 24], [B.WINDOW, 8],
  [B.ROOF, 40], [B.DOOR, 2], [B.BRICK_RED, 32], [B.LANTERN, 8],
  [B.FLOWER_RED, 10], [B.FLOWER_YELLOW, 10], [B.TALL_GRASS, 16],
  [B.FENCE, 24], [B.GLOW, 8],
  [134, 4], // raw fish (animals subsystem) — lets players try taming right away
];
