// Minimap: aerial view of exactly the current 16x16 chunk (8px per block), player marker and cow dots.
import { CHUNK_SIZE } from '../config.js';
import { BLOCKS, AIR } from '../world/blocks.js';
import { chunkKey } from '../world/world.js';

const PX = 8;
const SIZE = CHUNK_SIZE * PX;

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export class Minimap {
  constructor(root, world) {
    this.world = world;
    root.innerHTML = `<canvas width="${SIZE}" height="${SIZE}"></canvas><div class="minimap-label"></div>`;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.label = root.querySelector('.minimap-label');
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = SIZE;
    this.baseCtx = this.base.getContext('2d');
    this.currentKey = null;
    this.baseDirty = true;
    this.accum = 0;
    this.attach(world);
  }

  attach(world) {
    this.world = world;
    this.currentKey = null;
    world.onChange((x, y, z) => {
      const key = chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      if (key === this.currentKey) this.baseDirty = true;
    });
  }

  drawBase(cx, cz) {
    const ctx = this.baseCtx;
    const w = this.world;
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const top = w.topBlockY(wx, wz);
        const id = top >= 0 ? w.getBlock(wx, top, wz) : AIR;
        const k = 0.55 + (top / 64) * 0.9; // shade by height
        ctx.fillStyle = shade(BLOCKS[id].color, k);
        ctx.fillRect(x * PX, z * PX, PX, PX);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < CHUNK_SIZE; i++) {
      ctx.moveTo(i * PX + 0.5, 0);
      ctx.lineTo(i * PX + 0.5, SIZE);
      ctx.moveTo(0, i * PX + 0.5);
      ctx.lineTo(SIZE, i * PX + 0.5);
    }
    ctx.stroke();
    this.baseDirty = false;
  }

  /** @param {number[]} pos player feet; yaw radians; cows array of {x,z} */
  update(dt, pos, yaw, cows, force = false) {
    const cx = Math.floor(pos[0] / CHUNK_SIZE);
    const cz = Math.floor(pos[2] / CHUNK_SIZE);
    const key = chunkKey(cx, cz);
    let redraw = force;
    if (key !== this.currentKey) {
      this.currentKey = key;
      this.baseDirty = true;
      this.label.textContent = `Chunk ${cx}, ${cz}`;
    }
    if (this.baseDirty) {
      this.drawBase(cx, cz);
      redraw = true;
    }
    this.accum += dt;
    if (this.accum > 0.1) redraw = true;
    if (!redraw) return;
    this.accum = 0;

    const ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0);
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;
    // Cows in this chunk
    ctx.fillStyle = '#ff9a3c';
    ctx.strokeStyle = '#3b1d0a';
    for (const c of cows) {
      const lx = c.x - ox;
      const lz = c.z - oz;
      if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) continue;
      ctx.beginPath();
      ctx.arc(lx * PX, lz * PX, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Player arrow (yaw 0 faces -z which is "up" on the map)
    const px = (pos[0] - ox) * PX;
    const pz = (pos[2] - oz) * PX;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
