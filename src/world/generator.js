// Terrain generation. Pure module: deterministic function of (seed, chunk coords).
import { CHUNK_SIZE, HEIGHT, SEA_LEVEL, WORLD_SIZE } from '../config.js';
import { AIR, GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, BEDROCK } from './blocks.js';
import { fbm2D, hash2, hashInt } from './noise.js';

export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * HEIGHT;
const TREE_RADIUS = 2;

/** Index of local block (x, y, z) inside a chunk array. */
export function blockIndex(x, y, z) {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

/** Terrain surface height (y of the top solid block) at world column (x, z). */
export function surfaceHeight(seed, x, z) {
  const n = fbm2D(seed, x / 80, z / 80, 3, 0);
  const m = fbm2D(seed, x / 22, z / 22, 2, 500);
  const h = Math.floor(6 + n * 38 + (m - 0.5) * 7);
  return Math.max(3, Math.min(HEIGHT - 12, h));
}

/** Tree at world column (x, z)? Returns trunk height or 0. Stateless hash => order independent. */
export function treeAt(seed, x, z) {
  if (x < 3 || z < 3 || x > WORLD_SIZE - 4 || z > WORLD_SIZE - 4) return 0;
  const h = surfaceHeight(seed, x, z);
  if (h <= SEA_LEVEL + 1) return 0; // only on grass
  const forest = fbm2D(seed, x / 50, z / 50, 2, 900);
  const chance = forest > 0.56 ? 0.05 : 0.006;
  if (hash2(seed, x, z, 7) >= chance) return 0;
  return 4 + (hashInt(seed, x, z, 8) % 2);
}

/**
 * Generate the blocks of chunk (cx, cz).
 * @returns {Uint8Array} CHUNK_VOLUME block ids, indexed by blockIndex().
 */
export function generateChunk(seed, cx, cz) {
  const data = new Uint8Array(CHUNK_VOLUME);
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

  // Terrain columns
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const h = surfaceHeight(seed, ox + x, oz + z);
      const beach = h <= SEA_LEVEL + 1;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = BEDROCK;
        else if (y < h - 3) id = STONE;
        else if (y < h) id = beach ? SAND : DIRT;
        else id = beach ? SAND : GRASS;
        data[blockIndex(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA_LEVEL; y++) data[blockIndex(x, y, z)] = WATER;
    }
  }

  // Trees: consider every candidate column whose canopy could overlap this chunk.
  for (let wz = oz - TREE_RADIUS; wz < oz + CHUNK_SIZE + TREE_RADIUS; wz++) {
    for (let wx = ox - TREE_RADIUS; wx < ox + CHUNK_SIZE + TREE_RADIUS; wx++) {
      const trunk = treeAt(seed, wx, wz);
      if (trunk) placeTree(data, ox, oz, wx, surfaceHeight(seed, wx, wz) + 1, wz, trunk);
    }
  }
  return data;
}

function setLocal(data, ox, oz, wx, y, wz, id) {
  const x = wx - ox;
  const z = wz - oz;
  if (x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE || y < 0 || y >= HEIGHT) return;
  const i = blockIndex(x, y, z);
  const cur = data[i];
  // Logs overwrite air/leaves, leaves only fill air: makes overlapping trees order-independent.
  if (id === LOG ? cur === AIR || cur === LEAVES : cur === AIR) data[i] = id;
}

function placeTree(data, ox, oz, wx, baseY, wz, trunk) {
  const top = baseY + trunk - 1;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy <= -1 ? 2 : 1;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // round corners
        if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        setLocal(data, ox, oz, wx + dx, top + dy, wz + dz, LEAVES);
      }
    }
  }
  for (let y = baseY; y <= top; y++) setLocal(data, ox, oz, wx, y, wz, LOG);
}
