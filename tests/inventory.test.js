import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory/inventory.js';
import { RECIPES, canCraft, craft } from '../src/crafting/recipes.js';
import { serialize, deserialize, saveToStorage, loadFromStorage } from '../src/save/save.js';
import { World } from '../src/world/world.js';
import { LOG, PLANKS, CRAFTING_TABLE, DIRT, SAND, BRICK, STONE } from '../src/world/blocks.js';

const recipe = (id) => RECIPES.find((r) => r.id === id);

test('inventory add/remove and hotbar assignment', () => {
  const inv = new Inventory();
  inv.add(DIRT, 3);
  assert.equal(inv.count(DIRT), 3);
  assert.equal(inv.hotbar[0], DIRT);
  assert.equal(inv.selectedItem(), DIRT);
  assert.equal(inv.remove(DIRT, 5), false);
  assert.equal(inv.count(DIRT), 3);
  assert.equal(inv.remove(DIRT, 3), true);
  assert.equal(inv.count(DIRT), 0);
  assert.equal(inv.hotbar[0], null);
});

test('crafting deducts inputs and adds output', () => {
  const inv = new Inventory();
  inv.add(LOG, 1);
  assert.ok(canCraft(inv, recipe('planks')));
  assert.ok(craft(inv, recipe('planks')));
  assert.equal(inv.count(LOG), 0);
  assert.equal(inv.count(PLANKS), 4);
  assert.ok(craft(inv, recipe('crafting_table')));
  assert.equal(inv.count(PLANKS), 0);
  assert.equal(inv.count(CRAFTING_TABLE), 1);
});

test('crafting refuses when inputs are missing and changes nothing', () => {
  const inv = new Inventory();
  inv.add(DIRT, 2);
  inv.add(SAND, 1);
  assert.equal(canCraft(inv, recipe('brick')), false);
  assert.equal(craft(inv, recipe('brick')), false);
  assert.equal(inv.count(DIRT), 2);
  assert.equal(inv.count(SAND), 1);
  assert.equal(inv.count(BRICK), 0);
});

test('save JSON round-trip restores world edits and inventory', () => {
  const w = new World({ seed: 777 });
  w.setBlock(100, 40, 100, STONE);
  const inv = new Inventory();
  inv.add(LOG, 5);
  inv.select(0);
  const str = serialize({
    seed: w.seed,
    modifications: w.modifications,
    player: { x: 1, y: 2, z: 3, yaw: 0.5, pitch: -0.2 },
    inventory: inv.toJSON(),
  });
  const state = deserialize(str);
  assert.equal(state.seed, 777);
  assert.deepEqual(state.player, { x: 1, y: 2, z: 3, yaw: 0.5, pitch: -0.2 });
  const w2 = new World({ seed: state.seed, modifications: state.modifications });
  assert.equal(w2.getBlock(100, 40, 100), STONE);
  const inv2 = Inventory.fromJSON(state.inventory);
  assert.equal(inv2.count(LOG), 5);
  assert.equal(inv2.hotbar[0], LOG);
});

test('save rejects corrupt and wrong-version data; storage helpers work', () => {
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize(JSON.stringify({ version: 999, seed: 1 })), null);
  assert.equal(deserialize(null), null);
  const mem = new Map();
  const storage = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null };
  assert.ok(saveToStorage(storage, { seed: 5, modifications: {}, player: null, inventory: null }));
  assert.equal(loadFromStorage(storage).seed, 5);
  const failing = { setItem: () => { throw new Error('quota'); } };
  const origWarn = console.warn;
  console.warn = () => {};
  assert.equal(saveToStorage(failing, { seed: 5, modifications: {} }), false);
  console.warn = origWarn;
});
