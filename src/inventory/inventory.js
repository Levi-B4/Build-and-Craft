// Inventory: item counts + a 9-slot hotbar. Pure module.

export const HOTBAR_SIZE = 9;

export class Inventory {
  constructor() {
    this.counts = {}; // itemId -> count
    this.hotbar = new Array(HOTBAR_SIZE).fill(null); // itemId | null
    this.selected = 0;
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  count(id) {
    return this.counts[id] || 0;
  }

  has(id, n = 1) {
    return this.count(id) >= n;
  }

  add(id, n = 1) {
    if (id == null || n <= 0) return;
    this.counts[id] = this.count(id) + n;
    if (!this.hotbar.includes(id)) {
      const free = this.hotbar.indexOf(null);
      if (free !== -1) this.hotbar[free] = id;
    }
    this.emit();
  }

  /** Remove n of id. Returns false (and changes nothing) if not enough. */
  remove(id, n = 1) {
    if (!this.has(id, n)) return false;
    const left = this.count(id) - n;
    if (left > 0) this.counts[id] = left;
    else {
      delete this.counts[id];
      const slot = this.hotbar.indexOf(id);
      if (slot !== -1) this.hotbar[slot] = null;
    }
    this.emit();
    return true;
  }

  select(slot) {
    this.selected = ((slot % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.emit();
  }

  /** Put an owned item into the selected hotbar slot, swapping if it is already on the hotbar. */
  assignToSelected(id) {
    if (!this.has(id)) return false;
    const from = this.hotbar.indexOf(id);
    if (from !== -1) this.hotbar[from] = this.hotbar[this.selected];
    this.hotbar[this.selected] = id;
    this.emit();
    return true;
  }

  selectedItem() {
    const id = this.hotbar[this.selected];
    return id != null && this.has(id) ? id : null;
  }

  /** Items that have a count but are not on the hotbar. */
  overflowItems() {
    return Object.keys(this.counts)
      .map(Number)
      .filter((id) => !this.hotbar.includes(id));
  }

  toJSON() {
    return { counts: { ...this.counts }, hotbar: [...this.hotbar], selected: this.selected };
  }

  static fromJSON(obj) {
    const inv = new Inventory();
    if (!obj) return inv;
    for (const [k, v] of Object.entries(obj.counts || {})) {
      if (v > 0) inv.counts[Number(k)] = v;
    }
    if (Array.isArray(obj.hotbar)) {
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const id = obj.hotbar[i];
        inv.hotbar[i] = id != null && inv.counts[id] > 0 ? id : null;
      }
    }
    // Make sure every owned item is reachable on the hotbar if space allows
    for (const id of inv.overflowItems()) {
      const free = inv.hotbar.indexOf(null);
      if (free !== -1) inv.hotbar[free] = id;
    }
    inv.selected = Number.isInteger(obj.selected) ? obj.selected % HOTBAR_SIZE : 0;
    return inv;
  }
}
