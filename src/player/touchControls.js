// Mobile touch controls: left virtual joystick, drag-to-look on the right, action buttons.

const LOOK_SENSITIVITY = 0.006;
const JOY_RADIUS = 50;

export class TouchControls {
  /**
   * @param {HTMLElement} root container for the touch UI
   * @param {HTMLElement} lookSurface element receiving look drags (the canvas)
   * @param {object} game callbacks: look, breakBlock, placeBlock, toggleCrafting, pause, isPlaying
   */
  constructor(root, lookSurface, game) {
    this.game = game;
    this.move = { x: 0, y: 0 };
    this.jump = false;
    this.joyId = null;
    this.lookId = null;
    this.lookLast = null;

    root.innerHTML = `
      <div class="joystick" id="joystick"><div class="joystick-knob"></div></div>
      <div class="touch-buttons">
        <button class="tbtn" data-act="craft">Items</button>
        <button class="tbtn" data-act="place">Place</button>
        <button class="tbtn" data-act="break">Break</button>
        <button class="tbtn tbtn-jump" data-act="jump">Jump</button>
      </div>
      <button class="tbtn tbtn-pause" data-act="pause" aria-label="Pause">II</button>
    `;
    this.joystick = root.querySelector('#joystick');
    this.knob = root.querySelector('.joystick-knob');
    const opts = { passive: false };

    // Joystick
    this.joystick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.joyId !== null) return;
      const t = e.changedTouches[0];
      this.joyId = t.identifier;
      this.updateJoy(t);
    }, opts);
    const joyMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          e.preventDefault();
          this.updateJoy(t);
        }
      }
    };
    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyId = null;
          this.move.x = this.move.y = 0;
          this.knob.style.transform = 'translate(-50%, -50%)';
        }
      }
    };
    window.addEventListener('touchmove', joyMove, opts);
    window.addEventListener('touchend', joyEnd);
    window.addEventListener('touchcancel', joyEnd);

    // Look drag on the canvas
    lookSurface.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.lookId !== null) return;
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      this.lookLast = [t.clientX, t.clientY];
    }, opts);
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.lookId) continue;
        e.preventDefault();
        const dx = t.clientX - this.lookLast[0];
        const dy = t.clientY - this.lookLast[1];
        this.lookLast = [t.clientX, t.clientY];
        if (game.isPlaying()) game.look(-dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
      }
    }, opts);
    const lookEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.lookId) this.lookId = null;
    };
    window.addEventListener('touchend', lookEnd);
    window.addEventListener('touchcancel', lookEnd);

    // Buttons
    for (const btn of root.querySelectorAll('.tbtn')) {
      const act = btn.dataset.act;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('active');
        if (act === 'jump') this.jump = true;
        else if (act === 'break') game.breakBlock();
        else if (act === 'place') game.placeBlock();
        else if (act === 'craft') game.toggleCrafting();
        else if (act === 'pause') game.pause();
      }, opts);
      const end = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        if (act === 'jump') this.jump = false;
      };
      btn.addEventListener('touchend', end, opts);
      btn.addEventListener('touchcancel', end, opts);
    }
  }

  updateJoy(t) {
    const r = this.joystick.getBoundingClientRect();
    let dx = t.clientX - (r.left + r.width / 2);
    let dy = t.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    this.move.x = dx / JOY_RADIUS;
    this.move.y = dy / JOY_RADIUS;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  input() {
    return { forward: -this.move.y, right: this.move.x, jump: this.jump, sprint: Math.hypot(this.move.x, this.move.y) > 0.95 };
  }
}
