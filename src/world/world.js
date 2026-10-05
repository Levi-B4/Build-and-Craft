// Chunk storage, block get/set and modification tracking. Pure module.
import { CHUNK_SIZE, HEIGHT, WORLD_CHUNKS, WORLD_SIZE } from '../config.js';
import { AIR, BEDROCK } from './blocks.js';
import { generateChunk, blockIndex } from './generator.js';

export function chunkKey(cx, cz) {
  return cx + ',' + cz;
}

export function inWorldXZ(x, z) {
  return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE;
}

export class World {
  /**
   * @param {object} opts
   * @param {number} opts.seed
   * @param {object} [opts.modifications] saved diffs: { "cx,cz": { index: blockId } }
   * @param {Function} [opts.generate] override chunk generator (seed, cx, cz) => Uint8Array (tests)
   */
  constructor({ seed, modifications = {}, generate = generateChunk } = {}) {
    this.seed = seed >>> 0;
    this.generate = generate;
    this.chunks = new Map();
    this.modifications = {};
    for (const [key, diff] of Object.entries(modifications || {})) {
      this.modifications[key] = { ...diff };
    }
    this.listeners = [];
  }

  /** Subscribe to block changes: fn(x, y, z, id). */
  onChange(fn) {
    this.listeners.push(fn);
  }

  hasChunk(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  static chunkInWorld(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < WORLD_CHUNKS && cz < WORLD_CHUNKS;
  }

  /** Get (generating if needed) chunk data, or null if outside the world. */
  getChunk(cx, cz) {
    if (!World.chunkInWorld(cx, cz)) return null;
    const key = chunkKey(cx, cz);
    let data = this.chunks.get(key);
    if (!data) {
      data = this.generate(this.seed, cx, cz);
      const diff = this.modifications[key];
      if (diff) {
        for (const idx in diff) data[idx] = diff[idx];
      }
      this.chunks.set(key, data);
    }
    return data;
  }

  getBlock(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= HEIGHT) return AIR;
    if (!inWorldXZ(x, z)) return BEDROCK; // invisible wall at world edge
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const data = this.getChunk(cx, cz);
    return data[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  /** Set a block, recording it as a modification. Returns false if out of bounds. */
  setBlock(x, y, z, id) {
    if (y < 0 || y >= HEIGHT || !inWorldXZ(x, z)) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const data = this.getChunk(cx, cz);
    const idx = blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
    if (data[idx] === id) return true;
    data[idx] = id;
    const key = chunkKey(cx, cz);
    (this.modifications[key] ||= {})[idx] = id;
    for (const fn of this.listeners) fn(x, y, z, id);
    return true;
  }

  /** Y of highest non-air block in column (x, z), or -1. */
  topBlockY(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (this.getBlock(x, y, z) !== AIR) return y;
    }
    return -1;
  }
}
