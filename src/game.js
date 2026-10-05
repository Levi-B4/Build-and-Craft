// Game: wires world, rendering, player, input, cows, UI and saving together.
import * as THREE from 'three';
import {
  WORLD_SIZE, HEIGHT, REACH, RENDER_DISTANCE_DESKTOP, RENDER_DISTANCE_MOBILE, CHUNK_SIZE, AUTOSAVE_INTERVAL,
} from './config.js';
import { World } from './world/world.js';
import { ChunkManager } from './world/chunkManager.js';
import { AIR, WATER, BLOCKS, dropOf, blockName } from './world/blocks.js';
import { seedFromString } from './world/noise.js';
import { createAtlasTexture } from './render/textures.js';
import { Player } from './player/player.js';
import { raycast } from './player/raycast.js';
import { DesktopControls } from './player/controls.js';
import { TouchControls } from './player/touchControls.js';
import { Inventory } from './inventory/inventory.js';
import { CraftingUI } from './crafting/craftingUI.js';
import { CowManager } from './mobs/cowManager.js';
import { MooAudio } from './audio/moo.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Menu } from './ui/menu.js';
import { saveToStorage, loadFromStorage } from './save/save.js';

const SKY = 0x8ec9f2;

function detectInput() {
  const mq = (q) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const coarse = mq('(pointer: coarse)') || mq('(any-pointer: coarse)');
  const fine = mq('(any-pointer: fine)');
  const touch = hasTouch && coarse;
  // Touch laptops get both schemes; pure touch devices only get touch.
  const desktop = !touch || fine;
  return { touch, desktop, touchOnly: touch && !desktop };
}

export class Game {
  constructor(dom) {
    this.dom = dom;
    this.input = detectInput();
    document.body.classList.toggle('touch', this.input.touch);
    this.playing = false;
    this.mode = this.input.touchOnly ? 'touch' : 'mouse';
    this.resetting = false;
    this.started = false;

    // --- Load or create world state ---
    const save = loadFromStorage(window.localStorage);
    const seed = save ? save.seed : (Math.random() * 2 ** 31) >>> 0;
    this.world = new World({ seed, modifications: save ? save.modifications : {} });
    this.inventory = Inventory.fromJSON(save && save.inventory);

    // --- Three.js setup ---
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    dom.app.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    const rd = this.input.touchOnly ? RENDER_DISTANCE_MOBILE : RENDER_DISTANCE_DESKTOP;
    this.scene.fog = new THREE.Fog(SKY, rd * CHUNK_SIZE * 0.55, rd * CHUNK_SIZE);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, rd * CHUNK_SIZE * 1.5);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a40, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    this.atlas = createAtlasTexture();
    this.chunks = new ChunkManager(this.world, this.scene, this.atlas, rd);

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.target = null;

    // --- Player ---
    this.player = new Player(this.world);
    const p = save && save.player;
    if (p && [p.x, p.y, p.z].every(Number.isFinite)) {
      this.player.pos = [p.x, p.y, p.z];
      this.player.yaw = p.yaw || 0;
      this.player.pitch = p.pitch || 0;
    } else {
      this.player.spawnAt(WORLD_SIZE / 2, WORLD_SIZE / 2);
    }

    // --- Mobs & audio ---
    this.audio = new MooAudio();
    this.cows = new CowManager(this.world, this.scene, this.chunks, this.audio);
    this.chunks.onChunkLoaded = (cx, cz) => this.cows.onChunkLoaded(cx, cz);

    // --- UI ---
    this.hud = new Hud(dom.hud, this.inventory, (i) => this.selectSlot(i));
    this.minimap = new Minimap(dom.minimap, this.world);
    this.crafting = new CraftingUI(dom.crafting, this.inventory, {
      onCraft: (r) => {
        this.hud.toast(`Crafted ${r.output[1]} ${blockName(r.output[0])}`);
        this.markDirty();
      },
      onClose: () => this.toggleCrafting(),
    });
    this.menu = new Menu(dom.menu, {
      touch: this.input.touchOnly,
      onPlay: (viaTouch) => this.play(viaTouch),
      onNewWorld: (seedText) => this.newWorld(seedText),
    });
    this.menu.setInfo(`Seed ${this.world.seed} · ${save ? 'saved world loaded' : 'new world'} · autosaves`);
    if (save) this.menu.setPlayLabel(this.input.touchOnly ? 'Tap to continue' : 'Click to continue');
    this.menu.show();

    // --- Input ---
    const callbacks = {
      look: (dx, dy) => this.look(dx, dy),
      breakBlock: () => this.breakBlock(),
      placeBlock: () => this.placeBlock(),
      selectSlot: (i) => this.selectSlot(i),
      scrollSlot: (d) => this.selectSlot(this.inventory.selected + d),
      toggleCrafting: () => this.toggleCrafting(),
      onLockChange: (locked) => this.onLockChange(locked),
      pause: () => this.pause(),
      isPlaying: () => this.playing && !this.crafting.isOpen,
    };
    this.desktop = this.input.desktop ? new DesktopControls(this.canvas, callbacks) : null;
    this.touch = this.input.touch ? new TouchControls(dom.touch, this.canvas, callbacks) : null;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.crafting.isOpen) this.toggleCrafting();
    });
    // Unlock audio on the first gesture of any kind
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchend', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // --- Saving ---
    this.dirty = false;
    this.saveTimer = setInterval(() => this.saveNow(), AUTOSAVE_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveNow();
        if (this.mode === 'touch' && this.playing) this.pause();
      }
    });
    window.addEventListener('pagehide', () => this.saveNow());
    this.world.onChange(() => this.markDirty());

    window.addEventListener('resize', () => this.onResize());

    // Build the nearest chunks right away so the first frame isn't empty
    this.chunks.update(this.player.pos[0], this.player.pos[2], 9);
    this.lastTime = performance.now();
    this.fps = 0;
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  // ---------------- state / menus ----------------

  play(viaTouch = false) {
    this.audio.unlock();
    this.started = true;
    if (this.input.touchOnly || viaTouch || !this.desktop) {
      this.mode = 'touch';
      this.resume();
    } else {
      this.mode = 'mouse';
      this.desktop.lock(); // resume happens on pointerlockchange
    }
  }

  resume() {
    this.playing = true;
    this.menu.hide();
    document.body.classList.add('playing');
  }

  pause() {
    this.playing = false;
    if (this.crafting.isOpen) this.crafting.close();
    this.menu.show();
    document.body.classList.remove('playing');
    if (this.desktop) this.desktop.unlock();
    this.saveNow();
  }

  onLockChange(locked) {
    if (locked) {
      this.mode = 'mouse';
      if (this.crafting.isOpen) this.crafting.close();
      this.resume();
    } else if (this.mode === 'mouse' && !this.crafting.isOpen && this.playing) {
      this.pause();
    } else if (this.mode === 'mouse' && !this.crafting.isOpen && !this.menu.isOpen) {
      this.menu.show(); // lock request failed
    }
  }

  toggleCrafting() {
    if (!this.playing) return;
    if (this.crafting.isOpen) {
      if (this.mode === 'mouse' && this.desktop) {
        this.crafting.close();
        this.desktop.lock();
      } else {
        this.crafting.close();
      }
    } else {
      this.crafting.open();
      if (this.mode === 'mouse' && this.desktop) this.desktop.unlock();
    }
  }

  newWorld(seedText) {
    const seed = seedText ? seedFromString(seedText) : (Math.random() * 2 ** 31) >>> 0;
    this.resetting = true;
    clearInterval(this.saveTimer);
    saveToStorage(window.localStorage, { seed, modifications: {}, player: null, inventory: null });
    window.location.reload();
  }

  // ---------------- actions ----------------

  look(dx, dy) {
    const p = this.player;
    p.yaw += dx;
    p.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, p.pitch + dy));
  }

  selectSlot(i) {
    this.inventory.select(i);
  }

  updateTarget() {
    const hit = raycast((x, y, z) => this.world.getBlock(x, y, z), this.player.eye(), this.player.lookDir(), REACH);
    // Never target the invisible world wall
    this.target = hit && hit.x >= 0 && hit.z >= 0 && hit.x < WORLD_SIZE && hit.z < WORLD_SIZE && hit.y >= 0 ? hit : null;
    return this.target;
  }

  canAct() {
    return this.playing && !this.crafting.isOpen;
  }

  breakBlock() {
    if (!this.canAct()) return false;
    const hit = this.updateTarget();
    if (!hit) return false;
    if (!BLOCKS[hit.id].breakable) {
      this.hud.toast(`${blockName(hit.id)} can't be broken`);
      return false;
    }
    this.world.setBlock(hit.x, hit.y, hit.z, AIR);
    const drop = dropOf(hit.id);
    if (drop != null) this.inventory.add(drop, 1);
    return true;
  }

  placeBlock() {
    if (!this.canAct()) return false;
    const hit = this.updateTarget();
    if (!hit) return false;
    const id = this.inventory.selectedItem();
    if (id == null) {
      this.hud.toast('Select a block in your hotbar first');
      return false;
    }
    const x = hit.x + hit.normal[0];
    const y = hit.y + hit.normal[1];
    const z = hit.z + hit.normal[2];
    if (y < 1 || y >= HEIGHT || x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return false;
    const cur = this.world.getBlock(x, y, z);
    if (cur !== AIR && cur !== WATER) return false;
    if (this.player.intersectsBlock(x, y, z) || this.cows.intersectsBlock(x, y, z)) return false;
    this.world.setBlock(x, y, z, id);
    this.inventory.remove(id, 1);
    return true;
  }

  // ---------------- saving ----------------

  markDirty() {
    this.dirty = true;
  }

  getState() {
    const p = this.player;
    const r = (v) => Math.round(v * 1000) / 1000;
    return {
      seed: this.world.seed,
      modifications: this.world.modifications,
      player: { x: r(p.pos[0]), y: r(p.pos[1]), z: r(p.pos[2]), yaw: r(p.yaw), pitch: r(p.pitch) },
      inventory: this.inventory.toJSON(),
    };
  }

  saveNow() {
    if (this.resetting) return false;
    this.dirty = false;
    return saveToStorage(window.localStorage, this.getState());
  }

  // ---------------- loop ----------------

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  collectInput() {
    const none = { forward: 0, right: 0, jump: false, sprint: false };
    if (!this.canAct()) return none;
    const a = this.desktop ? this.desktop.input() : none;
    const b = this.touch ? this.touch.input() : none;
    return {
      forward: Math.max(-1, Math.min(1, a.forward + b.forward)),
      right: Math.max(-1, Math.min(1, a.right + b.right)),
      jump: a.jump || b.jump,
      sprint: a.sprint || b.sprint,
    };
  }

  frame(t) {
    const dt = Math.min((t - this.lastTime) / 1000, 0.05);
    this.lastTime = t;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    const active = this.playing;
    if (active) this.player.update(dt, this.collectInput());
    const p = this.player;
    this.chunks.update(p.pos[0], p.pos[2]);

    const eye = p.eye();
    this.camera.position.set(eye[0], eye[1], eye[2]);
    this.camera.rotation.set(p.pitch, p.yaw, 0);
    this.dom.app.classList.toggle('underwater', this.world.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])) === WATER);

    if (active) this.cows.update(dt, this.camera, eye);

    const hit = this.updateTarget();
    this.highlight.visible = !!hit && active;
    if (hit) this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    this.minimap.update(dt, p.pos, p.yaw, this.cows.cows);
    this.renderer.render(this.scene, this.camera);
  }

  /** Small snapshot used by tests / debugging. */
  get stats() {
    return {
      seed: this.world.seed,
      chunkMeshes: this.chunks.loadedCount,
      queued: this.chunks.queue.length,
      cows: this.cows.cows.length,
      cowStats: { ...this.cows.stats },
      fps: Math.round(this.fps),
      playing: this.playing,
      pos: this.player.pos.map((v) => Math.round(v * 100) / 100),
      input: this.input,
    };
  }
}
