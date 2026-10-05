// Start / pause menu with "new world" (optional seed) support.

export class Menu {
  constructor(root, { touch, onPlay, onNewWorld }) {
    this.root = root;
    const playLabel = touch ? 'Tap to play' : 'Click to play';
    root.innerHTML = `
      <div class="panel menu-panel">
        <h1>Build and Craft</h1>
        <p class="menu-sub"></p>
        <button class="play-btn">${playLabel}</button>
        <div class="controls-help">
          ${touch ? `
          <p><b>Left stick</b> move &middot; <b>drag right side</b> look</p>
          <p><b>Break</b> / <b>Place</b> act on the block in the crosshair</p>
          <p><b>Items</b> opens inventory &amp; crafting &middot; tap the hotbar to pick a block</p>` : `
          <p><b>WASD</b> move &middot; <b>Space</b> jump &middot; <b>Shift</b> sprint</p>
          <p><b>Left click</b> break &middot; <b>Right click</b> place</p>
          <p><b>1-9 / wheel</b> select &middot; <b>E</b> inventory &amp; crafting &middot; <b>Esc</b> pause</p>`}
        </div>
        <details class="new-world">
          <summary>New world</summary>
          <div class="new-world-row">
            <input type="text" class="seed-input" placeholder="Seed (optional)" maxlength="32" />
            <button class="new-btn">Create</button>
          </div>
          <p class="warn">This replaces your current saved world.</p>
        </details>
      </div>`;
    this.sub = root.querySelector('.menu-sub');
    this.playBtn = root.querySelector('.play-btn');
    this.playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onPlay(e.pointerType === 'touch');
    });
    root.querySelector('.new-btn').addEventListener('click', (e) => {
      e.preventDefault();
      const seed = root.querySelector('.seed-input').value.trim();
      root.querySelector('.new-world').open = false;
      onNewWorld(seed);
    });
  }

  setInfo(text) {
    this.sub.textContent = text;
  }

  setPlayLabel(text) {
    this.playBtn.textContent = text;
  }

  show() {
    this.root.classList.add('open');
  }

  hide() {
    this.root.classList.remove('open');
  }

  get isOpen() {
    return this.root.classList.contains('open');
  }
}
