// Simple flat crafting recipe list. Pure module.
import { LOG, PLANKS, CRAFTING_TABLE, SAND, GLASS, DIRT, BRICK, COBBLESTONE, STONE } from '../world/blocks.js';

export const RECIPES = [
  { id: 'planks', inputs: [[LOG, 1]], output: [PLANKS, 4] },
  { id: 'crafting_table', inputs: [[PLANKS, 4]], output: [CRAFTING_TABLE, 1] },
  { id: 'glass', inputs: [[SAND, 4]], output: [GLASS, 2] },
  { id: 'brick', inputs: [[DIRT, 2], [SAND, 2]], output: [BRICK, 2] },
  { id: 'stone', inputs: [[COBBLESTONE, 4]], output: [STONE, 4] },
];

export function canCraft(inventory, recipe) {
  return recipe.inputs.every(([id, n]) => inventory.has(id, n));
}

/** Craft once. Returns true on success; leaves the inventory untouched on failure. */
export function craft(inventory, recipe) {
  if (!canCraft(inventory, recipe)) return false;
  for (const [id, n] of recipe.inputs) inventory.remove(id, n);
  inventory.add(recipe.output[0], recipe.output[1]);
  return true;
}
