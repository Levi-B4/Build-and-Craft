// Runtime-generated, minimally textured block atlas (4x4 tiles of 16px).
import * as THREE from 'three';
import { ATLAS_COLS, TILE } from '../world/blocks.js';
import { mulberry32 } from '../world/noise.js';

const T = 16;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Fill tile with base colour plus per-pixel brightness noise. */
function noiseTile(img, tile, base, amount, seed, alpha = 255) {
  const rnd = mulberry32(seed);
  const [r, g, b] = hex(base);
  forEachPixel(img, tile, (px, py, set) => {
    const k = 1 + (rnd() - 0.5) * amount;
    set(r * k, g * k, b * k, alpha);
  });
}

function forEachPixel(img, tile, fn) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const W = ATLAS_COLS * T;
  for (let py = 0; py < T; py++) {
    for (let px = 0; px < T; px++) {
      const i = ((row * T + py) * W + col * T + px) * 4;
      fn(px, py, (r, g, b, a = 255) => {
        img.data[i] = Math.max(0, Math.min(255, r));
        img.data[i + 1] = Math.max(0, Math.min(255, g));
        img.data[i + 2] = Math.max(0, Math.min(255, b));
        img.data[i + 3] = a;
      }, i);
    }
  }
}

function paintAtlas(ctx) {
  const W = ATLAS_COLS * T;
  const img = ctx.createImageData(W, W);

  noiseTile(img, TILE.GRASS_TOP, '#5d9e48', 0.25, 1);
  noiseTile(img, TILE.DIRT, '#866043', 0.3, 2);
  noiseTile(img, TILE.STONE, '#8c8c8c', 0.18, 3);
  noiseTile(img, TILE.SAND, '#dccf93', 0.12, 5);
  noiseTile(img, TILE.WATER, '#3d6fd6', 0.12, 6, 170);
  noiseTile(img, TILE.LEAVES, '#3b7a2c', 0.45, 9);
  noiseTile(img, TILE.BEDROCK, '#3a3a3a', 0.7, 15);

  // Grass side: dirt with a ragged green top
  {
    const rnd = mulberry32(11);
    const edge = Array.from({ length: T }, () => 3 + Math.floor(rnd() * 3));
    const [gr, gg, gb] = hex('#5d9e48');
    const [dr, dg, db] = hex('#866043');
    forEachPixel(img, TILE.GRASS_SIDE, (px, py, set) => {
      const k = 1 + (rnd() - 0.5) * 0.28;
      if (py < edge[px]) set(gr * k, gg * k, gb * k);
      else set(dr * k, dg * k, db * k);
    });
  }
  // Cobblestone: stones with dark mortar lines
  {
    const rnd = mulberry32(4);
    forEachPixel(img, TILE.COBBLESTONE, (px, py, set) => {
      const mortar = (py % 5 === 0) || ((px + (Math.floor(py / 5) % 2) * 3) % 6 === 0);
      const base = mortar ? 70 : 125;
      const k = 1 + (rnd() - 0.5) * 0.25;
      set(base * k, base * k, base * k);
    });
  }
  // Log side: vertical bark stripes
  {
    const rnd = mulberry32(7);
    forEachPixel(img, TILE.LOG_SIDE, (px, py, set) => {
      const k = (px % 4 === 0 ? 0.75 : 1) * (1 + (rnd() - 0.5) * 0.2);
      set(107 * k, 79 * k, 44 * k);
    });
  }
  // Log top: rings
  forEachPixel(img, TILE.LOG_TOP, (px, py, set) => {
    const d = Math.hypot(px - 7.5, py - 7.5);
    if (d > 6.5) set(107, 79, 44);
    else {
      const k = Math.floor(d) % 2 ? 0.88 : 1;
      set(184 * k, 146 * k, 92 * k);
    }
  });
  // Planks: horizontal boards
  {
    const rnd = mulberry32(10);
    forEachPixel(img, TILE.PLANKS, (px, py, set) => {
      const seam = py % 4 === 3 || (px === ((Math.floor(py / 4) * 7) % 16) && true);
      const k = (seam ? 0.72 : 1) * (1 + (rnd() - 0.5) * 0.12);
      set(184 * k, 146 * k, 90 * k);
    });
  }
  // Glass: transparent with light frame and a glint
  forEachPixel(img, TILE.GLASS, (px, py, set) => {
    const frame = px === 0 || py === 0 || px === T - 1 || py === T - 1;
    const glint = (px - py === 4 || px - py === 6) && px > 3 && px < 12;
    if (frame) set(220, 240, 245, 255);
    else if (glint) set(255, 255, 255, 140);
    else set(200, 232, 240, 40);
  });
  // Brick
  {
    const rnd = mulberry32(12);
    forEachPixel(img, TILE.BRICK, (px, py, set) => {
      const row = Math.floor(py / 4);
      const mortar = py % 4 === 3 || (px + (row % 2) * 4) % 8 === 7;
      const k = 1 + (rnd() - 0.5) * 0.15;
      if (mortar) set(200 * k, 195 * k, 185 * k);
      else set(162 * k, 75 * k, 58 * k);
    });
  }
  // Crafting table top: planks with a grid
  {
    const rnd = mulberry32(13);
    forEachPixel(img, TILE.TABLE_TOP, (px, py, set) => {
      const border = px < 2 || py < 2 || px > 13 || py > 13;
      const grid = px % 5 === 2 || py % 5 === 2;
      const k = 1 + (rnd() - 0.5) * 0.12;
      if (border) set(107 * k, 79 * k, 44 * k);
      else if (grid) set(90 * k, 64 * k, 36 * k);
      else set(184 * k, 146 * k, 90 * k);
    });
  }
  // Crafting table side: planks with tools silhouette
  {
    const rnd = mulberry32(14);
    forEachPixel(img, TILE.TABLE_SIDE, (px, py, set) => {
      const k = 1 + (rnd() - 0.5) * 0.12;
      const top = py < 3;
      const tool = (px === 4 && py > 4 && py < 13) || (py === 5 && px > 2 && px < 7) || (px === 11 && py > 4 && py < 13) || (px > 9 && px < 13 && py > 4 && py < 7);
      if (top) set(107 * k, 79 * k, 44 * k);
      else if (tool) set(70 * k, 70 * k, 70 * k);
      else set(160 * k, 120 * k, 72 * k);
    });
  }
  ctx.putImageData(img, 0, 0);
}

let atlasCanvas = null;
let atlasURL = null;

export function getAtlasCanvas() {
  if (!atlasCanvas) {
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = atlasCanvas.height = ATLAS_COLS * T;
    paintAtlas(atlasCanvas.getContext('2d'));
  }
  return atlasCanvas;
}

export function createAtlasTexture() {
  const tex = new THREE.CanvasTexture(getAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** CSS background for an item icon (side tile). */
export function iconStyle(tile) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  return {
    backgroundImage: `url(${(atlasURL ||= getAtlasCanvas().toDataURL())})`,
    backgroundSize: `${ATLAS_COLS * 100}% ${ATLAS_COLS * 100}%`,
    backgroundPosition: `${(col / (ATLAS_COLS - 1)) * 100}% ${(row / (ATLAS_COLS - 1)) * 100}%`,
  };
}
