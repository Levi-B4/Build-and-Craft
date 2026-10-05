# CLAUDE.md

## Project Overview
Build and Craft is a website that allows the user to play a minimal version of a minecraft like game.

## directory
- keep this section updated
```
index.html                 entry page (overlay containers for HUD, minimap, touch UI, crafting, menu)
vite.config.js, package.json
public/favicon.svg
src/
  main.js                  bootstrap, exposes window.__game
  game.js                  Game class: three.js setup, game loop, actions, menus, autosave
  config.js                constants (world size, chunk size, render distance, physics, save key)
  style.css
  world/blocks.js          block ids, properties, drops, atlas tile ids        (pure)
  world/noise.js           seeded PRNG, position hash, value noise              (pure)
  world/generator.js       seeded terrain + order-independent trees             (pure)
  world/world.js           chunk storage, get/setBlock, modification diffs      (pure)
  world/mesher.js          face-culled chunk mesh -> typed arrays               (pure)
  world/chunkManager.js    nearest-first build queue, BufferGeometry, unloading
  render/textures.js       runtime canvas texture atlas + hotbar icons
  player/player.js         physics + AABB collision                             (pure)
  player/raycast.js        voxel DDA raycast                                    (pure)
  player/controls.js       mouse/keyboard + pointer lock
  player/touchControls.js  joystick, drag-to-look, touch buttons
  inventory/inventory.js   item counts + 9-slot hotbar                          (pure)
  crafting/recipes.js      recipe list, canCraft/craft                          (pure)
  crafting/craftingUI.js   crafting panel
  mobs/cow.js              highland cow box model (shared geometry/materials)
  mobs/cowManager.js       spawning, wander AI, on-screen moo logic
  audio/moo.js             Web Audio synthesized moo
  ui/hud.js, ui/minimap.js, ui/menu.js
  save/save.js             localStorage (de)serialization                       (pure)
tests/                     node --test unit tests for pure modules (npm test)
scripts/smoke.js           headless Chrome smoke test (npm run build && npm run smoke)
```

## architecture
- serverless, fully client side
- auto saves current world

## features
- roam a large randomly generated world
- put items together to use new items
- destroy and use pieces of the world
- seeded generation
- fixed size
- simple recipe lists for crafting
- allow mobile usage as well as mouse and keyboard (depending on the platform its used on)
- use minimally textured blocks
- have a minimap that shows an aerial view of the current chunk


## Coding Conventions
- javascript, html, css only
- use three.js for the game
- use vite
- host the website on vercel

## Other Notes
- Only add highland cows as mobs (they can be very simple shapes but should moo when on the players screen)
- no multiplayer
- no accounts