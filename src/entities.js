import { OBSTACLES, WORLD_H, WORLD_W } from './constants.js';
import { circleHitsRect } from './world.js';
import { createElementState, ELEMENT_IDS, ELEMENT_MARK_DURATION } from './reactions.js';

export function createPlayer() {
  return {
    x: WORLD_W / 2, y: 970, radius: 13, hp: 100, maxHp: 100,
    mana: 76, maxMana: 100, manaRegen: 10, speed: 190,
    damage: 22, fireDelay: .34, fireTimer: 0, armor: 0,
    fireRadiusBonus: 0, iceDurationBonus: 0, lightningChainBonus: 0, natureRadiusBonus: 0,
    dashTimer: 0, dashCooldown: 0, invulnerable: 0,
    level: 1, xp: 0, nextXp: 38, kills: 0, facing: 0, hitFlash: 0, castTimer: 0,
  };
}

export function enemyStats(type, x, y, scale = 1) {
  const data = {
    wisp: { hp: 33, speed: 76, radius: 12, damage: 8, xp: 11, color: '#9ba8ff', attack: 2.35, label: '霧靈' },
    stalker: { hp: 46, speed: 95, radius: 13, damage: 11, xp: 13, color: '#cf7c95', attack: 0, label: '影行者' },
    brute: { hp: 122, speed: 50, radius: 19, damage: 21, xp: 21, color: '#b9816d', attack: 0, label: '石像獸' },
    boss: { hp: 920, speed: 57, radius: 28, damage: 26, xp: 180, color: '#bd83fa', attack: 1.7, label: '暮鐘監院' },
  }[type];
  return {
    ...data, type, x, y, maxHp: data.hp * scale, hp: data.hp * scale,
    speed: data.speed * (1 + (scale - 1) * .2), damage: data.damage * scale,
    xp: Math.round(data.xp * scale), attackTimer: .4 + Math.random() * .8,
    hitFlash: 0, phase: Math.random() * Math.PI * 2, boss: type === 'boss', knockX: 0, knockY: 0,
    slowTimer: 0, slowFactor: 1, rootTimer: 0, attackWarning: 0, phaseTwo: false, warningAngle: 0,
    elite: false, eliteCooldown: 2.6 + Math.random() * 1.4, eliteWindup: 0, eliteDash: 0, eliteAngle: 0, ...createElementState(),
  };
}

export function createProjectile({ x, y, vx, vy, damage, owner = 'player', type = 'arc', life = 1.8, radius = 5, magicId = null, magicColor = null }) {
  return { x, y, vx, vy, damage, owner, type, life, maxLife: life, radius, magicId, magicColor, spin: Math.random() * 6.3 };
}

export function createMagicZone({ x, y, spellId, color, damage, radius, duration, tickInterval, rootDuration }) {
  return { x, y, spellId, color, damage, radius, life: duration, maxLife: duration, tickInterval, tickTimer: 0,
    rootDuration, pulse: Math.random() * Math.PI * 2 };
}

export function createMagicBurst(x, y, radius, color, element = 'fire') {
  return { x, y, radius, color, element, life: .28, maxLife: .28 };
}

export function createEffect(x, y, color, count = 7, size = 3) {
  return Array.from({ length: count }, (_, i) => {
    const a = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 130;
    return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .2 + Math.random() * .42, maxLife: .62, color, size: 1 + Math.random() * size, spin: i, shape: i % 3 };
  });
}

export function drawActor(ctx, actor, time) {
  const phase = actor.phase || 0;
  const moving = actor.type === 'player' ? !!actor.moving : actor.type !== 'wisp' && actor.rootTimer <= 0;
  const bob = actor.boss ? Math.sin(time * 3) * 2 : actor.type === 'wisp' ? Math.sin(time * 5 + phase) * 3 : Math.sin(time * (moving ? 12 : 3) + phase) * (moving ? 1.2 : .45);
  const x = Math.round(actor.x), y = Math.round(actor.y + bob), flash = actor.hitFlash > 0;
  ctx.save(); ctx.globalAlpha = actor.opacity ?? 1;
  ctx.fillStyle = 'rgba(4, 6, 11, .52)'; ctx.fillRect(x - actor.radius + 3, actor.y + actor.radius - 2, actor.radius * 2 - 6, 6);
  if (actor.type === 'player') drawStudent(ctx, actor, x, y, time, flash, moving);
  else if (actor.type === 'wisp') drawWisp(ctx, x, y, time, phase, flash);
  else if (actor.type === 'stalker') drawStalker(ctx, x, y, time, phase, flash, moving);
  else drawStoneGuardian(ctx, actor, x, y, time, flash);
  if (actor.elite) drawEliteMark(ctx, x, y, actor.radius, time, actor.eliteWindup > 0);
  ctx.restore();
  drawElementStatus(ctx, actor, time);
}

function drawEliteMark(ctx, x, y, radius, time, warning) {
  ctx.save();
  ctx.globalAlpha = warning ? .72 + Math.sin(time * 28) * .18 : .55;
  ctx.strokeStyle = warning ? '#ff6f78' : '#f0c777'; ctx.lineWidth = 2;
  ctx.strokeRect(x - radius - 4, y - radius - 4, (radius + 4) * 2, (radius + 4) * 2);
  ctx.fillStyle = warning ? '#ff858b' : '#f5d58d';
  ctx.fillRect(x - 2, y - radius - 8, 4, 4); ctx.fillRect(x - radius - 8, y - 2, 4, 4); ctx.fillRect(x + radius + 4, y - 2, 4, 4);
  ctx.restore();
}

function drawStudent(ctx, actor, x, y, time, flash, moving) {
  const step = moving ? Math.round(Math.sin(time * 17) * 2) : 0;
  const casting = actor.castTimer > 0;
  // Hood, layered academy coat, bright house clasp and split hem.
  ctx.fillStyle = flash ? '#fff' : '#24283d'; ctx.fillRect(x - 11, y + 2, 22, 13);
  ctx.fillStyle = flash ? '#fff' : '#4c4568'; ctx.fillRect(x - 10, y + 4, 20, 9);
  ctx.fillStyle = flash ? '#fff' : '#7774a8'; ctx.fillRect(x - 8, y + 6, 16, 5);
  ctx.fillStyle = flash ? '#fff' : '#30334c'; ctx.fillRect(x - 8, y + 14 + step, 6, 5); ctx.fillRect(x + 2, y + 14 - step, 6, 5);
  ctx.fillStyle = '#c2afdc'; ctx.fillRect(x - 9, y + 18 + step, 7, 2); ctx.fillRect(x + 2, y + 18 - step, 7, 2);
  ctx.fillStyle = flash ? '#fff' : '#b7a0d4'; ctx.fillRect(x - 8, y - 6, 16, 12);
  ctx.fillStyle = flash ? '#fff' : '#ddc7a4'; ctx.fillRect(x - 6, y - 14, 12, 11);
  ctx.fillStyle = '#392d43'; ctx.fillRect(x - 7, y - 16, 14, 4);
  // Pointed violet student cap and two-pixel tassel.
  ctx.fillStyle = flash ? '#fff' : '#49385e'; ctx.fillRect(x - 8, y - 17, 16, 3);
  ctx.fillRect(x - 5, y - 20, 11, 3); ctx.fillRect(x - 2, y - 23, 7, 3); ctx.fillRect(x + 1, y - 26, 4, 4);
  ctx.fillStyle = '#c5a8f0'; ctx.fillRect(x - 5, y - 17, 11, 1); ctx.fillRect(x + 4, y - 23, 2, 2);
  // Face and scarf remain visible even while the staff turns.
  ctx.fillStyle = '#382f43'; ctx.fillRect(x - 4, y - 9, 2, 2); ctx.fillRect(x + 2, y - 9, 2, 2);
  ctx.fillStyle = '#edc4a4'; ctx.fillRect(x - 1, y - 5, 3, 1);
  ctx.fillStyle = '#87d9d5'; ctx.fillRect(x - 3, y + 1, 6, 3); ctx.fillStyle = '#e6d3a4'; ctx.fillRect(x - 1, y + 1, 2, 2);
  // Sleeve and crystal wand share the character's aim direction.
  ctx.save(); ctx.translate(x + 2, y + 4); ctx.rotate(actor.facing || 0);
  ctx.fillStyle = flash ? '#fff' : '#c9ad91'; ctx.fillRect(1, casting ? -4 : -2, 5, 5);
  ctx.fillStyle = '#4a3c5e'; ctx.fillRect(5, casting ? -3 : -1, 17, 3); ctx.fillStyle = '#b9a0e5'; ctx.fillRect(7, casting ? -4 : -2, 2, 5);
  ctx.fillStyle = casting ? '#9cffff' : '#59cdd5'; ctx.fillRect(20, casting ? -6 : -4, casting ? 7 : 5, casting ? 12 : 8); ctx.fillStyle = '#e5ffff'; ctx.fillRect(21, casting ? -4 : -3, 3, 5);
  ctx.restore();
  if (casting) {
    const pulse = .35 + Math.sin(time * 35) * .18;
    ctx.fillStyle = `rgba(121, 235, 247, ${pulse})`;
    ctx.fillRect(x + Math.round(Math.cos(actor.facing || 0) * 27) - 2, y - 5 + Math.round(Math.sin(actor.facing || 0) * 27), 5, 5);
  }
  const glow = .18 + Math.sin(time * 8) * .06;
  ctx.fillStyle = `rgba(114, 223, 231, ${glow})`; ctx.fillRect(x - 3, y + 1, 6, 4);
}

function drawWisp(ctx, x, y, time, phase, flash) {
  const pulse = .2 + .08 * Math.sin(time * 7 + phase);
  ctx.fillStyle = `rgba(126, 166, 255, ${pulse})`; ctx.fillRect(x - 17, y - 17, 34, 34);
  ctx.fillStyle = '#303857'; ctx.fillRect(x - 8, y - 14, 16, 4); ctx.fillRect(x - 12, y - 9, 24, 16); ctx.fillRect(x - 7, y + 7, 14, 5);
  ctx.fillStyle = flash ? '#fff' : '#7f91c1'; ctx.fillRect(x - 9, y - 10, 18, 15);
  ctx.fillStyle = '#b9d8fa'; ctx.fillRect(x - 6, y - 8, 12, 10); ctx.fillStyle = '#efffff'; ctx.fillRect(x - 3, y - 6, 6, 6);
  ctx.fillStyle = '#312b52'; ctx.fillRect(x - 4, y - 2, 2, 3); ctx.fillRect(x + 2, y - 2, 2, 3);
  ctx.fillStyle = '#b2ccff'; ctx.fillRect(x - 14, y - 1, 3, 5); ctx.fillRect(x + 11, y - 1, 3, 5);
}

function drawStalker(ctx, x, y, time, phase, flash, moving) {
  const stride = moving ? Math.round(Math.sin(time * 15 + phase) * 2) : 0;
  ctx.fillStyle = flash ? '#fff' : '#292635'; ctx.fillRect(x - 10, y - 3, 20, 13); ctx.fillRect(x - 13, y + 2, 6, 8); ctx.fillRect(x + 7, y + 2, 6, 8);
  ctx.fillStyle = flash ? '#fff' : '#54374d'; ctx.fillRect(x - 8, y - 9, 16, 14); ctx.fillRect(x - 5, y - 13, 11, 6);
  ctx.fillStyle = '#382c40'; ctx.fillRect(x - 10, y - 15, 19, 5); ctx.fillRect(x - 7, y - 19, 14, 5); ctx.fillRect(x - 4, y - 22, 8, 4);
  ctx.fillStyle = '#f1a0b1'; ctx.fillRect(x - 5, y - 10, 4, 2); ctx.fillRect(x + 2, y - 10, 4, 2);
  ctx.fillStyle = '#30263a'; ctx.fillRect(x - 9, y + 10 + stride, 6, 4); ctx.fillRect(x + 3, y + 10 - stride, 6, 4);
  ctx.fillStyle = '#996078'; ctx.fillRect(x - 3, y - 2, 6, 5);
}

function drawStoneGuardian(ctx, actor, x, y, time, flash) {
  const boss = actor.boss, r = boss ? 29 : 19;
  if (boss) {
    ctx.fillStyle = `rgba(193, 117, 241, ${.1 + Math.sin(time * 4) * .04})`; ctx.fillRect(x - 38, y - 37, 76, 73);
    ctx.fillStyle = '#332b4a'; ctx.fillRect(x - 28, y - 19, 56, 42); ctx.fillRect(x - 34, y - 12, 10, 22); ctx.fillRect(x + 24, y - 12, 10, 22);
    ctx.fillStyle = flash ? '#fff' : '#70518e'; ctx.fillRect(x - 22, y - 27, 44, 44); ctx.fillRect(x - 28, y - 19, 56, 26);
    ctx.fillStyle = flash ? '#fff' : '#ad88cf'; ctx.fillRect(x - 17, y - 34, 34, 19);
    // Bell crown silhouette and hanging clapper.
    ctx.fillStyle = '#d8c2a0'; ctx.fillRect(x - 22, y - 37, 5, 11); ctx.fillRect(x - 2, y - 42, 5, 14); ctx.fillRect(x + 17, y - 37, 5, 11);
    ctx.fillRect(x - 5, y - 47, 11, 4); ctx.fillStyle = '#f0d99c'; ctx.fillRect(x - 1, y - 44, 3, 4);
    ctx.fillStyle = '#30283c'; ctx.fillRect(x - 13, y - 8, 6, 5); ctx.fillRect(x + 7, y - 8, 6, 5);
    ctx.fillStyle = '#ffb5de'; ctx.fillRect(x - 11, y - 7, 3, 2); ctx.fillRect(x + 8, y - 7, 3, 2);
    ctx.fillStyle = '#e7b7fb'; ctx.fillRect(x - 5, y + 1, 10, 9); ctx.fillStyle = '#fff1ff'; ctx.fillRect(x - 2, y + 3, 4, 5);
    ctx.fillStyle = '#cab5df'; ctx.fillRect(x - 21, y + 20, 13, 5); ctx.fillRect(x + 8, y + 20, 13, 5);
    return;
  }
  // Stone beast: broad shoulders, plated brow, amber core and heavy feet.
  ctx.fillStyle = flash ? '#fff' : '#40383a'; ctx.fillRect(x - r, y - 10, r * 2, 25); ctx.fillRect(x - r - 3, y - 7, 8, 16); ctx.fillRect(x + r - 5, y - 7, 8, 16);
  ctx.fillStyle = flash ? '#fff' : '#88705f'; ctx.fillRect(x - 14, y - 19, 28, 18); ctx.fillRect(x - 10, y - 23, 20, 7);
  ctx.fillStyle = '#4d4441'; ctx.fillRect(x - 16, y - 21, 7, 8); ctx.fillRect(x + 9, y - 21, 7, 8);
  ctx.fillStyle = '#282936'; ctx.fillRect(x - 8, y - 12, 5, 4); ctx.fillRect(x + 3, y - 12, 5, 4);
  ctx.fillStyle = '#f0b36a'; ctx.fillRect(x - 6, y - 11, 2, 2); ctx.fillRect(x + 4, y - 11, 2, 2);
  ctx.fillStyle = '#d29b68'; ctx.fillRect(x - 2, y - 3, 4, 10); ctx.fillRect(x - 4, y + 1, 8, 3);
  ctx.fillStyle = '#33313a'; ctx.fillRect(x - 14, y + 14, 11, 6); ctx.fillRect(x + 3, y + 14, 11, 6);
  ctx.fillStyle = '#a7856d'; ctx.fillRect(x - 12, y + 20, 10, 3); ctx.fillRect(x + 3, y + 20, 10, 3);
}

function drawElementStatus(ctx, actor, time) {
  if (actor.type === 'player' || !actor.elementMarks) return;
  const active = ELEMENT_IDS.filter(id => actor.elementMarks[id] > 0);
  if (!active.length) return;
  const center = actor.x - (active.length - 1) * 4;
  const y = actor.y - actor.radius - 9;
  ctx.save();
  active.forEach((id, index) => {
    const remaining = actor.elementMarks[id];
    const alpha = Math.min(.88, remaining / ELEMENT_MARK_DURATION[id] * .88);
    const x = Math.round(center + index * 8);
    ctx.globalAlpha = alpha;
    if (id === 'fire') {
      ctx.fillStyle = '#ffad68'; ctx.fillRect(x - 1, y - 3, 3, 7); ctx.fillRect(x - 3, y - 1, 7, 3);
      ctx.fillStyle = '#fff0bd'; ctx.fillRect(x, y - 1, 2, 3);
    } else if (id === 'ice') {
      ctx.fillStyle = '#79d8f2'; ctx.fillRect(x - 1, y - 4, 3, 9); ctx.fillRect(x - 4, y - 1, 9, 3);
      ctx.fillStyle = '#e6fbff'; ctx.fillRect(x, y - 1, 2, 2);
    } else if (id === 'lightning') {
      ctx.fillStyle = '#c2a9ff'; ctx.beginPath(); ctx.moveTo(x + 1, y - 5); ctx.lineTo(x + 4, y - 1); ctx.lineTo(x + 1, y); ctx.lineTo(x + 3, y + 4); ctx.lineTo(x - 3, y); ctx.lineTo(x, y - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4efff'; ctx.fillRect(x, y - 1, 2, 2);
    } else {
      ctx.fillStyle = '#8ed69a'; ctx.fillRect(x - 3, y - 2, 6, 5); ctx.fillRect(x - 1, y - 5, 2, 3);
      ctx.fillStyle = '#d9f4c9'; ctx.fillRect(x, y - 1, 2, 2);
    }
  });
  ctx.restore();
}

export function projectileHitsWall(projectile) {
  return OBSTACLES.some(rect => circleHitsRect(projectile.x, projectile.y, projectile.radius, rect));
}

export function drawProjectile(ctx, p, time) {
  const speed = Math.hypot(p.vx, p.vy) || 1, tx = -p.vx / speed, ty = -p.vy / speed;
  const color = p.magicColor || (p.owner === 'enemy' ? '#d98cda' : '#71e4e2');
  ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = color;
  for (let i = 1; i <= 3; i++) {
    const pulse = (i % 2);
    ctx.fillRect(Math.round(p.x + tx * (i * 5 + pulse)) - 1, Math.round(p.y + ty * (i * 5 + pulse)) - 1, Math.max(1, 4 - i), Math.max(1, 4 - i));
  }
  ctx.globalAlpha = 1; ctx.translate(p.x, p.y); ctx.rotate(p.spin + time * 3);
  if (p.owner === 'player') {
    ctx.globalAlpha = .22; ctx.fillStyle = p.magicColor || '#62daff'; ctx.fillRect(-11, -11, 22, 22); ctx.globalAlpha = 1;
    if (p.magicId === 'fire') {
      ctx.fillStyle = p.magicColor; ctx.fillRect(-10, -5, 16, 10); ctx.fillRect(-5, -10, 11, 20);
      ctx.fillStyle = '#ffcf82'; ctx.fillRect(-8, -7, 7, 14);
      ctx.fillStyle = '#fff2c4'; ctx.fillRect(1, -4, 6, 8);
    } else if (p.magicId === 'ice') {
      ctx.fillStyle = p.magicColor; ctx.fillRect(-5, -5, 10, 10); ctx.fillRect(-2, -11, 4, 22); ctx.fillRect(-11, -2, 22, 4);
      ctx.fillRect(-8, -8, 4, 4); ctx.fillRect(5, 5, 4, 4);
      ctx.fillStyle = '#effcff'; ctx.fillRect(-2, -3, 6, 6);
    } else if (p.magicId === 'lightning') {
      ctx.fillStyle = p.magicColor; ctx.beginPath(); ctx.moveTo(-2, -9); ctx.lineTo(5, -2); ctx.lineTo(1, 1); ctx.lineTo(6, 8); ctx.lineTo(-5, 1); ctx.lineTo(-1, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff7d6'; ctx.fillRect(-2, -2, 4, 4);
    } else {
      ctx.fillStyle = p.magicColor || '#80e9ed'; ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#f7ffff'; ctx.fillRect(-2, -3, 5, 4);
    }
  } else {
    ctx.fillStyle = 'rgba(212, 105, 216, .19)'; ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#ce7dce'; ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#fff0fe'; ctx.fillRect(-1, -2, 3, 3);
  }
  ctx.restore();
}

export function drawMagicBurst(ctx, burst) {
  const progress = 1 - burst.life / burst.maxLife, radius = burst.radius * (.35 + progress * .65);
  ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress);
  if (burst.element === 'ice') {
    ctx.fillStyle = 'rgba(117, 222, 255, .16)'; ctx.beginPath(); ctx.arc(burst.x, burst.y, radius * .72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9fbff'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + .18, inner = radius * .22, outer = radius * (.72 + .18 * (i % 2));
      ctx.beginPath(); ctx.moveTo(burst.x + Math.cos(a) * inner, burst.y + Math.sin(a) * inner);
      ctx.lineTo(burst.x + Math.cos(a) * outer, burst.y + Math.sin(a) * outer); ctx.stroke();
      ctx.fillStyle = '#8feaff'; ctx.fillRect(Math.round(burst.x + Math.cos(a) * outer) - 2, Math.round(burst.y + Math.sin(a) * outer) - 2, 4, 4);
    }
    ctx.restore(); return;
  }
  ctx.fillStyle = burst.color; ctx.beginPath(); ctx.arc(burst.x, burst.y, radius * .7, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha *= .95; ctx.strokeStyle = '#ffe8ba'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd279';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + .22, inner = radius * .74, outer = radius * (1.02 + .14 * (i % 2));
    ctx.fillRect(Math.round(burst.x + Math.cos(a) * inner) - 1, Math.round(burst.y + Math.sin(a) * inner) - 1, 3, 3);
    ctx.fillStyle = i % 2 ? '#fff0b4' : '#f78c52';
  }
  ctx.restore();
}

export function drawMagicZone(ctx, zone, time) {
  const progress = Math.max(0, Math.min(1, zone.life / zone.maxLife));
  const pulse = .9 + Math.sin(time * 7 + zone.pulse) * .06;
  const growth = .28 + .72 * Math.min(1, (1 - progress) * 5);
  const radius = zone.radius * pulse * growth;
  ctx.save();
  ctx.globalAlpha = .18 + .12 * progress;
  ctx.fillStyle = zone.color; ctx.beginPath(); ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .8;
  ctx.strokeStyle = zone.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = .36; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(zone.x, zone.y, radius * .72, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + time * .12;
    const ix = zone.x + Math.cos(a) * radius * .58, iy = zone.y + Math.sin(a) * radius * .58;
    const ox = zone.x + Math.cos(a) * radius * .94, oy = zone.y + Math.sin(a) * radius * .94;
    ctx.globalAlpha = .62; ctx.fillStyle = zone.color;
    ctx.fillRect(Math.round(ix) - 2, Math.round(iy) - 2, 4, 4);
    ctx.fillRect(Math.round((ix + ox) / 2) - 1, Math.round((iy + oy) / 2) - 1, 3, 3);
    ctx.globalAlpha = .42 * progress; ctx.strokeStyle = '#b1e99b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(zone.x, zone.y); ctx.lineTo(zone.x + Math.cos(a + .13) * radius, zone.y + Math.sin(a + .13) * radius); ctx.stroke();
    ctx.fillStyle = '#c8f0a0'; ctx.globalAlpha = .7 * progress;
    ctx.fillRect(Math.round(ox) - 2, Math.round(oy) - 3, 4, 3);
  }
  ctx.restore();
}

export function drawMagicArc(ctx, arc, time) {
  const alpha = Math.max(0, arc.life / arc.maxLife);
  const dx = arc.x2 - arc.x1, dy = arc.y2 - arc.y1;
  const length = Math.hypot(dx, dy) || 1, px = -dy / length, py = dx / length;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#a78cff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(arc.x1, arc.y1);
  for (let i = 1; i < 6; i++) {
    const t = i / 6, jitter = Math.sin(time * 90 + i * 12 + arc.x1) * 8;
    ctx.lineTo(arc.x1 + dx * t + px * jitter, arc.y1 + dy * t + py * jitter);
  }
  ctx.lineTo(arc.x2, arc.y2); ctx.stroke();
  ctx.strokeStyle = '#f1edff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#dacfff'; ctx.lineWidth = 1.5;
  for (let i = 2; i <= 4; i += 2) {
    const t = i / 6, bx = arc.x1 + dx * t + px * Math.sin(time * 90 + i * 12 + arc.x1) * 8;
    const by = arc.y1 + dy * t + py * Math.sin(time * 90 + i * 12 + arc.x1) * 8;
    const side = i % 4 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + px * side * 10 - dx / length * 7, by + py * side * 10 - dy / length * 7); ctx.stroke();
  }
  ctx.restore();
}

export function drawReactionEffect(ctx, effect, time) {
  const progress = Math.max(0, Math.min(1, 1 - effect.life / effect.maxLife));
  const alpha = 1 - progress;
  ctx.save(); ctx.globalAlpha = alpha;
  if (effect.id === 'steamBurst') {
    const radius = 12 + progress * effect.radius;
    ctx.fillStyle = 'rgba(174, 226, 236, .16)'; ctx.beginPath(); ctx.arc(effect.x, effect.y, radius * .65, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b9e8ed'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffb477'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(effect.x, effect.y, radius * .74, .2, Math.PI * 1.05); ctx.stroke();
    ctx.strokeStyle = '#8bd8f2'; ctx.beginPath(); ctx.arc(effect.x, effect.y, radius * .84, Math.PI * 1.1, Math.PI * 1.88); ctx.stroke();
  } else if (effect.id === 'lightningVines') {
    const dx = effect.x2 - effect.x, dy = effect.y2 - effect.y;
    const length = Math.hypot(dx, dy) || 1, px = -dy / length, py = dx / length;
    ctx.strokeStyle = '#75c982'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(effect.x, effect.y);
    for (let i = 1; i < 5; i++) {
      const t = i / 5, bend = Math.sin(time * 44 + i * 4 + effect.y) * 7;
      ctx.lineTo(effect.x + dx * t + px * bend, effect.y + dy * t + py * bend);
    }
    ctx.lineTo(effect.x2, effect.y2); ctx.stroke();
    ctx.strokeStyle = '#b8f7eb'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(effect.x, effect.y);
    ctx.lineTo(effect.x + dx * .45 + px * 4, effect.y + dy * .45 + py * 4);
    ctx.lineTo(effect.x + dx * .72 - px * 5, effect.y + dy * .72 - py * 5); ctx.lineTo(effect.x2, effect.y2); ctx.stroke();
  } else if (effect.id === 'frozenThorns') {
    const reach = effect.radius * (.48 + progress * .52), wobble = Math.sin(time * 30) * 2;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + .18, inner = 6, outer = reach + wobble;
      const x1 = effect.x + Math.cos(angle) * inner, y1 = effect.y + Math.sin(angle) * inner;
      const x2 = effect.x + Math.cos(angle) * outer, y2 = effect.y + Math.sin(angle) * outer;
      ctx.strokeStyle = i % 2 ? '#86d8ec' : '#6aaf7b'; ctx.lineWidth = i % 2 ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.fillStyle = '#c6f2f5'; ctx.fillRect(Math.round(x2) - 2, Math.round(y2) - 2, 4, 4);
    }
  }
  ctx.restore();
}

export function drawReactionFeedback(ctx, item) {
  const progress = Math.max(0, Math.min(1, 1 - item.life / item.maxLife));
  ctx.save(); ctx.globalAlpha = 1 - progress;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (item.kind === 'label') {
    ctx.font = '700 11px "Noto Sans TC", sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(7, 12, 20, .9)';
    ctx.strokeText(item.text, item.x, item.y - progress * 9);
    ctx.fillStyle = item.color; ctx.fillText(item.text, item.x, item.y - progress * 9);
  } else {
    ctx.font = '700 12px "DM Mono", monospace';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(7, 12, 20, .92)';
    ctx.strokeText(String(item.amount), item.x, item.y - progress * 20);
    ctx.fillStyle = item.color; ctx.fillText(String(item.amount), item.x, item.y - progress * 20);
  }
  ctx.restore();
}

export function drawTargetMarker(ctx, target, time, alpha = .72) {
  const radius = Math.max(13, (target.radius || 0) + 8 + Math.sin(time * 12) * 1.5);
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = target.point ? '#93edc2' : '#d6f4ff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(target.x, target.y, radius, -.65, .65); ctx.stroke();
  ctx.beginPath(); ctx.arc(target.x, target.y, radius, Math.PI - .65, Math.PI + .65); ctx.stroke();
  ctx.fillStyle = target.point ? '#a4efbb' : '#d8f7ff';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 * i + time * .15;
    ctx.fillRect(Math.round(target.x + Math.cos(a) * radius) - 1, Math.round(target.y + Math.sin(a) * radius) - 1, 3, 3);
  }
  ctx.restore();
}

export function drawWorldEvent(ctx, event, time) {
  const pulse = .62 + Math.sin(time * 3.2) * .12;
  ctx.save(); ctx.translate(Math.round(event.x), Math.round(event.y));
  ctx.globalAlpha = pulse; ctx.strokeStyle = event.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 8, 25 + Math.sin(time * 2) * 2, 10, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = .3; ctx.beginPath(); ctx.ellipse(0, 8, 39, 15, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = '#101725'; ctx.fillRect(-9, -22, 18, 30);
  ctx.fillStyle = event.color; ctx.fillRect(-6, -27, 12, 6); ctx.fillRect(-5, -18, 10, 19);
  ctx.fillStyle = '#f1f4e9'; ctx.fillRect(-2, -16, 4, 7);
  ctx.fillStyle = 'rgba(10,15,25,.88)'; ctx.fillRect(-54, -52, 108, 17);
  ctx.strokeStyle = `${event.color}88`; ctx.strokeRect(-53.5, -51.5, 107, 16);
  ctx.font = '500 9px "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e5e8ee'; ctx.fillText(event.name, 0, -43);
  ctx.globalAlpha = .8 + Math.sin(time * 6) * .15; ctx.fillStyle = event.color; ctx.fillRect(-7, 13, 14, 2); ctx.fillRect(-1, 7, 2, 14);
  ctx.restore();
}

export function drawBossWarning(ctx, boss, time) {
  if (!boss?.boss || boss.attackWarning <= 0) return;
  const alpha = .36 + Math.sin(time * 20) * .08;
  ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(boss.warningAngle || 0);
  ctx.globalAlpha = alpha; ctx.fillStyle = '#dc72ae'; ctx.fillRect(22, -3, 250, 6);
  ctx.fillStyle = '#f0a7d5';
  for (let x = 28; x < 260; x += 18) ctx.fillRect(x, -5, 7, 10);
  ctx.fillStyle = '#ffe4f4'; ctx.fillRect(264, -8, 4, 16); ctx.fillRect(268, -4, 5, 8);
  ctx.restore();
}

export function drawEffect(ctx, e) {
  const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
  ctx.fillStyle = e.color; ctx.globalAlpha = alpha;
  const x = Math.round(e.x), y = Math.round(e.y), size = Math.max(1, Math.round(e.size));
  ctx.fillRect(x, y, size, size);
  if (e.shape === 1 && size >= 2) { ctx.fillRect(x - 2, y + 1, size + 4, 1); ctx.fillRect(x + 1, y - 2, 1, size + 4); }
  else if (e.shape === 2 && size >= 3) { ctx.fillRect(x - 2, y - 2, 2, 2); ctx.fillRect(x + size, y + size, 2, 2); }
  ctx.globalAlpha = 1;
}

export function drawDamageNumber(ctx, item) {
  const alpha = Math.max(0, item.life / item.maxLife);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = item.critical ? '700 15px "DM Mono", monospace' : '600 11px "DM Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5, 9, 16, .88)'; ctx.strokeText(String(Math.round(item.amount)), item.x, item.y - (1 - alpha) * 18);
  ctx.fillStyle = item.color; ctx.fillText(String(Math.round(item.amount)), item.x, item.y - (1 - alpha) * 18);
  ctx.restore();
}
