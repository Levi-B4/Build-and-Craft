// Inventory & crafting panel: every owned item (click to put it in the selected hotbar slot)
// plus a flat list of recipes, craft buttons enabled when inputs are available.
import { RECIPES, canCraft, craft } from './recipes.js';
import { blockName } from '../world/blocks.js';
import { applyIcon } from '../ui/hud.js';

export class CraftingUI {
  constructor(root, inventory, { onCraft, onClose }) {
    this.root = root;
    this.inventory = inventory;
    this.onCraft = onCraft;
    root.innerHTML = `
      <div class="panel crafting-panel">
        <div class="panel-header">
          <h2>Inventory</h2>
          <button class="close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="inv-grid"></div>
        <p class="hint">Click or tap an item to put it in the selected hotbar slot.</p>
        <h3 class="panel-sub">Crafting</h3>
        <ul class="recipe-list"></ul>
        <p class="hint">Gather blocks by breaking them, then combine them here. Press E to close.</p>
      </div>`;
    this.list = root.querySelector('.recipe-list');
    this.grid = root.querySelector('.inv-grid');
    this.grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.inv-item');
      if (!cell) return;
      e.preventDefault();
      e.stopPropagation();
      this.inventory.assignToSelected(Number(cell.dataset.id));
    });
    const close = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    root.querySelector('.close-btn').addEventListener('click', close);
    root.addEventListener('click', (e) => {
      if (e.target === root) close(e);
    });
    this.rows = RECIPES.map((r) => this.makeRow(r));
    inventory.onChange(() => this.refresh());
    this.refresh();
  }

  setInventory(inventory) {
    this.inventory = inventory;
    inventory.onChange(() => this.refresh());
    this.refresh();
  }

  makeRow(recipe) {
    const li = document.createElement('li');
    li.className = 'recipe';
    const item = (id, n) => `<span class="ingredient" data-id="${id}"><span class="icon"></span><span class="qty">${n}&times;</span> ${blockName(id)}</span>`;
    li.innerHTML = `
      <div class="recipe-io">
        <span class="inputs">${recipe.inputs.map(([id, n]) => item(id, n)).join('<span class="plus">+</span>')}</span>
        <span class="arrow">&rarr;</span>
        <span class="output">${item(recipe.output[0], recipe.output[1])}</span>
      </div>
      <button class="craft-btn" data-recipe="${recipe.id}">Craft</button>`;
    for (const el of li.querySelectorAll('.ingredient')) applyIcon(el.querySelector('.icon'), Number(el.dataset.id));
    const btn = li.querySelector('.craft-btn');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (craft(this.inventory, recipe)) this.onCraft(recipe);
    });
    this.list.appendChild(li);
    return { recipe, li, btn };
  }

  renderGrid() {
    const inv = this.inventory;
    const ids = Object.keys(inv.counts).map(Number).sort((a, b) => a - b);
    const selectedId = inv.hotbar[inv.selected];
    this.grid.innerHTML = ids.length ? '' : '<p class="inv-empty">Nothing yet. Break some blocks!</p>';
    for (const id of ids) {
      const cell = document.createElement('button');
      cell.className = 'inv-item';
      cell.dataset.id = id;
      cell.title = blockName(id);
      cell.classList.toggle('on-hotbar', inv.hotbar.includes(id));
      cell.classList.toggle('selected', id === selectedId);
      cell.innerHTML = `<span class="icon"></span><span class="inv-count">${inv.count(id)}</span><span class="inv-name">${blockName(id)}</span>`;
      applyIcon(cell.querySelector('.icon'), id);
      this.grid.appendChild(cell);
    }
  }

  refresh() {
    this.renderGrid();
    for (const { recipe, li, btn } of this.rows) {
      const ok = canCraft(this.inventory, recipe);
      btn.disabled = !ok;
      li.classList.toggle('available', ok);
      for (const el of li.querySelectorAll('.inputs .ingredient')) {
        const id = Number(el.dataset.id);
        const need = recipe.inputs.find(([i]) => i === id)[1];
        el.classList.toggle('missing', !this.inventory.has(id, need));
      }
    }
  }

  get isOpen() {
    return this.root.classList.contains('open');
  }

  open() {
    this.refresh();
    this.root.classList.add('open');
  }

  close() {
    this.root.classList.remove('open');
  }
}
