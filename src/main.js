import './style.css';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);

function start() {
  try {
    const game = new Game({
      app: $('app'),
      hud: $('hud'),
      minimap: $('minimap'),
      touch: $('touch'),
      crafting: $('crafting'),
      menu: $('menu'),
    });
    window.__game = game; // exposed for testing / debugging
  } catch (err) {
    console.error(err);
    $('fatal').textContent = 'Build and Craft could not start: ' + (err && err.message ? err.message : err) +
      '. Your browser may not support WebGL.';
    $('fatal').hidden = false;
  }
}

start();
