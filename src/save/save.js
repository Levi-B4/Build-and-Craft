// Save (de)serialisation + storage helpers. Pure module: storage is passed in (localStorage in the browser).
import { SAVE_KEY, SAVE_VERSION } from '../config.js';

/**
 * @param {{seed:number, modifications:object, player:object, inventory:object}} state
 * @returns {string}
 */
export function serialize(state) {
  return JSON.stringify({
    version: SAVE_VERSION,
    seed: state.seed,
    modifications: state.modifications,
    player: state.player,
    inventory: state.inventory,
    savedAt: Date.now(),
  });
}

/** Parse a save string. Returns null for missing/corrupt/incompatible saves. */
export function deserialize(str) {
  if (!str) return null;
  let obj;
  try {
    obj = JSON.parse(str);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || obj.version !== SAVE_VERSION) return null;
  if (typeof obj.seed !== 'number') return null;
  return {
    seed: obj.seed >>> 0,
    modifications: obj.modifications && typeof obj.modifications === 'object' ? obj.modifications : {},
    player: obj.player || null,
    inventory: obj.inventory || null,
  };
}

export function saveToStorage(storage, state, key = SAVE_KEY) {
  try {
    storage.setItem(key, serialize(state));
    return true;
  } catch (err) {
    console.warn('Build and Craft: could not save world', err);
    return false;
  }
}

export function loadFromStorage(storage, key = SAVE_KEY) {
  try {
    return deserialize(storage.getItem(key));
  } catch {
    return null;
  }
}

export function clearStorage(storage, key = SAVE_KEY) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
