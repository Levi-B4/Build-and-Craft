// Global game constants. Pure module (no DOM / three.js) so it can be used in node tests.

export const CHUNK_SIZE = 16;
export const HEIGHT = 64;
export const WORLD_CHUNKS = 32; // world is WORLD_CHUNKS x WORLD_CHUNKS chunks
export const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS; // 512 blocks per side
export const SEA_LEVEL = 20;

export const RENDER_DISTANCE_DESKTOP = 4; // in chunks
export const RENDER_DISTANCE_MOBILE = 3;
export const CHUNKS_PER_FRAME = 2; // chunk generate+mesh budget per frame

export const REACH = 6; // block interaction distance

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 6.5;
export const GRAVITY = 25;
export const JUMP_SPEED = 8;

export const MAX_COWS = 20;
export const COW_DESPAWN_DIST = 90;
export const MOO_DISTANCE = 24;

export const SAVE_KEY = 'buildcraft:world';
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL = 5000; // ms
