// Headless-Chrome smoke test: builds must exist (run `npm run build` first).
// Usage: node scripts/smoke.js [screenshotDir]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { KnownDevices } from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const OUT = path.resolve(process.argv[2] || 'screenshots');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  -- ' + info : ''}`);
}

async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server did not start')), 20000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes(String(PORT))) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on('exit', (code) => reject(new Error('preview exited ' + code)));
  });
  return proc;
}

function watchErrors(page, label, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${label}] pageerror: ${err.message}`));
}

async function waitForChunks(page, min = 1, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const n = await page.evaluate(() => (window.__game ? window.__game.stats.chunkMeshes : 0));
    if (n >= min) return n;
    await sleep(250);
  }
  return page.evaluate(() => (window.__game ? window.__game.stats.chunkMeshes : 0));
}

async function main() {
  const server = await startPreview();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--window-size=1280,720',
    ],
  });
  const errors = [];
  try {
    // ---------------- Desktop ----------------
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    watchErrors(page, 'desktop', errors);
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(URL, { waitUntil: 'load' });
    await sleep(3000);
    const chunks = await waitForChunks(page, 1);
    check('desktop: chunk meshes loaded after ~3s', chunks > 0, `${chunks} chunk meshes`);
    await page.screenshot({ path: path.join(OUT, 'desktop-menu.png') });

    // Start playing. Pointer lock is unreliable headless, so fall back to the touch-style resume.
    await page.click('.play-btn');
    await sleep(800);
    let playing = await page.evaluate(() => window.__game.playing);
    if (!playing) {
      await page.evaluate(() => {
        window.__game.mode = 'touch';
        window.__game.resume();
      });
      playing = await page.evaluate(() => window.__game.playing);
    }
    check('desktop: game starts playing', playing);
    const full = await waitForChunks(page, 45, 40000);
    await sleep(1500);
    check('desktop: render distance filled', full >= 45, `${full} chunk meshes`);
    const info = await page.evaluate(() => {
      const g = window.__game;
      return {
        stats: g.stats,
        minimapVisible: !!document.querySelector('#minimap canvas')?.getBoundingClientRect().width,
        hotbarSlots: document.querySelectorAll('.hotbar .slot').length,
        crosshair: !!document.querySelector('.crosshair')?.getBoundingClientRect().width,
        touchUI: getComputedStyle(document.getElementById('touch')).display,
      };
    });
    check('desktop: HUD present (minimap, 9 hotbar slots, crosshair)', info.minimapVisible && info.hotbarSlots === 9 && info.crosshair);
    check('desktop: touch UI hidden on desktop', info.touchUI === 'none', JSON.stringify(info.stats.input));
    console.log('       stats:', JSON.stringify(info.stats));
    await page.screenshot({ path: path.join(OUT, 'desktop-game.png') });

    // Break a block in front of the player, then place it back
    const action = await page.evaluate(() => {
      const g = window.__game;
      g.player.pitch = -0.9;
      const before = Object.values(g.inventory.counts).reduce((a, b) => a + b, 0);
      const target = g.updateTarget();
      const broke = g.breakBlock();
      const after = Object.values(g.inventory.counts).reduce((a, b) => a + b, 0);
      const placed = g.placeBlock();
      const afterPlace = Object.values(g.inventory.counts).reduce((a, b) => a + b, 0);
      return { target: target && [target.x, target.y, target.z, target.id], broke, before, after, placed, afterPlace };
    });
    check('desktop: breaking a block adds it to the inventory', action.broke && action.after === action.before + 1, JSON.stringify(action));
    check('desktop: placing a block uses it from the inventory', action.placed && action.afterPlace === action.after - 1);

    // Crafting panel
    await page.evaluate(() => {
      const g = window.__game;
      g.player.pitch = 0;
      g.inventory.add(7, 3); // logs
      g.inventory.add(5, 4); // sand
      g.inventory.add(2, 2); // dirt
      g.toggleCrafting();
    });
    await sleep(300);
    const craftOpen = await page.evaluate(() => document.getElementById('crafting').classList.contains('open'));
    check('crafting: panel opens', craftOpen);
    await page.click('.craft-btn[data-recipe="planks"]');
    const planks = await page.evaluate(() => window.__game.inventory.count(9));
    check('crafting: clicking Craft produces planks', planks === 4, `planks=${planks}`);
    const disabled = await page.evaluate(() => document.querySelector('.craft-btn[data-recipe="stone"]').disabled);
    check('crafting: recipe without inputs is disabled', disabled);
    await page.screenshot({ path: path.join(OUT, 'crafting.png') });
    await page.evaluate(() => window.__game.toggleCrafting());

    // Cows + moo: walk the player up to a cow and look at it
    const cowInfo = await page.evaluate(async () => {
      const g = window.__game;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 40 && g.cows.cows.length === 0; i++) await wait(250);
      const cow = g.cows.cows[0];
      if (!cow) return { cows: 0 };
      // Stand 5 blocks south of the cow on the surface, facing it (-z)
      const px = Math.floor(cow.x);
      const pz = Math.floor(cow.z + 5);
      const top = g.world.topBlockY(px, pz);
      g.player.pos = [px + 0.5, top + 1, pz + 0.5];
      g.player.vel = [0, 0, 0];
      g.player.yaw = Math.atan2(-(cow.x - px - 0.5), -(cow.z - pz - 0.5));
      g.player.pitch = -0.15;
      for (const c of g.cows.cows) { c.mode = 'idle'; c.timer = 30; }
      await wait(2500);
      return { cows: g.cows.cows.length, stats: g.cows.stats, audio: g.audio.ctx ? g.audio.ctx.state : 'none' };
    });
    check('cows: spawned', cowInfo.cows > 0, JSON.stringify(cowInfo));
    check('cows: moo triggered when a cow is on screen', cowInfo.stats && cowInfo.stats.mooTriggers > 0);
    await page.screenshot({ path: path.join(OUT, 'cow.png') });

    // Persistence: edit a block, save, reload
    const marker = await page.evaluate(() => {
      const g = window.__game;
      const x = Math.floor(g.player.pos[0]) + 2;
      const z = Math.floor(g.player.pos[2]);
      g.world.setBlock(x, 60, z, 11); // brick in the sky
      g.saveNow();
      return { x, z, inv: g.inventory.count(9) };
    });
    await page.reload({ waitUntil: 'load' });
    await waitForChunks(page, 1);
    const persisted = await page.evaluate((m) => {
      const g = window.__game;
      return { block: g.world.getBlock(m.x, 60, m.z), planks: g.inventory.count(9) };
    }, marker);
    check('save: block edit persists across reload', persisted.block === 11, JSON.stringify(persisted));
    check('save: inventory persists across reload', persisted.planks === marker.inv);
    await ctx.close();

    // ---------------- Mobile ----------------
    const mctx = await browser.createBrowserContext();
    const mpage = await mctx.newPage();
    watchErrors(mpage, 'mobile', errors);
    await mpage.emulate(KnownDevices['iPhone 13']);
    await mpage.goto(URL, { waitUntil: 'load' });
    await waitForChunks(mpage, 1);
    const minput = await mpage.evaluate(() => window.__game.stats.input);
    check('mobile: touch input detected', minput.touch === true, JSON.stringify(minput));
    await mpage.tap('.play-btn');
    await sleep(500);
    const mstate = await mpage.evaluate(() => {
      const j = document.getElementById('joystick');
      const r = j ? j.getBoundingClientRect() : { width: 0 };
      return { playing: window.__game.playing, joystick: r.width > 0, buttons: document.querySelectorAll('.tbtn').length };
    });
    check('mobile: playing after tap', mstate.playing);
    check('mobile: joystick + buttons visible', mstate.joystick && mstate.buttons >= 4, JSON.stringify(mstate));
    await waitForChunks(mpage, 25, 40000);
    await sleep(1500);
    // Drive the joystick a little and check the player moved
    const before = await mpage.evaluate(() => window.__game.player.pos.slice());
    const jb = await mpage.evaluate(() => {
      const r = document.getElementById('joystick').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const cdp = await mpage.createCDPSession();
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', jb.x, jb.y);
    await touch('touchMove', jb.x, jb.y - 45);
    await sleep(1200);
    await touch('touchEnd');
    const after = await mpage.evaluate(() => window.__game.player.pos.slice());
    const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
    check('mobile: joystick moves the player', moved > 0.5, `moved ${moved.toFixed(2)} blocks`);
    await mpage.screenshot({ path: path.join(OUT, 'mobile.png') });
    await mctx.close();
  } finally {
    await browser.close();
    server.kill();
  }

  check('no console errors / page errors', errors.length === 0, errors.join('\n'));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
