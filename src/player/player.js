// First-person player physics: gravity, jumping, axis-separated AABB collision. No DOM / three.js.
import {
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE, WALK_SPEED, SPRINT_SPEED, GRAVITY, JUMP_SPEED, WORLD_SIZE, HEIGHT,
} from '../config.js';
import { WATER, isSolid } from '../world/blocks.js';

const EPS = 1e-3;
const HALF = PLAYER_WIDTH / 2;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = [0, 0, 0]; // feet position
    this.vel = [0, 0, 0];
    this.yaw = 0; // radians, 0 = looking towards -z
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
  }

  eye() {
    return [this.pos[0], this.pos[1] + PLAYER_EYE, this.pos[2]];
  }

  /** Unit look direction. */
  lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  /** Place player standing on the surface at (x, z); searches outward for dry land. */
  spawnAt(x, z) {
    const w = this.world;
    const ok = (cx, cz) => {
      const top = w.topBlockY(cx, cz);
      return top >= 0 && w.getBlock(cx, top, cz) !== WATER ? top : -1;
    };
    let best = null;
    for (let r = 0; r < 128 && !best; r += 2) {
      for (let a = 0; a < Math.max(1, r * 4) && !best; a++) {
        const ang = (a / Math.max(1, r * 4)) * Math.PI * 2;
        const sx = Math.floor(x + Math.cos(ang) * r);
        const sz = Math.floor(z + Math.sin(ang) * r);
        if (sx < 2 || sz < 2 || sx >= WORLD_SIZE - 2 || sz >= WORLD_SIZE - 2) continue;
        const top = ok(sx, sz);
        if (top >= 0) best = [sx + 0.5, top + 1, sz + 0.5];
      }
    }
    if (!best) best = [x + 0.5, w.topBlockY(Math.floor(x), Math.floor(z)) + 1, z + 0.5];
    this.pos = best;
    this.vel = [0, 0, 0];
  }

  /** True if the player's AABB intersects block cell (x, y, z). */
  intersectsBlock(x, y, z) {
    const p = this.pos;
    return (
      x + 1 > p[0] - HALF && x < p[0] + HALF &&
      y + 1 > p[1] && y < p[1] + PLAYER_HEIGHT &&
      z + 1 > p[2] - HALF && z < p[2] + HALF
    );
  }

  /**
   * @param {number} dt seconds
   * @param {{forward:number,right:number,jump:boolean,sprint:boolean}} input
   */
  update(dt, input) {
    dt = Math.min(dt, 0.05);
    const w = this.world;
    const feet = w.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.1), Math.floor(this.pos[2]));
    const body = w.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 1), Math.floor(this.pos[2]));
    this.inWater = feet === WATER || body === WATER;

    // Horizontal movement relative to yaw
    let f = input.forward;
    let r = input.right;
    const len = Math.hypot(f, r);
    if (len > 1) {
      f /= len;
      r /= len;
    }
    let speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    if (this.inWater) speed *= 0.55;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.vel[0] = (-sin * f + cos * r) * speed;
    this.vel[2] = (-cos * f - sin * r) * speed;

    if (this.inWater) {
      this.vel[1] -= GRAVITY * 0.3 * dt;
      if (input.jump) this.vel[1] = 3.2;
      this.vel[1] = Math.max(this.vel[1], -3);
    } else {
      this.vel[1] -= GRAVITY * dt;
      if (input.jump && this.onGround) this.vel[1] = JUMP_SPEED;
      this.vel[1] = Math.max(this.vel[1], -40);
    }

    this.onGround = false;
    // Sub-step to avoid tunnelling
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vel[0]), Math.abs(this.vel[1]), Math.abs(this.vel[2])) * dt / 0.4));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(1, this.vel[1] * sdt);
      this.moveAxis(0, this.vel[0] * sdt);
      this.moveAxis(2, this.vel[2] * sdt);
    }

    // Hard clamp inside the world
    this.pos[0] = Math.min(Math.max(this.pos[0], HALF + EPS), WORLD_SIZE - HALF - EPS);
    this.pos[2] = Math.min(Math.max(this.pos[2], HALF + EPS), WORLD_SIZE - HALF - EPS);
    if (this.pos[1] < 1) {
      this.pos[1] = 1;
      this.vel[1] = 0;
    }
    if (this.pos[1] > HEIGHT + 20) this.pos[1] = HEIGHT + 20;
  }

  moveAxis(axis, d) {
    if (d === 0) return;
    const p = this.pos;
    p[axis] += d;
    const minX = Math.floor(p[0] - HALF);
    const maxX = Math.floor(p[0] + HALF - 1e-9);
    const minY = Math.floor(p[1]);
    const maxY = Math.floor(p[1] + PLAYER_HEIGHT - 1e-9);
    const minZ = Math.floor(p[2] - HALF);
    const maxZ = Math.floor(p[2] + HALF - 1e-9);
    const ext = axis === 1 ? 0 : HALF;
    let hit = false;
    let limit = d > 0 ? Infinity : -Infinity;
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (!isSolid(this.world.getBlock(x, y, z))) continue;
          hit = true;
          const b = axis === 0 ? x : axis === 1 ? y : z;
          if (d > 0) limit = Math.min(limit, b);
          else limit = Math.max(limit, b + 1);
        }
      }
    }
    if (!hit) return;
    if (d > 0) p[axis] = limit - (axis === 1 ? PLAYER_HEIGHT : ext) - EPS;
    else {
      p[axis] = limit + ext + EPS;
      if (axis === 1) this.onGround = true;
    }
    this.vel[axis] = 0;
  }
}
