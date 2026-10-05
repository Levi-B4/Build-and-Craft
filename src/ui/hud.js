// Crosshair, hotbar and short status messages.
import { BLOCKS, blockName } from '../world/blocks.js';
import { iconStyle } from '../render/textures.js';
import { HOTBAR_SIZE } from '../inventory/inventory.js';

export function applyIcon(el, id) {
  if (id == null) {
    el.style.backgroundImage = '';
    return;
  }
  Object.assign(el.style, iconStyle(BLOCKS[id].tiles[1]));
}

export class Hud {
  constructor(root, inventory, onSelect) {
    this.inventory = inventory;
    root.innerHTML = `
      <div class="crosshair"></div>
      <div class="hotbar"></div>
      <div class="item-label"></div>
      <div class="toast"></div>
    `;
    this.hotbarEl = root.querySelector('.hotbar');
    this.labelEl = root.querySelector('.item-label');
    this.toastEl = root.querySelector('.toast');
    this.slots = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `<div class="slot-icon"></div><span class="slot-count"></span><span class="slot-key">${i + 1}</span>`;
      const pick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(i);
      };
      slot.addEventListener('touchstart', pick, { passive: false });
      slot.addEventListener('mousedown', pick);
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    }
    this.labelTimer = null;
    this.toastTimer = null;
    this.lastSelected = -1;
    inventory.onChange(() => this.render());
    this.render();
  }

  setInventory(inventory) {
    this.inventory = inventory;
    inventory.onChange(() => this.render());
    this.render();
  }

  render() {
    const inv = this.inventory;
    this.slots.forEach((slot, i) => {
      const id = inv.hotbar[i];
      applyIcon(slot.querySelector('.slot-icon'), id);
      slot.querySelector('.slot-count').textContent = id != null ? inv.count(id) : '';
      slot.classList.toggle('selected', i === inv.selected);
      slot.title = id != null ? blockName(id) : '';
    });
    if (inv.selected !== this.lastSelected) {
      this.lastSelected = inv.selected;
      const id = inv.hotbar[inv.selected];
      this.showLabel(id != null ? blockName(id) : '');
    }
  }

  showLabel(text) {
    this.labelEl.textContent = text;
    this.labelEl.classList.toggle('show', !!text);
    clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => this.labelEl.classList.remove('show'), 1500);
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }
}
