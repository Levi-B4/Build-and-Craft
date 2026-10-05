// Loads/unloads chunk meshes around the player with a nearest-first build queue.
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNKS_PER_FRAME } from '../config.js';
import { World, chunkKey } from './world.js';
import { buildChunkMesh } from './mesher.js';

function toGeometry(arrays) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3));
  g.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
  g.computeBoundingSphere();
  return g;
}

export class ChunkManager {
  /**
   * @param {World} world
   * @param {THREE.Scene} scene
   * @param {THREE.Texture} atlas
   * @param {number} renderDistance in chunks
   */
  constructor(world, scene, atlas, renderDistance) {
    this.world = world;
    this.scene = scene;
    this.renderDistance = renderDistance;
    this.meshes = new Map(); // key -> { opaque, transparent, cx, cz }
    this.dirty = new Set();
    this.centerKey = null;
    this.queue = [];
    this.onChunkLoaded = null;

    this.opaqueMaterial = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true });
    this.transparentMaterial = new THREE.MeshBasicMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    world.onChange((x, y, z) => this.markDirtyAround(x, z));
  }

  markDirtyAround(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.meshes.has(key)) this.dirty.add(key);
  }

  isLoaded(cx, cz) {
    return this.meshes.has(chunkKey(cx, cz));
  }

  get loadedCount() {
    return this.meshes.size;
  }

  /** Call every frame with player position. */
  update(px, pz, budget = CHUNKS_PER_FRAME) {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const key = chunkKey(pcx, pcz);
    if (key !== this.centerKey) {
      this.centerKey = key;
      this.rebuildQueue(pcx, pcz);
      this.unloadFar(pcx, pcz);
    }

    // Edited chunks rebuild immediately
    for (const k of this.dirty) {
      const m = this.meshes.get(k);
      if (m) this.buildMesh(m.cx, m.cz);
    }
    this.dirty.clear();

    while (budget > 0 && this.queue.length) {
      const [cx, cz] = this.queue.shift();
      if (this.meshes.has(chunkKey(cx, cz))) continue;
      this.buildMesh(cx, cz);
      budget--;
      if (this.onChunkLoaded) this.onChunkLoaded(cx, cz);
    }
  }

  rebuildQueue(pcx, pcz) {
    const r = this.renderDistance;
    const list = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r + r) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!World.chunkInWorld(cx, cz) || this.meshes.has(chunkKey(cx, cz))) continue;
        list.push([cx, cz, d2]);
      }
    }
    list.sort((a, b) => a[2] - b[2]);
    this.queue = list;
  }

  unloadFar(pcx, pcz) {
    const limit = this.renderDistance + 1;
    for (const [key, m] of this.meshes) {
      if (Math.abs(m.cx - pcx) > limit || Math.abs(m.cz - pcz) > limit) {
        this.disposeMesh(m);
        this.meshes.delete(key);
        this.dirty.delete(key);
      }
    }
  }

  buildMesh(cx, cz) {
    const key = chunkKey(cx, cz);
    const arrays = buildChunkMesh(this.world, cx, cz);
    let m = this.meshes.get(key);
    if (m) this.disposeMesh(m);
    m = { cx, cz, opaque: null, transparent: null };
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;
    if (arrays.opaque.faceCount) {
      m.opaque = new THREE.Mesh(toGeometry(arrays.opaque), this.opaqueMaterial);
      m.opaque.position.set(ox, 0, oz);
      m.opaque.matrixAutoUpdate = false;
      m.opaque.updateMatrix();
      this.scene.add(m.opaque);
    }
    if (arrays.transparent.faceCount) {
      m.transparent = new THREE.Mesh(toGeometry(arrays.transparent), this.transparentMaterial);
      m.transparent.position.set(ox, 0, oz);
      m.transparent.renderOrder = 1; // after opaque geometry
      m.transparent.matrixAutoUpdate = false;
      m.transparent.updateMatrix();
      this.scene.add(m.transparent);
    }
    this.meshes.set(key, m);
  }

  disposeMesh(m) {
    for (const mesh of [m.opaque, m.transparent]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
  }

  /** Drop everything (used when starting a new world). */
  dispose() {
    for (const m of this.meshes.values()) this.disposeMesh(m);
    this.meshes.clear();
    this.queue = [];
    this.dirty.clear();
    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
  }
}
