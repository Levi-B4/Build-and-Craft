// Voxel DDA raycast (Amanatides & Woo). Pure module.
import { AIR, WATER } from '../world/blocks.js';

const defaultIsTarget = (id) => id !== AIR && id !== WATER;

/**
 * Cast a ray through the voxel grid.
 * @param {(x:number,y:number,z:number)=>number} getBlock
 * @param {number[]} origin [x, y, z]
 * @param {number[]} dir direction (need not be normalised)
 * @param {number} maxDist
 * @param {(id:number)=>boolean} [isTarget] which blocks stop the ray (default: anything but air/water)
 * @returns {{x:number,y:number,z:number,id:number,normal:number[],dist:number}|null}
 */
export function raycast(getBlock, origin, dir, maxDist, isTarget = defaultIsTarget) {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len === 0) return null;
  const dx = dir[0] / len;
  const dy = dir[1] / len;
  const dz = dir[2] / len;

  let x = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  const frac = (v, s) => (s > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v));
  let tMaxX = dx !== 0 ? frac(origin[0], dx) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? frac(origin[1], dy) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? frac(origin[2], dz) * tDeltaZ : Infinity;

  let normal = [0, 0, 0];
  let t = 0;
  // Starting block counts too (e.g. camera inside a leaf block)
  while (t <= maxDist) {
    const id = getBlock(x, y, z);
    if (isTarget(id)) return { x, y, z, id, normal, dist: t };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, -stepZ];
    }
  }
  return null;
}
