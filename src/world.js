import { DECOR, OBSTACLES, PALETTE, TILE, WORLD_H, WORLD_W } from './constants.js';

const hash = (x, y) => {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

export function circleHitsRect(x, y, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return Math.hypot(x - nearX, y - nearY) < radius;
}

export function isBlocked(x, y, radius = 12) {
  if (x < radius + 32 || y < radius + 32 || x > WORLD_W - radius - 32 || y > WORLD_H - radius - 32) return true;
  return OBSTACLES.some(rect => circleHitsRect(x, y, radius, rect));
}

export function findOpenSpawnPoint(origin, minRange, maxRange, radius, occupied = [], attempts = 48) {
  for (let i = 0; i < attempts; i++) {
    const angle = Math.random() * Math.PI * 2;
    const range = minRange + Math.random() * (maxRange - minRange);
    const x = Math.max(48, Math.min(WORLD_W - 48, origin.x + Math.cos(angle) * range));
    const y = Math.max(48, Math.min(WORLD_H - 48, origin.y + Math.sin(angle) * range));
    if (isBlocked(x, y, radius)) continue;
    if (occupied.some(actor => Math.hypot(actor.x - x, actor.y - y) < radius + actor.radius + 20)) continue;
    return { x, y };
  }
  return null;
}

export function moveWithCollision(actor, dx, dy, radius = actor.radius) {
  const nextX = actor.x + dx;
  if (!isBlocked(nextX, actor.y, radius)) actor.x = nextX;
  const nextY = actor.y + dy;
  if (!isBlocked(actor.x, nextY, radius)) actor.y = nextY;
}

function drawBuilding(ctx, rect) {
  if (rect.type === 'pond') {
    ctx.fillStyle = '#192e42'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#264d62'; ctx.fillRect(rect.x + 8, rect.y + 7, rect.w - 16, rect.h - 14);
    ctx.fillStyle = 'rgba(113, 214, 220, .22)';
    for (let x = rect.x + 18; x < rect.x + rect.w - 15; x += 42) ctx.fillRect(x, rect.y + 22 + ((x >> 2) % 28), 22, 2);
    ctx.strokeStyle = '#67818d'; ctx.lineWidth = 5; ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    return;
  }
  ctx.fillStyle = 'rgba(5, 8, 13, .38)'; ctx.fillRect(rect.x + 7, rect.y + 10, rect.w, rect.h);
  if (rect.type === 'academy') {
    ctx.fillStyle = '#282d3b'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#70677a'; ctx.fillRect(rect.x + 7, rect.y + 5, rect.w - 14, 8);
    ctx.fillStyle = '#413d4d'; ctx.fillRect(rect.x + 16, rect.y + 20, rect.w - 32, 6);
    ctx.fillStyle = '#514c58'; ctx.fillRect(rect.x + 12, rect.y + 12, rect.w - 24, rect.h - 24);
    ctx.fillStyle = '#353a49';
    ctx.fillRect(rect.x + 26, rect.y + 26, rect.w - 52, 35);
    ctx.fillStyle = '#868292';
    for (let x = rect.x + 36; x < rect.x + rect.w - 30; x += 56) {
      ctx.fillRect(x, rect.y + 82, 14, 46);
      ctx.fillStyle = '#dac5f1'; ctx.fillRect(x + 3, rect.y + 86, 8, 12);
      ctx.fillStyle = '#868292'; ctx.fillRect(x + 2, rect.y + 82, 10, 3);
      ctx.fillRect(x - 2, rect.y + 126, 18, 5);
    }
    ctx.fillStyle = '#b796e8'; ctx.fillRect(rect.x + rect.w / 2 - 26, rect.y + 27, 52, 30);
    ctx.fillStyle = '#d4b5ff'; ctx.fillRect(rect.x + rect.w / 2 - 3, rect.y + 28, 6, 27);
    ctx.fillStyle = '#2c2738'; ctx.fillRect(rect.x + rect.w / 2 - 22, rect.y + rect.h - 74, 44, 74);
    ctx.fillStyle = '#41354e'; ctx.fillRect(rect.x + rect.w / 2 - 15, rect.y + rect.h - 64, 30, 64);
    ctx.fillStyle = 'rgba(149, 214, 231, .55)'; ctx.fillRect(rect.x + rect.w / 2 - 2, rect.y + rect.h - 61, 4, 35);
    ctx.fillStyle = '#b7a6cb'; ctx.fillRect(rect.x + rect.w / 2 - 25, rect.y + rect.h - 79, 50, 7);
  } else {
    ctx.fillStyle = rect.type === 'hedge' ? '#273b3b' : rect.type === 'ruin' ? '#373745' : '#363b49';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = rect.type === 'hedge' ? '#40534a' : '#555466';
    ctx.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, 6);
    if (rect.type === 'ruin') {
      ctx.fillStyle = '#242b38'; ctx.fillRect(rect.x + 12, rect.y + 12, Math.max(12, rect.w - 24), Math.max(12, rect.h - 20));
      ctx.fillStyle = 'rgba(133, 126, 162, .22)'; ctx.fillRect(rect.x + rect.w * .6, rect.y + 12, 5, rect.h - 22);
      ctx.fillStyle = 'rgba(165, 153, 201, .42)';
      ctx.fillRect(rect.x + 18, rect.y + 18, 3, 3); ctx.fillRect(rect.x + rect.w - 24, rect.y + rect.h - 23, 3, 3);
      ctx.fillRect(rect.x + 26, rect.y + 22, Math.max(8, rect.w - 52), 2);
    }
  }
  ctx.strokeStyle = 'rgba(184, 184, 203, .26)'; ctx.lineWidth = 2; ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
}

function drawTree(ctx, x, y, seed) {
  const size = 19 + (seed % 3) * 3;
  ctx.fillStyle = 'rgba(4, 8, 13, .46)'; ctx.fillRect(x - size + 7, y + 3, size * 2, 8);
  ctx.fillStyle = '#433d44'; ctx.fillRect(x - 5, y - 4, 10, 22); ctx.fillRect(x - 11, y + 5, 7, 4); ctx.fillRect(x + 4, y + 1, 8, 4);
  ctx.fillStyle = '#1e2e2d'; ctx.fillRect(x - size - 2, y - size + 5, size * 2 + 4, size * 2 - 1);
  ctx.fillStyle = '#293b36'; ctx.fillRect(x - size, y - size, size * 2, size + 10);
  ctx.fillStyle = '#354b40'; ctx.fillRect(x - size + 5, y - size + 3, size * 2 - 10, size - 3);
  ctx.fillStyle = '#52604d'; ctx.fillRect(x - 7, y - size + 6, 8, 5); ctx.fillRect(x + 7, y - 4, 6, 5);
  ctx.fillStyle = 'rgba(122, 191, 168, .4)'; ctx.fillRect(x - size + 7, y + 2, 4, 3); ctx.fillRect(x + size - 12, y - 9, 4, 3);
}

function drawDecor(ctx, item, time) {
  const { x, y, type, seed } = item;
  if (type === 'tree') return drawTree(ctx, x, y, seed);
  if (type === 'flower') {
    ctx.fillStyle = '#243831'; ctx.fillRect(x, y - 2, 2, 9); ctx.fillRect(x - 3, y + 2, 4, 2);
    ctx.fillStyle = seed % 2 ? '#b28fca' : '#82c4b9'; ctx.fillRect(x - 3, y - 6, 3, 3); ctx.fillRect(x + 2, y - 5, 3, 3); ctx.fillRect(x, y - 9, 3, 3);
    ctx.fillStyle = '#e3ce91'; ctx.fillRect(x - 1, y - 5, 3, 3); return;
  }
  if (type === 'rune') {
    ctx.fillStyle = '#273147'; ctx.fillRect(x - 14, y - 5, 28, 10);
    ctx.fillStyle = 'rgba(130, 167, 244, .17)'; ctx.fillRect(x - 7, y - 2, 14, 4);
    ctx.fillStyle = `rgba(125, 198, 255, ${.5 + Math.sin(time * 2 + seed) * .2})`;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  } else {
    const pulse = .45 + .15 * Math.sin(time * 1.6 + seed);
    ctx.fillStyle = '#323846'; ctx.fillRect(x - 4, y - 3, 8, 19);
    ctx.fillStyle = '#89766a'; ctx.fillRect(x - 6, y - 7, 12, 6);
    ctx.fillStyle = `rgba(149, 198, 255, ${pulse})`;
    ctx.fillRect(x - 2, y - 7, 4, 4);
    ctx.fillStyle = `rgba(123, 165, 255, ${pulse * .15})`; ctx.fillRect(x - 12, y - 19, 24, 26);
  }
}

export function drawWorld(ctx, camera, time) {
  const startX = Math.floor(camera.x / TILE) * TILE;
  const startY = Math.floor(camera.y / TILE) * TILE;
  ctx.fillStyle = '#182328'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let y = startY; y < camera.y + 700; y += TILE) {
    for (let x = startX; x < camera.x + 1020; x += TILE) {
      const variation = hash(x / TILE, y / TILE);
      const path = ((x > 830 && x < 1410 && y > 795 && y < 935) || (x > 780 && x < 1500 && y > 348 && y < 466));
      ctx.fillStyle = path ? (variation > .65 ? '#303947' : '#2c3542') : (variation > .88 ? '#202d31' : variation > .55 ? '#1d292d' : '#1b262a');
      ctx.fillRect(x, y, TILE, TILE);
      if (variation > .91) {
        ctx.fillStyle = path ? 'rgba(137, 155, 177, .2)' : 'rgba(108, 139, 119, .22)';
        ctx.fillRect(x + 6, y + 6, 5, 2); ctx.fillRect(x + 9, y + 8, 2, 4);
      } else if (variation < .08) {
        ctx.fillStyle = path ? 'rgba(10, 14, 21, .28)' : 'rgba(11, 20, 18, .3)';
        ctx.fillRect(x + 21, y + 19, 4, 3); ctx.fillRect(x + 23, y + 22, 2, 3);
      }
      if (variation > .8 && !path) {
        ctx.fillStyle = 'rgba(101, 126, 113, .3)'; ctx.fillRect(x + Math.floor(variation * 20), y + 10, 3, 2);
      } else if (path && variation > .74) {
        ctx.fillStyle = 'rgba(139, 157, 174, .24)'; ctx.fillRect(x + 9, y + 8, 2, 2);
      }
    }
  }
  // Campus ring and courtyard sigil.
  ctx.strokeStyle = 'rgba(125, 151, 171, .19)'; ctx.lineWidth = 12;
  ctx.strokeRect(280, 175, 1680, 1220);
  ctx.strokeStyle = 'rgba(147, 134, 205, .18)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(1120, 835, 92, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(1120, 835, 69, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + time * .08;
    ctx.fillStyle = 'rgba(155, 201, 238, .38)'; ctx.fillRect(1120 + Math.cos(a) * 79 - 2, 835 + Math.sin(a) * 79 - 2, 4, 4);
  }
  DECOR.forEach(item => drawDecor(ctx, item, time));
  OBSTACLES.forEach(rect => drawBuilding(ctx, rect));
  // Fog drifts across the lower edges, leaving the combat center readable.
  const fog = ctx.createLinearGradient(0, camera.y + 260, 0, camera.y + 850);
  fog.addColorStop(0, 'rgba(119, 139, 179, 0)'); fog.addColorStop(1, 'rgba(111, 129, 167, .1)');
  ctx.fillStyle = fog; ctx.fillRect(camera.x, camera.y, 1000, 720);
}

export function drawMinimap(ctx, player, enemies) {
  const x = 858, y = 18, w = 84, h = 60;
  ctx.fillStyle = 'rgba(7, 12, 20, .8)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(177, 192, 218, .36)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(154, 173, 202, .26)';
  OBSTACLES.forEach(r => ctx.fillRect(x + r.x / WORLD_W * w, y + r.y / WORLD_H * h, Math.max(2, r.w / WORLD_W * w), Math.max(2, r.h / WORLD_H * h)));
  enemies.forEach(e => { ctx.fillStyle = e.boss ? '#f07b9e' : '#df8089'; ctx.fillRect(x + e.x / WORLD_W * w - 1, y + e.y / WORLD_H * h - 1, e.boss ? 4 : 2, e.boss ? 4 : 2); });
  ctx.fillStyle = '#8cf4e9'; ctx.fillRect(x + player.x / WORLD_W * w - 2, y + player.y / WORLD_H * h - 2, 4, 4);
}
