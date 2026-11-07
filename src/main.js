import { Game } from './game.js';
import { VIEW_H, VIEW_W } from './constants.js';

const canvas = document.querySelector('#game');
const statusNode = document.querySelector('#game-status');
const game = new Game(canvas, statusNode);
let lastTime = performance.now();

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * VIEW_W, y: (event.clientY - rect.top) / rect.height * VIEW_H };
}

canvas.addEventListener('pointermove', event => {
  const p = point(event); game.setMouse(p.x, p.y);
});
canvas.addEventListener('pointerdown', event => {
  const p = point(event);
  canvas.focus({ preventScroll: true });
  game.pointerDown(p.x, p.y, event.button);
});
canvas.addEventListener('pointerup', event => {
  const p = point(event); game.pointerUp(p.x, p.y, event.button);
});
canvas.addEventListener('pointercancel', () => game.cancelPointerInput());
canvas.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keydown', event => {
  const blocked = game.keyDown(event.key);
  if (blocked) event.preventDefault();
});
window.addEventListener('keyup', event => game.keyUp(event.key));
window.addEventListener('mouseup', event => { if (event.button === 0 || event.button === 2) game.cancelPointerInput(); });
window.addEventListener('blur', () => game.setInputFocused(false));
window.addEventListener('focus', () => game.setInputFocused(true));
document.addEventListener('visibilitychange', () => game.setInputFocused(!document.hidden));

function frame(now) {
  const dt = Math.min(.034, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
  canvas.style.cursor = game.screen === 'playing' ? 'none' : 'crosshair';
  game.update(dt); game.render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
