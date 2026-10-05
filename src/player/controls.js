// Desktop mouse + keyboard input with pointer lock.

const MAX_MOUSE_DELTA = 200; // ignore pointer-lock spikes
const SENSITIVITY = 0.0025;

export class DesktopControls {
  /**
   * @param {HTMLElement} canvas
   * @param {object} game callbacks: look(dx,dy), breakBlock(), placeBlock(), selectSlot(i), scrollSlot(d),
   *   toggleCrafting(), onLockChange(locked), isPlaying()
   */
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.keys = new Set();
    this.locked = false;

    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      game.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => game.onLockChange(false));

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      if (Math.abs(dx) > MAX_MOUSE_DELTA || Math.abs(dy) > MAX_MOUSE_DELTA) return;
      game.look(-dx * SENSITIVITY, -dy * SENSITIVITY);
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      if (e.button === 0) game.breakBlock();
      else if (e.button === 2) game.placeBlock();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.locked) return;
        game.scrollSlot(e.deltaY > 0 ? 1 : -1);
      },
      { passive: true },
    );
  }

  /** Must be called from a user gesture. */
  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => this.game.onLockChange(false));
    } catch {
      this.game.onLockChange(false);
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code;
    if (down) {
      if (code === 'KeyE') {
        if (!e.repeat) this.game.toggleCrafting();
        e.preventDefault();
        return;
      }
      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5));
        if (n >= 1 && n <= 9) this.game.selectSlot(n - 1);
      }
      if (code === 'Space' && this.locked) e.preventDefault();
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  /** Movement input contribution. */
  input() {
    const k = this.keys;
    if (!this.locked) return { forward: 0, right: 0, jump: false, sprint: false };
    return {
      forward: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0),
      right: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0),
      jump: k.has('Space'),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
    };
  }
}
