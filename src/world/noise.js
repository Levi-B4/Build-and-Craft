// Seeded PRNG + 2D value noise. Pure module, fully deterministic for a given seed.

/** mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of (seed, x, z[, salt]) -> uint32. Order-independent, stateless. */
export function hashInt(seed, x, z, salt = 0) {
  let h = (seed ^ Math.imul(salt + 1, 0x27d4eb2d)) >>> 0;
  h = Math.imul(h ^ Math.imul(x | 0, 0x85ebca6b), 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h ^ Math.imul(z | 0, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash to float in [0, 1). */
export function hash2(seed, x, z, salt = 0) {
  return hashInt(seed, x, z, salt) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0, 1). */
export function valueNoise2D(seed, x, z, salt = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const a = hash2(seed, x0, z0, salt);
  const b = hash2(seed, x0 + 1, z0, salt);
  const c = hash2(seed, x0, z0 + 1, salt);
  const d = hash2(seed, x0 + 1, z0 + 1, salt);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fz;
}

/** Fractal (fBm) value noise, normalised to [0, 1). */
export function fbm2D(seed, x, z, octaves = 3, salt = 0) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(seed, x * freq, z * freq, salt + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Turn an arbitrary string into a 32-bit seed (numeric strings map to themselves). */
export function seedFromString(str) {
  const s = String(str).trim();
  if (/^-?\d+$/.test(s)) return (parseInt(s, 10) >>> 0);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
