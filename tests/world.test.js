import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateChunk, treeAt, surfaceHeight, CHUNK_VOLUME } from '../src/world/generator.js';
import { World } from '../src/world/world.js';
import { buildChunkMesh } from '../src/world/mesher.js';
import { raycast } from '../src/player/raycast.js';
import { AIR, STONE, LOG, LEAVES, GLASS, BEDROCK } from '../src/world/blocks.js';
import { CHUNK_SIZE, WORLD_CHUNKS } from '../src/config.js';

const emptyGen = () => new Uint8Array(CHUNK_VOLUME);

test('same seed generates identical chunks', () => {
  const a = generateChunk(1234, 5, 7);
  const b = generateChunk(1234, 5, 7);
  assert.deepEqual(a, b);
});

test('different seeds generate different chunks', () => {
  const a = generateChunk(1234, 5, 7);
  const b = generateChunk(98765, 5, 7);
  assert.notDeepEqual(a, b);
});

test('chunk has bedrock floor and terrain', () => {
  const w = new World({ seed: 42 });
  assert.equal(w.getBlock(10, 0, 10), BEDROCK);
  assert.ok(w.topBlockY(10, 10) > 2);
  // outside world is a solid wall
  assert.equal(w.getBlock(-1, 30, 10), BEDROCK);
});

test('trees crossing chunk borders are identical regardless of generation order', () => {
  // Find a seed+tree whose canopy crosses a chunk border
  let found = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    for (let cx = 1; cx < 10 && !found; cx++) {
      const x = cx * CHUNK_SIZE; // border column x = 16*cx (canopy reaches x-2..x+2)
      for (let z = 20; z < 200; z++) {
        const tx = x - 1; // tree trunk just left of the border
        if (treeAt(seed, tx, z)) {
          found = { seed, tx, z, cx };
          break;
        }
      }
    }
  }
  assert.ok(found, 'expected to find a border tree');
  const { seed, tx, z, cx } = found;
  const cz = Math.floor(z / CHUNK_SIZE);
  const leafY = surfaceHeight(seed, tx, z) + 1 + 2; // canopy layer

  const w1 = new World({ seed });
  w1.getChunk(cx - 1, cz);
  w1.getChunk(cx, cz);
  const w2 = new World({ seed });
  w2.getChunk(cx, cz);
  w2.getChunk(cx - 1, cz);
  // Canopy leaf exists in neighbouring chunk (x = tx + 1 is in chunk cx)
  assert.equal(w1.getBlock(tx, leafY - 1, z), LOG);
  assert.ok([LEAVES, LOG].includes(w1.getBlock(tx + 1, leafY, z)));
  for (const k of [cx - 1, cx]) {
    assert.deepEqual(w1.getChunk(k, cz), w2.getChunk(k, cz));
  }
});

test('mesher: one block = 6 faces, two adjacent = 10 faces', () => {
  const w = new World({ seed: 1, generate: emptyGen });
  w.setBlock(5, 30, 5, STONE);
  assert.equal(buildChunkMesh(w, 0, 0).opaque.faceCount, 6);
  w.setBlock(6, 30, 5, STONE);
  const mesh = buildChunkMesh(w, 0, 0);
  assert.equal(mesh.opaque.faceCount, 10);
  assert.equal(mesh.opaque.positions.length, 10 * 4 * 3);
  assert.equal(mesh.opaque.indices.length, 10 * 6);
});

test('mesher: transparent blocks go in their own buffer, no faces between same type', () => {
  const w = new World({ seed: 1, generate: emptyGen });
  w.setBlock(5, 30, 5, GLASS);
  w.setBlock(6, 30, 5, GLASS);
  const mesh = buildChunkMesh(w, 0, 0);
  assert.equal(mesh.opaque.faceCount, 0);
  assert.equal(mesh.transparent.faceCount, 10);
});

test('mesher: blocks across a chunk border cull each other and world edge is hidden', () => {
  const w = new World({ seed: 1, generate: emptyGen });
  w.setBlock(15, 30, 5, STONE); // chunk 0
  w.setBlock(16, 30, 5, STONE); // chunk 1
  assert.equal(buildChunkMesh(w, 0, 0).opaque.faceCount, 5);
  assert.equal(buildChunkMesh(w, 1, 0).opaque.faceCount, 5);
  // block at x=0 touching the world edge: no outward face
  w.setBlock(0, 30, 8, STONE);
  assert.equal(buildChunkMesh(w, 0, 0).opaque.faceCount, 5 + 5);
  const last = WORLD_CHUNKS - 1;
  assert.equal(buildChunkMesh(w, last, last).opaque.faceCount, 0);
});

test('raycast hits block with correct face normal', () => {
  const w = new World({ seed: 1, generate: emptyGen });
  w.setBlock(10, 30, 10, STONE);
  const get = (x, y, z) => w.getBlock(x, y, z);
  // From above, looking down
  let hit = raycast(get, [10.5, 33.5, 10.5], [0, -1, 0], 6);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [10, 30, 10]);
  assert.deepEqual(hit.normal, [0, 1, 0]);
  // From -x side
  hit = raycast(get, [7.5, 30.5, 10.5], [1, 0, 0], 6);
  assert.deepEqual([hit.x, hit.y, hit.z], [10, 30, 10]);
  assert.deepEqual(hit.normal, [-1, 0, 0]);
  // Out of reach
  assert.equal(raycast(get, [0.5, 30.5, 10.5], [1, 0, 0], 6), null);
  // Miss
  assert.equal(raycast(get, [10.5, 33.5, 10.5], [0, 1, 0], 6), null);
  assert.equal(get(10, 31, 10), AIR);
});
