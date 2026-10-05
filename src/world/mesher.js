// Chunk mesher: turns chunk block data into plain typed arrays (no three.js), with face culling.
import { CHUNK_SIZE, HEIGHT } from '../config.js';
import { AIR, WATER, BLOCKS, ATLAS_COLS } from './blocks.js';

// Each face: neighbour direction, 4 corners (CCW seen from outside), shade, tile slot (0 top,1 side,2 bottom)
export const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8, slot: 1 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8, slot: 1 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, slot: 0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, slot: 2 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.65, slot: 1 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.65, slot: 1 },
];
const CORNER_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const UV_INSET = 0.5 / (ATLAS_COLS * 16); // half a texel

// Precomputed per-block lookup tables
const OPAQUE = new Uint8Array(256);
const TRANSPARENT = new Uint8Array(256);
for (let id = 0; id < BLOCKS.length; id++) {
  if (id !== AIR && !BLOCKS[id].transparent) OPAQUE[id] = 1;
  if (id !== AIR && BLOCKS[id].transparent) TRANSPARENT[id] = 1;
}

/** UV rectangle [u0, v0, u1, v1] for an atlas tile (v flipped for canvas textures). */
export function tileUV(tile) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const size = 1 / ATLAS_COLS;
  const u0 = col * size + UV_INSET;
  const u1 = (col + 1) * size - UV_INSET;
  const v1 = 1 - row * size - UV_INSET;
  const v0 = 1 - (row + 1) * size + UV_INSET;
  return [u0, v0, u1, v1];
}

class MeshBuffers {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
    this.faceCount = 0;
  }
  finish() {
    return {
      positions: new Float32Array(this.positions),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: (this.positions.length / 3 > 65535 ? Uint32Array : Uint16Array).from(this.indices),
      faceCount: this.faceCount,
    };
  }
}

/**
 * Build mesh arrays for chunk (cx, cz). Positions are local to the chunk origin.
 * @param {import('./world.js').World} world
 */
export function buildChunkMesh(world, cx, cz) {
  const data = world.getChunk(cx, cz);
  const opaque = new MeshBuffers();
  const transparent = new MeshBuffers();
  if (!data) return { opaque: opaque.finish(), transparent: transparent.finish() };
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const S = CHUNK_SIZE;

  const neighbour = (x, y, z) => {
    if (y < 0 || y >= HEIGHT) return y < 0 ? 255 : AIR; // 255 => treat as opaque (no bottom faces)
    if (x >= 0 && z >= 0 && x < S && z < S) return data[(y * S + z) * S + x];
    return world.getBlock(ox + x, y, oz + z); // border: fall back to world (bedrock outside world)
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const id = data[(y * S + z) * S + x];
        if (id === AIR) continue;
        const isTrans = TRANSPARENT[id] === 1;
        const tiles = BLOCKS[id].tiles;
        const out = isTrans ? transparent : opaque;
        const waterTop = id === WATER && neighbour(x, y + 1, z) !== WATER;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const n = neighbour(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
          if (n === 255 || OPAQUE[n]) continue;
          if (isTrans && n === id) continue; // no faces between same transparent blocks
          addFace(out, face, x, y, z, tiles[face.slot], waterTop);
        }
      }
    }
  }
  return { opaque: opaque.finish(), transparent: transparent.finish() };
}

function addFace(out, face, x, y, z, tile, lowerTop) {
  const base = out.positions.length / 3;
  const [u0, v0, u1, v1] = tileUV(tile);
  const s = face.shade;
  for (let i = 0; i < 4; i++) {
    const c = face.corners[i];
    const cy = c[1] === 1 && lowerTop ? 0.875 : c[1];
    out.positions.push(x + c[0], y + cy, z + c[2]);
    const uv = CORNER_UV[i];
    out.uvs.push(uv[0] ? u1 : u0, uv[1] ? v1 : v0);
    out.colors.push(s, s, s);
  }
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  out.faceCount++;
}
