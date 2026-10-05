// Crafting panel: a flat list of recipes, craft buttons enabled when inputs are available.
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
          <h2>Crafting</h2>
          <button class="close-btn" aria-label="Close">&times;</button>
        </div>
        <ul class="recipe-list"></ul>
        <p class="hint">Gather blocks by breaking them, then combine them here. Press E to close.</p>
      </div>`;
    this.list = root.querySelector('.recipe-list');
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

  refresh() {
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
