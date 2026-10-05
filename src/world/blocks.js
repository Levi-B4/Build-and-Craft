// Block definitions. Pure module.

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const COBBLESTONE = 4;
export const SAND = 5;
export const WATER = 6;
export const LOG = 7;
export const LEAVES = 8;
export const PLANKS = 9;
export const GLASS = 10;
export const BRICK = 11;
export const CRAFTING_TABLE = 12;
export const BEDROCK = 13;

// Texture atlas tiles (4x4 grid of 16px tiles).
export const ATLAS_COLS = 4;
export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  WATER: 6,
  LOG_SIDE: 7,
  LOG_TOP: 8,
  LEAVES: 9,
  PLANKS: 10,
  GLASS: 11,
  BRICK: 12,
  TABLE_TOP: 13,
  TABLE_SIDE: 14,
  BEDROCK: 15,
};

function def(name, opts) {
  const tex = opts.tex;
  return {
    name,
    solid: opts.solid ?? true,
    transparent: opts.transparent ?? false,
    breakable: opts.breakable ?? true,
    placeable: opts.placeable ?? true,
    drop: opts.drop, // undefined = drops itself, null = nothing
    color: opts.color, // minimap colour
    // tiles: [top, side, bottom]
    tiles: typeof tex === 'number' ? [tex, tex, tex] : tex,
  };
}

export const BLOCKS = [];
BLOCKS[AIR] = def('Air', { solid: false, transparent: true, breakable: false, placeable: false, tex: 0, color: '#000000' });
BLOCKS[GRASS] = def('Grass', { tex: [TILE.GRASS_TOP, TILE.GRASS_SIDE, TILE.DIRT], drop: DIRT, color: '#5fa04e' });
BLOCKS[DIRT] = def('Dirt', { tex: TILE.DIRT, color: '#86603e' });
BLOCKS[STONE] = def('Stone', { tex: TILE.STONE, drop: COBBLESTONE, color: '#8a8a8a' });
BLOCKS[COBBLESTONE] = def('Cobblestone', { tex: TILE.COBBLESTONE, color: '#6f6f6f' });
BLOCKS[SAND] = def('Sand', { tex: TILE.SAND, color: '#dbcf8f' });
BLOCKS[WATER] = def('Water', { solid: false, transparent: true, breakable: false, placeable: false, tex: TILE.WATER, color: '#3a6fd1' });
BLOCKS[LOG] = def('Log', { tex: [TILE.LOG_TOP, TILE.LOG_SIDE, TILE.LOG_TOP], color: '#6b4f2c' });
BLOCKS[LEAVES] = def('Leaves', { tex: TILE.LEAVES, drop: null, color: '#3d7a2e' });
BLOCKS[PLANKS] = def('Planks', { tex: TILE.PLANKS, color: '#b8925a' });
BLOCKS[GLASS] = def('Glass', { transparent: true, tex: TILE.GLASS, color: '#c8e8f0' });
BLOCKS[BRICK] = def('Brick', { tex: TILE.BRICK, color: '#a24b3a' });
BLOCKS[CRAFTING_TABLE] = def('Crafting Table', { tex: [TILE.TABLE_TOP, TILE.TABLE_SIDE, TILE.PLANKS], color: '#9a6b3a' });
BLOCKS[BEDROCK] = def('Bedrock', { breakable: false, placeable: false, tex: TILE.BEDROCK, color: '#333333' });

export const BLOCK_COUNT = BLOCKS.length;

export function isSolid(id) {
  return BLOCKS[id].solid;
}

export function isOpaque(id) {
  return id !== AIR && !BLOCKS[id].transparent;
}

export function isTransparent(id) {
  return BLOCKS[id].transparent;
}

/** What breaking this block yields (block id), or null for nothing. */
export function dropOf(id) {
  const b = BLOCKS[id];
  if (!b.breakable) return null;
  return b.drop === undefined ? id : b.drop;
}

export function blockName(id) {
  return BLOCKS[id] ? BLOCKS[id].name : 'Unknown';
}
