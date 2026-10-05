// Spawning, wandering AI and "moo when on screen" logic for highland cows.
import * as THREE from 'three';
import { CHUNK_SIZE, MAX_COWS, COW_DESPAWN_DIST, MOO_DISTANCE } from '../config.js';
import { GRASS, WATER, isSolid, isOpaque } from '../world/blocks.js';
import { hash2, hashInt } from '../world/noise.js';
import { chunkKey, inWorldXZ } from '../world/world.js';
import { raycast } from '../player/raycast.js';
import { createCowModel, COW_HALF_WIDTH, COW_HEIGHT } from './cow.js';

const WALK_SPEED = 1.1;
const GLOBAL_MOO_GAP = 0.8; // seconds between any two moos
const REENTER_MOO_GAP = 3; // min seconds before a cow moos again when re-entering view

export class CowManager {
  constructor(world, scene, chunkManager, audio) {
    this.world = world;
    this.scene = scene;
    this.chunks = chunkManager;
    this.audio = audio;
    this.cows = [];
    this.spawnedChunks = new Set();
    this.frustum = new THREE.Frustum();
    this.projView = new THREE.Matrix4();
    this.box = new THREE.Box3();
    this.time = 0;
    this.lastGlobalMoo = -Infinity;
    this.stats = { moos: 0, mooTriggers: 0, visible: 0 };
  }

  solid(x, y, z) {
    return isSolid(this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  /** Called when a chunk's mesh is first loaded: deterministic chance to spawn cows on grass. */
  onChunkLoaded(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.spawnedChunks.has(key)) return;
    this.spawnedChunks.add(key);
    const seed = this.world.seed;
    if (hash2(seed, cx, cz, 31) > 0.3) return;
    const n = 1 + (hashInt(seed, cx, cz, 32) % 3);
    for (let i = 0; i < n && this.cows.length < MAX_COWS; i++) {
      const x = cx * CHUNK_SIZE + (hashInt(seed, cx, cz, 40 + i) % CHUNK_SIZE);
      const z = cz * CHUNK_SIZE + (hashInt(seed, cx, cz, 50 + i) % CHUNK_SIZE);
      const top = this.world.topBlockY(x, z);
      if (top < 0 || this.world.getBlock(x, top, z) !== GRASS) continue;
      this.spawn(x + 0.5, top + 1, z + 0.5, hash2(seed, x, z, 60) * Math.PI * 2, key);
    }
  }

  spawn(x, y, z, yaw, chunk) {
    const model = createCowModel();
    const cow = {
      ...model,
      x, y, z, yaw, vy: 0,
      chunk,
      mode: 'idle',
      timer: 1 + Math.random() * 3,
      phase: 0,
      wasVisible: false,
      sinceMoo: Infinity,
      cooldown: 8 + Math.random() * 12,
      pitch: 0.85 + Math.random() * 0.3,
    };
    model.group.position.set(x, y, z);
    model.group.rotation.y = yaw;
    this.scene.add(model.group);
    this.cows.push(cow);
    return cow;
  }

  remove(cow) {
    this.scene.remove(cow.group);
    this.cows.splice(this.cows.indexOf(cow), 1);
    this.spawnedChunks.delete(cow.chunk); // allow deterministic respawn when the player returns
  }

  clear() {
    for (const c of [...this.cows]) this.scene.remove(c.group);
    this.cows = [];
    this.spawnedChunks.clear();
  }

  /** Does the AABB of any cow intersect block cell (x, y, z)? */
  intersectsBlock(x, y, z) {
    return this.cows.some(
      (c) =>
        x + 1 > c.x - COW_HALF_WIDTH && x < c.x + COW_HALF_WIDTH &&
        y + 1 > c.y && y < c.y + COW_HEIGHT &&
        z + 1 > c.z - COW_HALF_WIDTH && z < c.z + COW_HALF_WIDTH,
    );
  }

  update(dt, camera, eye) {
    this.time += dt;
    for (const cow of [...this.cows]) {
      const dist = Math.hypot(cow.x - eye[0], cow.z - eye[2]);
      if (dist > COW_DESPAWN_DIST) {
        this.remove(cow);
        continue;
      }
      // Freeze AI if the cow's chunk isn't loaded
      if (!this.chunks.isLoaded(Math.floor(cow.x / CHUNK_SIZE), Math.floor(cow.z / CHUNK_SIZE))) continue;
      this.updateAI(cow, dt);
    }
    this.updateMoos(dt, camera, eye);
  }

  updateAI(cow, dt) {
    cow.timer -= dt;
    if (cow.timer <= 0) {
      if (cow.mode === 'idle' && Math.random() < 0.65) {
        cow.mode = 'walk';
        cow.yaw = Math.random() * Math.PI * 2;
        cow.timer = 2 + Math.random() * 4;
      } else {
        cow.mode = 'idle';
        cow.timer = 2 + Math.random() * 4;
      }
    }

    if (cow.mode === 'walk') {
      const dx = Math.sin(cow.yaw);
      const dz = Math.cos(cow.yaw);
      const nx = cow.x + dx * WALK_SPEED * dt;
      const nz = cow.z + dz * WALK_SPEED * dt;
      const px = nx + dx * 0.75; // probe in front of the cow
      const pz = nz + dz * 0.75;
      const fy = Math.floor(cow.y + 0.01);
      const get = (y) => this.world.getBlock(Math.floor(px), y, Math.floor(pz));
      let blocked = !inWorldXZ(Math.floor(px), Math.floor(pz));
      let stepUp = false;
      if (!blocked) {
        if (isSolid(get(fy))) {
          if (!isSolid(get(fy + 1)) && !isSolid(get(fy + 2))) stepUp = true;
          else blocked = true;
        } else if (isSolid(get(fy + 1))) {
          blocked = true;
        } else if (get(fy) === WATER || get(fy - 1) === WATER) {
          blocked = true; // cows avoid water
        } else if (!isSolid(get(fy - 1)) && !isSolid(get(fy - 2))) {
          blocked = true; // don't walk off cliffs
        }
      }
      if (blocked) {
        cow.yaw += Math.PI * (0.5 + Math.random());
        cow.timer = Math.max(cow.timer, 1);
      } else {
        cow.x = nx;
        cow.z = nz;
        if (stepUp) {
          cow.y = fy + 1;
          cow.vy = 0;
        }
      }
      cow.phase += dt * 7;
    } else {
      cow.phase *= 0.9;
    }

    // Gravity / ground snap
    cow.vy -= 20 * dt;
    cow.y += cow.vy * dt;
    const by = Math.floor(cow.y);
    if (this.solid(cow.x, by, cow.z)) {
      cow.y = by + 1;
      cow.vy = 0;
    }
    if (this.world.getBlock(Math.floor(cow.x), Math.floor(cow.y), Math.floor(cow.z)) === WATER) cow.vy = 1.5;
    let guard = 0;
    while (this.solid(cow.x, cow.y + 0.5, cow.z) && guard++ < 64) cow.y = Math.floor(cow.y + 0.5) + 1; // pushed out by edits

    // Animate
    const swing = Math.sin(cow.phase) * 0.5 * (cow.mode === 'walk' ? 1 : 0);
    cow.legs[0].rotation.x = swing;
    cow.legs[3].rotation.x = swing;
    cow.legs[1].rotation.x = -swing;
    cow.legs[2].rotation.x = -swing;
    cow.head.rotation.x = cow.mode === 'idle' ? 0.25 + Math.sin(this.time * 0.8 + cow.pitch * 10) * 0.1 : 0;
    cow.group.position.set(cow.x, cow.y, cow.z);
    cow.group.rotation.y = cow.yaw;
  }

  /** Is the cow on screen: inside the camera frustum, within range and not hidden behind terrain. */
  isVisible(cow, camera, eye) {
    const head = [cow.x + Math.sin(cow.yaw) * 0.8, cow.y + 1.15, cow.z + Math.cos(cow.yaw) * 0.8];
    const dx = head[0] - eye[0];
    const dy = head[1] - eye[1];
    const dz = head[2] - eye[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > MOO_DISTANCE) return { visible: false, dist };
    this.box.min.set(cow.x - COW_HALF_WIDTH, cow.y, cow.z - COW_HALF_WIDTH);
    this.box.max.set(cow.x + COW_HALF_WIDTH, cow.y + COW_HEIGHT, cow.z + COW_HALF_WIDTH);
    if (!this.frustum.intersectsBox(this.box)) return { visible: false, dist };
    const hit = raycast((x, y, z) => this.world.getBlock(x, y, z), eye, [dx, dy, dz], dist, isOpaque);
    return { visible: !hit || hit.dist >= dist - 0.5, dist, dx, dz };
  }

  updateMoos(dt, camera, eye) {
    camera.updateMatrixWorld();
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    let visibleCount = 0;
    for (const cow of this.cows) {
      cow.sinceMoo += dt;
      const v = this.isVisible(cow, camera, eye);
      if (v.visible) visibleCount++;
      const entering = v.visible && !cow.wasVisible && cow.sinceMoo > REENTER_MOO_GAP;
      const repeat = v.visible && cow.sinceMoo > cow.cooldown;
      cow.wasVisible = v.visible;
      if (!(entering || repeat)) continue;
      if (this.time - this.lastGlobalMoo < GLOBAL_MOO_GAP) continue;
      this.lastGlobalMoo = this.time;
      cow.sinceMoo = 0;
      cow.cooldown = 8 + Math.random() * 12;
      this.stats.mooTriggers++;
      const volume = 0.15 + 0.85 * Math.pow(1 - v.dist / MOO_DISTANCE, 1.3);
      const len = Math.hypot(v.dx, v.dz) || 1;
      const pan = (v.dx * right.x + v.dz * right.z) / len;
      if (this.audio.moo(volume, pan * 0.8, cow.pitch)) this.stats.moos++;
    }
    this.stats.visible = visibleCount;
  }
}
