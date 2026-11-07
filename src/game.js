import { BASIC_ATTACK, clamp, distance, ENEMY_LIMIT, PLAYER_MOVEMENT, UPGRADES, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './constants.js';
import { createEffect, createMagicBurst, createMagicZone, createPlayer, createProjectile, drawActor, drawBossWarning, drawDamageNumber, drawEffect, drawMagicArc, drawMagicBurst, drawMagicZone, drawProjectile, drawReactionEffect, drawReactionFeedback, drawTargetMarker, drawWorldEvent, enemyStats, projectileHitsWall } from './entities.js';
import { drawWorld, findOpenSpawnPoint, isBlocked, moveWithCollision } from './world.js';
import { drawUI } from './ui.js';
import { MAGIC_SPELLS, MAGIC_SLOTS, normalizeLoadout, projectileLife } from './magic.js';
import { rotateTowards } from './movement.js';
import { findAimedEnemy, findNearestEnemy, isValidEnemy } from './targeting.js';
import { applyElementMark, BOSS_CONTROL_LIMITS, ELEMENT_IDS, ELEMENT_MARK_DURATION, ELEMENT_REACTIONS, REACTION_IDS, updateElementState } from './reactions.js';
import { AudioBus } from './audio.js';
import { readSetting, writeSetting } from './storage.js';
import { createWorldEvent, resolveWorldEvent, WORLD_EVENT_RADIUS, WORLD_EVENTS } from './events.js';

const unit = (x, y) => { const n = Math.hypot(x, y) || 1; return [x / n, y / n]; };

export class Game {
  constructor(canvas, statusNode) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.statusNode = statusNode;
    this.audio = new AudioBus();
    this.screen = 'menu'; this.clock = 0; this.elapsed = 0; this.player = null;
    this.camera = { x: 640, y: 500 }; this.keys = new Set(); this.buttons = [];
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false };
    this.enemies = []; this.projectiles = []; this.effects = []; this.damageNumbers = []; this.dashAfterimages = []; this.dashTrailTimer = 0; this.magicZones = []; this.magicArcs = []; this.magicBursts = []; this.reactionEffects = []; this.reactionFeedback = []; this.spawnTimer = 2;
    this.boss = null; this.bossSpawned = false; this.announcement = 0; this.choices = [];
    this.worldEvent = null; this.worldEventTimer = 34; this.eventDamageTimer = 0;
    let storedLoadout = null;
    try { storedLoadout = JSON.parse(readSetting('veil-magic-loadout')); } catch {}
    this.loadout = normalizeLoadout(storedLoadout);
    this.spellCooldowns = MAGIC_SLOTS.map(() => 0); this.selectedLoadoutSlot = 0;
    this.activeSpellSlot = -1; this.activeSpellTimer = 0;
    this.basicAttackTarget = null; this.basicAttackTimer = 0;
    this.inputFocused = true; this.skillFacingTarget = null; this.skillFacingTimer = 0;
    this.lockedTarget = null; this.lockedTargetTimer = 0;
    this.deferLevelUp = false; this.levelUpPending = false;
    this.difficulty = readSetting('veil-difficulty') === 'nightmare' ? 'nightmare' : 'normal';
    this.reducedFx = readSetting('veil-reduced-fx') === 'true';
    this.flashTimer = 0; this.shake = 0; this.toast = ''; this.toastTimer = 0;
    this.resize();
  }

  resize() {
    const dpr = globalThis.devicePixelRatio || 1;
    const cssScale = this.canvas.clientWidth ? this.canvas.clientWidth / VIEW_W : 1;
    const scale = Math.max(1, Math.min(3, dpr * Math.max(1, cssScale)));
    this.canvas.width = Math.round(VIEW_W * scale); this.canvas.height = Math.round(VIEW_H * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  formatTime() {
    const sec = Math.floor(this.elapsed);
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }

  start() {
    this.player = createPlayer(); this.elapsed = 0; this.enemies = []; this.projectiles = []; this.effects = []; this.damageNumbers = []; this.dashAfterimages = []; this.dashTrailTimer = 0; this.magicZones = []; this.magicArcs = []; this.magicBursts = []; this.reactionEffects = []; this.reactionFeedback = [];
    this.spellCooldowns = MAGIC_SLOTS.map(() => 0); this.activeSpellSlot = -1; this.activeSpellTimer = 0;
    this.basicAttackTarget = null; this.basicAttackTimer = 0; this.skillFacingTarget = null; this.skillFacingTimer = 0;
    this.lockedTarget = null; this.lockedTargetTimer = 0;
    this.deferLevelUp = false; this.levelUpPending = false;
    this.spawnTimer = 1.4; this.boss = null; this.bossSpawned = false; this.announcement = 0;
    this.worldEvent = null; this.worldEventTimer = 34; this.eventDamageTimer = 0;
    this.screen = 'playing'; this.cameraToPlayer(); this.keys.clear(); this.mouse.down = false;
    this.announce('試煉開始，留意四周的霧光。');
  }

  announce(message) {
    this.toast = message; this.toastTimer = 2.2;
    if (this.statusNode) this.statusNode.textContent = message;
  }

  setMouse(x, y) { this.mouse.x = x; this.mouse.y = y; }

  getMouseWorld() { return { x: this.camera.x + this.mouse.x, y: this.camera.y + this.mouse.y }; }

  setInputFocused(focused) {
    this.inputFocused = focused;
    if (!focused) {
      this.keys.clear();
      this.mouse.down = false;
      if (this.player) this.player.dashTimer = 0;
    } else {
      this.mouse.x = VIEW_W / 2; this.mouse.y = VIEW_H / 2;
    }
  }

  keyDown(key) {
    this.audio.unlock();
    const k = key.toLowerCase();
    if (this.screen === 'playing' && k === ' ') this.tryDash();
    if (this.screen === 'playing' && k === 'f' && this.inputFocused) { this.interactWorldEvent(); return true; }
    if ([' ', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (this.screen === 'playing' && k !== ' ') this.keys.add(k);
      return true;
    }
    if (k === 'escape') {
      if (this.screen === 'playing') { this.screen = 'paused'; this.keys.clear(); }
      else if (this.screen === 'paused') this.screen = 'playing';
      else if (this.screen === 'settings' || this.screen === 'howto' || this.screen === 'loadout') this.screen = 'menu';
      return true;
    }
    if (this.screen === 'levelup' && /^[1-3]$/.test(k)) this.chooseUpgrade(Number(k) - 1);
    if (this.screen === 'menu' && k === 'enter') this.start();
    return false;
  }

  keyUp(key) { this.keys.delete(key.toLowerCase()); }

  tryDash() {
    const p = this.player;
    if (!p || p.dashCooldown > 0 || this.screen !== 'playing') return;
    const target = this.getMouseWorld();
    let dx = target.x - p.x, dy = target.y - p.y;
    if (Math.hypot(dx, dy) <= PLAYER_MOVEMENT.stopDistance) { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
    [dx, dy] = unit(dx, dy);
    p.dashVector = { x: dx, y: dy }; p.dashTimer = .16; p.dashCooldown = 2.3; p.invulnerable = .36;
    this.dashTrailTimer = 0;
    this.playSound('dash');
    this.addEffect(p.x, p.y, '#a4dcff', this.reducedFx ? 4 : 12, 3);
  }

  pointerDown(x, y, button = 0) {
    this.setMouse(x, y);
    if (button === 0 || button === 2) this.audio.unlock();
    const hit = [...this.buttons].reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit) return this.activate(hit);
    if (this.screen === 'playing' && this.inputFocused) {
      if (button === 0) this.castSpell(0);
      if (button === 2) this.castSpell(1);
    }
  }

  pointerUp(x, y, button = 0) {
    this.setMouse(x, y);
    if (button === 0 || button === 2) this.mouse.down = false;
  }

  cancelPointerInput() { this.mouse.down = false; }

  playSound(id) { this.audio.play(id); }

  activate(hit) {
    switch (hit.id) {
      case 'start': case 'restart': this.start(); break;
      case 'settings': this.screen = 'settings'; break;
      case 'howto': this.screen = 'howto'; break;
      case 'loadout': this.screen = 'loadout'; this.selectedLoadoutSlot = 0; break;
      case 'back': this.screen = 'menu'; break;
      case 'difficulty': this.difficulty = this.difficulty === 'normal' ? 'nightmare' : 'normal'; writeSetting('veil-difficulty', this.difficulty); break;
      case 'effects': this.reducedFx = !this.reducedFx; writeSetting('veil-reduced-fx', this.reducedFx); break;
      case 'audio': this.audio.toggle(); break;
      case 'pause': this.screen = 'paused'; break;
      case 'resume': this.screen = 'playing'; break;
      case 'menu':
        this.screen = 'menu'; this.player = null; this.boss = null;
        this.enemies = []; this.projectiles = []; this.effects = []; this.damageNumbers = []; this.magicZones = []; this.magicArcs = []; this.magicBursts = []; this.reactionEffects = []; this.reactionFeedback = []; this.worldEvent = null; this.keys.clear();
        break;
      case 'upgrade': this.chooseUpgrade(hit.index); break;
      case 'loadout-slot': this.selectedLoadoutSlot = hit.index; break;
      case 'loadout-spell': {
        const targetIndex = this.selectedLoadoutSlot, sourceIndex = this.loadout.indexOf(hit.spellId);
        if (targetIndex >= 0 && MAGIC_SPELLS[hit.spellId]) {
          if (sourceIndex >= 0 && sourceIndex !== targetIndex) {
            [this.loadout[targetIndex], this.loadout[sourceIndex]] = [this.loadout[sourceIndex], this.loadout[targetIndex]];
          } else if (sourceIndex < 0) {
            this.loadout[targetIndex] = hit.spellId;
          }
          writeSetting('veil-magic-loadout', JSON.stringify(this.loadout));
        }
        break;
      }
    }
  }

  castSpell(slotIndex = 0) {
    if (this.screen !== 'playing' || !this.player || slotIndex < 0 || slotIndex >= MAGIC_SLOTS.length) return false;
    const p = this.player;
    const spellId = this.loadout[slotIndex], spell = MAGIC_SPELLS[spellId];
    if (!spell || this.spellCooldowns[slotIndex] > 0) return false;
    const aim = this.getMouseWorld();
    let a = Math.atan2(aim.y - p.y, aim.x - p.x);
    if (Math.hypot(aim.x - p.x, aim.y - p.y) < 1) a = p.facing;
    const [dx, dy] = unit(Math.cos(a), Math.sin(a));
    const zoneRadius = spell.castMode === 'zone' ? spell.zoneRadius * (1 + p.natureRadiusBonus) : 0;
    const selection = spell.castMode === 'zone' ? null : findAimedEnemy(p, this.enemies, spell.range, a);
    if (p.mana < spell.manaCost) return false;
    let targetX = p.x + dx * Math.min(spell.range, Math.hypot(aim.x - p.x, aim.y - p.y));
    let targetY = p.y + dy * Math.min(spell.range, Math.hypot(aim.x - p.x, aim.y - p.y));
    const stepBack = spell.castMode === 'zone' ? Math.ceil(zoneRadius / 12) : 0;
    for (let i = 0; i < stepBack && isBlocked(targetX, targetY, Math.min(16, zoneRadius * .45)); i++) {
      targetX -= dx * 12; targetY -= dy * 12;
    }
    if (spell.castMode === 'zone' && isBlocked(targetX, targetY, Math.min(16, zoneRadius * .45))) return false;
    const target = selection || { x: targetX, y: targetY, radius: 0 };
    const damage = spell.damage * (p.damage / 22);
    p.mana -= spell.manaCost;
    p.castTimer = .2;
    this.spellCooldowns[slotIndex] = Math.max(.12, spell.cooldown * (p.fireDelay / .34));
    this.activeSpellSlot = slotIndex; this.activeSpellTimer = .55;
    p.facing = rotateTowards(p.facing, a, Math.PI);
    this.skillFacingTarget = target;
    this.skillFacingTimer = .65;
    this.lockedTarget = spell.castMode === 'zone'
      ? { x: targetX, y: targetY, radius: zoneRadius, point: true }
      : selection ? { x: selection.x, y: selection.y, radius: selection.radius, enemy: selection } : { x: targetX, y: targetY, radius: 7, point: true };
    this.lockedTargetTimer = .65;
    if (spell.castMode === 'zone') {
      // Keep a single bounded field active, preventing overlapping roots from locking enemies indefinitely.
      this.magicZones = [createMagicZone({ x: targetX, y: targetY, spellId, color: spell.color, damage,
        radius: zoneRadius, duration: spell.zoneDuration, tickInterval: spell.tickInterval, rootDuration: spell.rootDuration })];
      this.addEffect(targetX, targetY, spell.color, this.reducedFx ? 3 : 9, 3);
    } else {
      const muzzle = 18;
      const spellTuning = spellId === 'fire' ? { explosionRadius: spell.explosionRadius * (1 + p.fireRadiusBonus) }
        : spellId === 'ice' ? { slowDuration: spell.slowDuration + p.iceDurationBonus, iceRadius: spell.iceRadius, splashRatio: spell.splashRatio }
          : spellId === 'lightning' ? { chainCount: Math.min(7, spell.chainCount + p.lightningChainBonus) } : {};
      this.projectiles.push(createProjectile({ x: p.x + dx * muzzle, y: p.y + dy * muzzle,
        vx: dx * spell.speed, vy: dy * spell.speed, damage, owner: 'player', type: spellId,
        radius: spell.radius, life: projectileLife(spell), magicId: spellId, magicColor: spell.color, ...spellTuning }));
      this.playSound(spellId);
      this.addEffect(p.x + dx * 15, p.y + dy * 15, spell.color, this.reducedFx ? 2 : 5, 2);
    }
    return true;
  }

  chooseUpgrade(index) {
    const choice = this.choices[index];
    if (!choice || this.screen !== 'levelup') return;
    choice.apply(this.player); this.screen = 'playing'; this.playSound('level');
    this.announce(`能力獲得：${choice.name}`);
    if (this.player.xp >= this.player.nextXp) this.levelUp();
  }

  levelUp() {
    const p = this.player;
    p.xp -= p.nextXp; p.level++; p.nextXp = Math.round(p.nextXp * 1.32 + 8);
    const pool = UPGRADES.filter(upgrade => (!upgrade.spellId || this.loadout.includes(upgrade.spellId)) && (!upgrade.isAvailable || upgrade.isAvailable(p)));
    this.choices = [];
    while (this.choices.length < 3 && pool.length) this.choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.screen = 'levelup';
  }

  cameraToPlayer() {
    if (!this.player) return;
    this.camera.x = clamp(this.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    this.camera.y = clamp(this.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  addEffect(x, y, color, count, size) {
    if (this.reducedFx) count = Math.min(count, 3);
    this.effects.push(...createEffect(x, y, color, count, size));
    const cap = this.reducedFx ? 72 : 180;
    if (this.effects.length > cap) this.effects.splice(0, this.effects.length - cap);
  }

  spawnEnemy(type = null, forceElite = false, origin = this.player) {
    const p = this.player;
    const spawn = findOpenSpawnPoint(origin || p, 430, 610, 28, this.enemies);
    if (!spawn) return null;
    const { x, y } = spawn;
    if (!type) {
      const r = Math.random();
      type = this.elapsed < 18 ? (r < .68 ? 'stalker' : 'wisp') : r < .46 ? 'stalker' : r < .77 ? 'wisp' : 'brute';
    }
    const scale = (1 + this.elapsed / 150) * (this.difficulty === 'nightmare' ? 1.3 : 1);
    const enemy = enemyStats(type, x, y, scale);
    const eliteChance = this.elapsed < 35 ? 0 : Math.min(.2, .075 + (this.elapsed - 35) * .0008);
    if (forceElite || Math.random() < eliteChance) {
      enemy.elite = true; enemy.maxHp *= 1.42; enemy.hp = enemy.maxHp;
      enemy.speed *= 1.12; enemy.damage *= 1.08; enemy.xp = Math.round(enemy.xp * 1.7);
      enemy.radius += 2; enemy.eliteCooldown = 1.2 + Math.random() * .7;
    }
    this.enemies.push(enemy);
    return enemy;
  }

  spawnBoss() {
    const p = this.player;
    let angle = Math.random() * Math.PI * 2, x, y;
    for (let i = 0; i < 12; i++, angle += Math.PI / 6) {
      x = clamp(p.x + Math.cos(angle) * 430, 80, WORLD_W - 80);
      y = clamp(p.y + Math.sin(angle) * 430, 80, WORLD_H - 80);
      if (!isBlocked(x, y, 34)) break;
    }
    const bossPoint = findOpenSpawnPoint(p, 390, 470, 34, this.enemies) || { x, y };
    this.boss = enemyStats('boss', bossPoint.x, bossPoint.y, this.difficulty === 'nightmare' ? 1.25 : 1);
    this.boss.hp = this.boss.maxHp; this.enemies.push(this.boss);
    this.playSound('boss');
    this.bossSpawned = true; this.announcement = 3.8; this.shake = 8;
  }

  update(dt) {
    this.clock += dt;
    if (this.screen === 'menu' || this.screen === 'settings' || this.screen === 'howto') return;
    if (this.screen === 'loadout') return;
    if (this.screen !== 'playing') return;
    this.elapsed += dt; const p = this.player;
    this.updateWorldEvents(dt);
    if (this.eventDamageTimer > 0) {
      this.eventDamageTimer = Math.max(0, this.eventDamageTimer - dt);
      if (this.eventDamageTimer === 0) p.damage /= 1.2;
    }
    this.spellCooldowns = this.spellCooldowns.map(timer => Math.max(0, timer - dt));
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt); p.castTimer = Math.max(0, p.castTimer - dt); p.mana = Math.min(p.maxMana, p.mana + p.manaRegen * dt);
    this.activeSpellTimer = Math.max(0, this.activeSpellTimer - dt);
    this.skillFacingTimer = Math.max(0, this.skillFacingTimer - dt);
    this.lockedTargetTimer = Math.max(0, this.lockedTargetTimer - dt);
    if (!this.skillFacingTimer) this.skillFacingTarget = null;
    if (this.lockedTarget?.enemy && !this.enemies.includes(this.lockedTarget.enemy)) this.lockedTarget = null;
    this.announcement = Math.max(0, this.announcement - dt); this.toastTimer = Math.max(0, this.toastTimer - dt);
    this.updatePlayerMovement(dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < ENEMY_LIMIT[this.difficulty]) {
      this.spawnEnemy(); this.spawnTimer = Math.max(.62, 1.8 - this.elapsed / 155) * (this.difficulty === 'nightmare' ? .82 : 1);
    }
    if (!this.bossSpawned && this.elapsed >= 76) this.spawnBoss();
    this.updateEnemies(dt);
    this.updateBasicAttack(dt);
    this.updateMagicZones(dt);
    if (this.screen === 'playing') this.updateProjectiles(dt);
    this.updateEffects(dt);
    if (p.hp <= 0 && this.screen === 'playing') { this.screen = 'gameover'; this.worldEvent = null; this.playSound('death'); }
  }

  updateWorldEvents(dt) {
    if (this.worldEvent) {
      this.worldEvent.remaining -= dt;
      if (this.worldEvent.remaining <= 0) { this.worldEvent = null; this.announce('庭園中的異象已消散。'); }
      return;
    }
    this.worldEventTimer -= dt;
    if (this.worldEventTimer > 0) return;
    const point = findOpenSpawnPoint(this.player, 150, 230, 20, this.enemies, 56);
    if (!point) { this.worldEventTimer = 4; return; }
    const kinds = Object.keys(WORLD_EVENTS);
    const type = kinds[Math.floor(Math.random() * kinds.length)];
    this.worldEvent = createWorldEvent(type, point.x, point.y);
    this.worldEventTimer = 46 + Math.random() * 18;
    this.announce(`庭園異象：${this.worldEvent.name}。靠近後按 F 互動。`);
  }

  interactWorldEvent() {
    const event = this.worldEvent;
    if (!event || !this.player || distance(event, this.player) > WORLD_EVENT_RADIUS) return false;
    const result = resolveWorldEvent(event.id, this.player);
    if (!result) return false;
    this.player.xp += result.xp;
    if (result.powerSeconds > 0) {
      if (this.eventDamageTimer <= 0) this.player.damage *= 1.2;
      this.eventDamageTimer = Math.max(this.eventDamageTimer, result.powerSeconds);
      for (let i = 0; i < result.spawns && this.enemies.length < ENEMY_LIMIT[this.difficulty]; i++) {
        this.spawnEnemy(null, i === 0, event);
      }
      this.announce('裂隙封印：魔力增幅 10 秒，精英敵潮逼近！');
    } else {
      this.announce(`泉祠回應：恢復 ${Math.round(result.hp)} 生命、${Math.round(result.mana)} 魔力。`);
    }
    this.addEffect(event.x, event.y, event.color, this.reducedFx ? 8 : 16, 4);
    this.worldEvent = null;
    if (this.player.xp >= this.player.nextXp) this.levelUp();
    return true;
  }

  updatePlayerMovement(dt) {
    const p = this.player, mouseWorld = this.getMouseWorld();
    let dx = 0, dy = 0, speed = 0;
    if (p.dashTimer > 0) {
      dx = p.dashVector.x; dy = p.dashVector.y; speed = 590;
    } else if (this.inputFocused) {
      dx = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
      dy = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
      const length = Math.hypot(dx, dy);
      if (length > 0) { dx /= length; dy /= length; speed = p.speed; }
    }
    if (this.inputFocused) p.facing = rotateTowards(p.facing, Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x), PLAYER_MOVEMENT.turnRate * dt);
    p.moving = speed > 0;
    if (speed > 0) moveWithCollision(p, dx * speed * dt, dy * speed * dt, p.radius);
    if (p.dashTimer > 0) {
      this.dashTrailTimer -= dt;
      if (this.dashTrailTimer <= 0) {
        this.dashAfterimages.push({ x: p.x, y: p.y, facing: p.facing, radius: p.radius, type: 'player', moving: true, opacity: .3, life: .22, maxLife: .22 });
        this.dashTrailTimer = .045;
        const cap = this.reducedFx ? 3 : 6;
        if (this.dashAfterimages.length > cap) this.dashAfterimages.splice(0, this.dashAfterimages.length - cap);
      }
    }
    this.cameraToPlayer();
  }

  updateBasicAttack(dt) {
    const p = this.player;
    this.basicAttackTimer = Math.max(0, this.basicAttackTimer - dt);
    const targetStillValid = this.basicAttackTarget && this.enemies.includes(this.basicAttackTarget) &&
      isValidEnemy(this.basicAttackTarget) && distance(p, this.basicAttackTarget) <= BASIC_ATTACK.range;
    if (!targetStillValid || this.basicAttackTimer <= 0) {
      this.basicAttackTarget = findNearestEnemy(p, this.enemies, BASIC_ATTACK.range);
    }
    const target = this.basicAttackTarget;
    if (!target) return;
    if (this.skillFacingTimer <= 0) {
      const angle = Math.atan2(target.y - p.y, target.x - p.x);
      p.facing = rotateTowards(p.facing, angle, PLAYER_MOVEMENT.turnRate * dt);
    }
    if (this.basicAttackTimer <= 0) {
      this.fireBasicAttack(target);
      this.basicAttackTimer = BASIC_ATTACK.interval;
    }
  }

  fireBasicAttack(target) {
    const p = this.player;
    if (!isValidEnemy(target) || !this.enemies.includes(target) || distance(p, target) > BASIC_ATTACK.range) return;
    const a = Math.atan2(target.y - p.y, target.x - p.x), [dx, dy] = unit(Math.cos(a), Math.sin(a));
    this.projectiles.push(createProjectile({
      x: p.x + dx * 18, y: p.y + dy * 18,
      vx: dx * BASIC_ATTACK.projectileSpeed, vy: dy * BASIC_ATTACK.projectileSpeed,
      damage: BASIC_ATTACK.damage * (p.damage / 22), owner: 'player', type: 'basic',
      radius: BASIC_ATTACK.projectileRadius, life: BASIC_ATTACK.range / BASIC_ATTACK.projectileSpeed,
      magicId: 'basic', magicColor: '#7fe4de',
    }));
    this.playSound('basic');
    this.addEffect(p.x + dx * 16, p.y + dy * 16, '#7fe4de', this.reducedFx ? 1 : 3, 2);
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.boss) {
        if (e.attackWarning > 0) {
          e.attackWarning = Math.max(0, e.attackWarning - dt);
          if (e.attackWarning === 0) {
            this.enemyShoot(e, 270, 12);
            e.attackTimer = e.phaseTwo ? 1.75 : 2.2;
          }
        } else {
          e.attackTimer -= dt;
          if (e.attackTimer <= 0) {
            e.warningAngle = Math.atan2(p.y - e.y, p.x - e.x);
            e.attackWarning = e.phaseTwo ? .38 : .52;
          }
        }
      } else e.attackTimer -= dt;
      updateElementState(e, dt);
      e.slowTimer = Math.max(0, e.slowTimer - dt);
      if (e.slowTimer <= 0) e.slowFactor = 1;
      e.rootTimer = Math.max(0, e.rootTimer - dt);
      const diffX = p.x - e.x, diffY = p.y - e.y, d = Math.hypot(diffX, diffY) || 1;
      let [dx, dy] = [diffX / d, diffY / d];
      if (e.elite) {
        if (e.eliteWindup > 0) {
          e.eliteWindup = Math.max(0, e.eliteWindup - dt);
          if (e.eliteWindup === 0) e.eliteDash = .26;
        } else if (e.eliteDash <= 0) {
          e.eliteCooldown -= dt;
          if (e.eliteCooldown <= 0) {
            e.eliteAngle = Math.atan2(p.y - e.y, p.x - e.x);
            e.eliteWindup = .48;
            e.eliteCooldown = 3.8;
          }
        }
      }
      e.phase += dt * 4;
      if (e.type === 'wisp') {
        if (d < 235) { dx *= -1; dy *= -1; }
        else if (d < 355) { dx = -dy * .48; dy = dx * .48; }
        else { dx *= .8; dy *= .8; }
        dx += Math.sin(e.phase) * .27; dy += Math.cos(e.phase * .8) * .27;
        [dx, dy] = unit(dx, dy);
        if (d < 475 && e.attackTimer <= 0) { this.enemyShoot(e, 245, 9); e.attackTimer = 2.35; }
      } else {
        if (e.type === 'boss' && d < 205) { dx *= .38; dy *= .38; }
      }
      const wobble = e.type === 'wisp' ? Math.sin(e.phase) * 5 : 0;
      const eliteDashing = e.elite && e.eliteDash > 0;
      if (eliteDashing) { dx = Math.cos(e.eliteAngle); dy = Math.sin(e.eliteAngle); e.eliteDash = Math.max(0, e.eliteDash - dt); }
      const rooted = e.rootTimer > 0 && !eliteDashing, movementSpeed = e.speed * (e.slowTimer > 0 ? e.slowFactor : 1) * (eliteDashing ? 3.1 : 1);
      if (!rooted) moveWithCollision(e, (dx * movementSpeed + e.knockX + wobble) * dt, (dy * movementSpeed + e.knockY) * dt, e.radius);
      e.knockX *= Math.max(0, 1 - dt * 7); e.knockY *= Math.max(0, 1 - dt * 7);
      if (d < p.radius + e.radius + 2 && e.attackTimer <= 0 && p.invulnerable <= 0) {
        this.damagePlayer(e.damage); e.attackTimer = e.type === 'boss' ? 1.5 : e.type === 'brute' ? 1.25 : .88;
        const [kx, ky] = unit(p.x - e.x, p.y - e.y); moveWithCollision(p, kx * 15, ky * 15, p.radius);
      }
    }
  }

  enemyShoot(enemy, speed, damage) {
    const a = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const offsets = enemy.boss ? enemy.phaseTwo ? [-.3, 0, .3] : [-.18, .18] : [0];
    for (const offset of offsets) this.projectiles.push(createProjectile({
      x: enemy.x, y: enemy.y, vx: Math.cos(a + offset) * speed, vy: Math.sin(a + offset) * speed,
      damage: damage * (this.difficulty === 'nightmare' ? 1.16 : 1), owner: 'enemy', type: 'hex', radius: enemy.type === 'boss' ? 7 : 6, life: 2.5,
    }));
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.invulnerable > 0 || this.screen !== 'playing') return;
    p.hp -= amount * (1 - p.armor); p.invulnerable = .42; p.hitFlash = .17;
    this.playSound('hit');
    this.flashTimer = this.reducedFx ? 0 : .08; this.shake = Math.min(8, this.shake + 2.7);
    this.addEffect(p.x, p.y, '#ed8796', 8, 2);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 3;
      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > WORLD_W || p.y > WORLD_H || projectileHitsWall(p)) { this.projectiles.splice(i, 1); continue; }
      if (p.owner === 'player') {
        const e = this.enemies.find(target => distance(p, target) < p.radius + target.radius);
        if (e) {
          this.projectiles.splice(i, 1);
          this.applyMagicImpact(p, e);
          if (this.screen !== 'playing') break;
        }
      } else if (distance(p, this.player) < p.radius + this.player.radius) {
        this.damagePlayer(p.damage); this.projectiles.splice(i, 1);
      }
    }
  }

  applyEnemyDamage(enemy, amount, color, knockback = true) {
    if (!this.enemies.includes(enemy)) return;
    enemy.hp -= amount; enemy.hitFlash = .14;
    this.addDamageNumber(enemy.x, enemy.y - enemy.radius, amount, color || (enemy.boss ? '#f0b5e4' : '#f2eee4'));
    if (enemy.boss && !enemy.phaseTwo && enemy.hp > 0 && enemy.hp <= enemy.maxHp * .5) {
      enemy.phaseTwo = true; enemy.attackWarning = 0; enemy.attackTimer = .62;
      this.announcement = 3; this.announce('暮鐘監院的鐘核裂開了！');
    }
    if (knockback) {
      const [nx, ny] = unit(enemy.x - this.player.x, enemy.y - this.player.y);
      enemy.knockX += nx * (enemy.boss ? 90 : 155); enemy.knockY += ny * (enemy.boss ? 90 : 155);
    }
    this.addEffect(enemy.x, enemy.y, color || (enemy.boss ? '#e1a3ff' : '#91ecf3'), 6, 3);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  applyMagicImpact(projectile, firstTarget) {
    if (projectile.magicId === 'basic') {
      this.applyEnemyDamage(firstTarget, projectile.damage, projectile.magicColor);
      return;
    }
    const spell = MAGIC_SPELLS[projectile.magicId] || MAGIC_SPELLS.fire;
    const reactionContext = { triggered: new Set() };
    if (spell.id === 'fire') {
      const explosionRadius = projectile.explosionRadius ?? spell.explosionRadius;
      const nearby = this.enemies.filter(enemy => distance(projectile, enemy) <= explosionRadius + enemy.radius);
      if (!nearby.includes(firstTarget)) nearby.push(firstTarget);
      this.resolveMagicBatch(() => {
        for (const enemy of nearby) {
          const damage = projectile.damage * (enemy === firstTarget ? 1 + spell.splashRatio : spell.splashRatio);
          this.applyEnemyDamage(enemy, damage, spell.color);
          if (this.enemies.includes(enemy)) this.applyElementalHit(enemy, 'fire', reactionContext);
          if (this.screen !== 'playing') break;
        }
      });
      this.magicBursts.push(createMagicBurst(projectile.x, projectile.y, explosionRadius, spell.color));
      if (this.magicBursts.length > 24) this.magicBursts.splice(0, this.magicBursts.length - 24);
      this.addEffect(projectile.x, projectile.y, spell.color, this.reducedFx ? 4 : 12, 5);
      return;
    }

    if (spell.id === 'ice') {
      const iceRadius = projectile.iceRadius ?? spell.iceRadius;
      const nearby = this.enemies.filter(enemy => distance(firstTarget, enemy) <= iceRadius + enemy.radius);
      if (!nearby.includes(firstTarget)) nearby.unshift(firstTarget);
      this.resolveMagicBatch(() => {
        for (const enemy of nearby) {
          this.applyEnemyDamage(enemy, enemy === firstTarget ? projectile.damage : projectile.damage * (projectile.splashRatio ?? spell.splashRatio), spell.color);
          if (this.enemies.includes(enemy) && enemy.slowTimer <= 0) {
            enemy.slowFactor = enemy.boss ? BOSS_CONTROL_LIMITS.iceSlowFactor : clamp(spell.slowFactor, .45, 1);
            enemy.slowTimer = enemy.boss ? BOSS_CONTROL_LIMITS.iceSlowDuration : clamp(projectile.slowDuration ?? spell.slowDuration, .1, 2.5);
          }
          if (this.enemies.includes(enemy)) this.applyElementalHit(enemy, 'ice', reactionContext);
          if (this.screen !== 'playing') break;
        }
      });
      this.magicBursts.push(createMagicBurst(firstTarget.x, firstTarget.y, iceRadius, spell.color, 'ice'));
      if (this.magicBursts.length > 24) this.magicBursts.splice(0, this.magicBursts.length - 24);
      this.addEffect(firstTarget.x, firstTarget.y, spell.color, this.reducedFx ? 4 : 12, 4);
      return;
    }

    if (spell.id === 'lightning') {
      const visited = new Set([firstTarget]);
      let current = firstTarget, chainDamage = projectile.damage;
      this.resolveMagicBatch(() => {
        this.applyEnemyDamage(current, chainDamage, spell.color, false);
        if (this.enemies.includes(current)) this.applyElementalHit(current, 'lightning', reactionContext);
        const chainCount = projectile.chainCount ?? spell.chainCount;
        for (let hop = 1; hop < chainCount && this.screen === 'playing'; hop++) {
          const next = this.enemies
            .filter(enemy => !visited.has(enemy) && distance(current, enemy) <= spell.chainRange)
            .sort((a, b) => distance(current, a) - distance(current, b))[0];
          if (!next) break;
          visited.add(next);
          this.magicArcs.push({ x1: current.x, y1: current.y, x2: next.x, y2: next.y, life: .16, maxLife: .16 });
          this.addEffect(next.x, next.y, '#e6dbff', this.reducedFx ? 2 : 5, 3);
          chainDamage *= spell.chainFalloff;
          this.applyEnemyDamage(next, chainDamage, spell.color, false);
          if (this.enemies.includes(next)) this.applyElementalHit(next, 'lightning', reactionContext);
          current = next;
        }
      });
      if (this.magicArcs.length > 24) this.magicArcs.splice(0, this.magicArcs.length - 24);
      return;
    }
  }

  applyElementalHit(enemy, element, context) {
    const reactionId = applyElementMark(enemy, element, ELEMENT_MARK_DURATION[element], context.triggered);
    if (!reactionId || context.triggered.has(reactionId)) return;
    context.triggered.add(reactionId);
    const reaction = ELEMENT_REACTIONS[reactionId], scale = this.player.damage / 22;
    const damage = reaction.damage * scale;
    const color = reactionId === 'steamBurst' ? '#d2f4f2' : reactionId === 'lightningVines' ? '#a7efc7' : '#b7efff';
    this.addReactionLabel(enemy, reaction.name, color);
    this.playSound(reactionId);

    if (reactionId === 'steamBurst') {
      this.applyReactionDamage(enemy, damage, reactionId, color);
      for (const nearby of [...this.enemies]) {
        if (this.screen !== 'playing') break;
        if (nearby === enemy || distance(enemy, nearby) > reaction.radius + nearby.radius) continue;
        this.applyReactionDamage(nearby, reaction.splashDamage * scale, reactionId, color);
      }
      this.addReactionEffect({ id: reactionId, x: enemy.x, y: enemy.y, radius: reaction.radius, life: reaction.duration, maxLife: reaction.duration });
    } else if (reactionId === 'lightningVines') {
      this.applyReactionDamage(enemy, damage, reactionId, color);
      const visited = new Set([enemy]); let current = enemy;
      for (let i = 0; i < reaction.maxTargets; i++) {
        let next = null, nearestDistance = reaction.range;
        for (const candidate of this.enemies) {
          if (visited.has(candidate)) continue;
          const candidateDistance = distance(current, candidate);
          if (candidateDistance <= nearestDistance) { next = candidate; nearestDistance = candidateDistance; }
        }
        if (!next) break;
        visited.add(next);
        this.addReactionEffect({ id: reactionId, x: current.x, y: current.y, x2: next.x, y2: next.y, life: reaction.duration, maxLife: reaction.duration });
        this.applyReactionDamage(next, reaction.hopDamage * scale, reactionId, color);
        current = next;
        if (this.screen !== 'playing') break;
      }
    } else if (reactionId === 'frozenThorns') {
      this.applyReactionDamage(enemy, damage, reactionId, color);
      if (enemy.boss) {
        if (enemy.slowTimer <= 0) {
          enemy.slowFactor = BOSS_CONTROL_LIMITS.frozenThornsSlowFactor;
          enemy.slowTimer = BOSS_CONTROL_LIMITS.frozenThornsSlowDuration;
        }
      } else {
        enemy.rootTimer = Math.max(enemy.rootTimer, reaction.rootDuration);
      }
      this.addReactionEffect({ id: reactionId, x: enemy.x, y: enemy.y, radius: enemy.radius + 20, life: reaction.duration, maxLife: reaction.duration });
    }

  }

  applyReactionDamage(enemy, amount, reactionId, color) {
    const x = enemy.x, y = enemy.y - enemy.radius - 7;
    this.applyEnemyDamage(enemy, amount, color, false);
    this.addReactionFeedback({ kind: 'damage', reactionId, amount: Math.round(amount), x, y, life: .64, maxLife: .64 });
  }

  addReactionLabel(enemy, text, color) {
    this.addReactionFeedback({ kind: 'label', reactionId: '', text, color, x: enemy.x, y: enemy.y - enemy.radius - 18, life: .82, maxLife: .82 });
  }

  addReactionFeedback(item) {
    if (item.kind === 'damage') {
      const existing = this.reactionFeedback.find(entry => entry.kind === 'damage' && entry.reactionId === item.reactionId && Math.hypot(entry.x - item.x, entry.y - item.y) < 18 && entry.life > .34);
      if (existing) {
        existing.amount += item.amount;
        return;
      }
    }
    this.reactionFeedback.push(item);
    const cap = item.kind === 'label' ? 8 : 18;
    const matches = this.reactionFeedback.filter(entry => entry.kind === item.kind);
    if (matches.length > cap) {
      const oldest = matches[0];
      const index = this.reactionFeedback.indexOf(oldest);
      if (index >= 0) this.reactionFeedback.splice(index, 1);
    }
  }

  addReactionEffect(effect) {
    if (this.reducedFx) {
      effect.life *= .65;
      effect.maxLife *= .65;
    }
    this.reactionEffects.push(effect);
    const cap = this.reducedFx ? 12 : 32;
    if (this.reactionEffects.length > cap) this.reactionEffects.splice(0, this.reactionEffects.length - cap);
  }

  resolveMagicBatch(resolve) {
    this.deferLevelUp = true;
    try { resolve(); }
    finally { this.deferLevelUp = false; }
    if (this.levelUpPending) {
      this.levelUpPending = false;
      if (this.screen === 'playing') this.levelUp();
    }
  }

  updateMagicZones(dt) {
    for (let i = this.magicZones.length - 1; i >= 0; i--) {
      const zone = this.magicZones[i], spell = MAGIC_SPELLS[zone.spellId];
      zone.life -= dt; zone.tickTimer -= dt; zone.pulse += dt;
      if (zone.life <= 0) { this.magicZones.splice(i, 1); continue; }
      if (zone.tickTimer > 0) continue;
      zone.tickTimer += zone.tickInterval;
      this.resolveMagicBatch(() => {
        for (const enemy of [...this.enemies]) {
          if (distance(zone, enemy) > zone.radius + enemy.radius) continue;
          const rootDuration = enemy.boss ? BOSS_CONTROL_LIMITS.natureRootDuration : Math.min(.9, spell.rootDuration);
          enemy.rootTimer = Math.max(enemy.rootTimer, rootDuration);
          this.applyEnemyDamage(enemy, zone.damage, zone.color, false);
          if (this.enemies.includes(enemy)) this.applyElementalHit(enemy, 'nature', { triggered: new Set() });
          if (this.screen !== 'playing') break;
        }
      });
      if (this.screen !== 'playing') return;
    }
  }

  killEnemy(enemy) {
    const index = this.enemies.indexOf(enemy); if (index < 0) return;
    for (const element of ELEMENT_IDS) enemy.elementMarks[element] = 0;
    for (const reaction of REACTION_IDS) enemy.reactionCooldowns[reaction] = 0;
    enemy.slowTimer = 0; enemy.slowFactor = 1; enemy.rootTimer = 0;
    this.enemies.splice(index, 1); this.player.kills++;
    this.player.xp += enemy.xp;
    this.addEffect(enemy.x, enemy.y, enemy.boss ? '#e5a9f4' : enemy.color, this.reducedFx ? 8 : 19, enemy.boss ? 5 : 3);
    this.playSound('death');
    if (enemy.boss || this.boss === enemy) {
      this.boss = null; this.bossSpawned = true; this.projectiles = []; this.magicZones = []; this.magicArcs = []; this.magicBursts = []; this.reactionEffects = []; this.reactionFeedback = []; this.worldEvent = null; this.screen = 'victory';
      this.announce('暮鐘止息。試煉完成。');
      return;
    }
    if (this.player.xp >= this.player.nextXp) {
      if (this.deferLevelUp) this.levelUpPending = true;
      else this.levelUp();
    }
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.life -= dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.max(0, 1 - dt * 2); e.vy *= Math.max(0, 1 - dt * 2);
      if (e.life <= 0) this.effects.splice(i, 1);
    }
    for (let i = this.magicArcs.length - 1; i >= 0; i--) {
      this.magicArcs[i].life -= dt;
      if (this.magicArcs[i].life <= 0) this.magicArcs.splice(i, 1);
    }
    for (let i = this.magicBursts.length - 1; i >= 0; i--) {
      this.magicBursts[i].life -= dt;
      if (this.magicBursts[i].life <= 0) this.magicBursts.splice(i, 1);
    }
    for (let i = this.dashAfterimages.length - 1; i >= 0; i--) {
      const ghost = this.dashAfterimages[i]; ghost.life -= dt;
      ghost.opacity = .3 * Math.max(0, ghost.life / ghost.maxLife);
      if (ghost.life <= 0) this.dashAfterimages.splice(i, 1);
    }
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i].life -= dt;
      if (this.damageNumbers[i].life <= 0) this.damageNumbers.splice(i, 1);
    }
    for (let i = this.reactionEffects.length - 1; i >= 0; i--) {
      this.reactionEffects[i].life -= dt;
      if (this.reactionEffects[i].life <= 0) this.reactionEffects.splice(i, 1);
    }
    for (let i = this.reactionFeedback.length - 1; i >= 0; i--) {
      this.reactionFeedback[i].life -= dt;
      if (this.reactionFeedback[i].life <= 0) this.reactionFeedback.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 18); this.flashTimer = Math.max(0, this.flashTimer - dt);
  }

  addDamageNumber(x, y, amount, color) {
    this.damageNumbers.push({ x, y, amount, color, life: .58, maxLife: .58, critical: amount >= 35 });
    const limit = this.reducedFx ? 20 : 48;
    if (this.damageNumbers.length > limit) this.damageNumbers.splice(0, this.damageNumbers.length - limit);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const cinematic = !this.player;
    const camera = cinematic ? { x: 640, y: 500 } : this.camera;
    const sx = this.shake ? (Math.random() - .5) * this.shake : 0, sy = this.shake ? (Math.random() - .5) * this.shake : 0;
    ctx.save(); ctx.translate(-camera.x + sx, -camera.y + sy);
    drawWorld(ctx, camera, this.clock);
    if (this.worldEvent) drawWorldEvent(ctx, this.worldEvent, this.clock);
    this.magicZones.forEach(zone => drawMagicZone(ctx, zone, this.clock));
    if (this.boss) drawBossWarning(ctx, this.boss, this.clock);
    this.dashAfterimages.forEach(ghost => drawActor(ctx, ghost, this.clock));
    const actors = [...this.enemies]; if (this.player) actors.push(this.player);
    if (cinematic) actors.push({ ...createPlayer(), x: 1120, y: 974, type: 'player', hitFlash: 0 });
    actors.sort((a, b) => a.y - b.y).forEach(actor => drawActor(ctx, actor, this.clock));
    if (this.lockedTarget && this.lockedTargetTimer > 0) {
      const marker = this.lockedTarget.enemy || this.lockedTarget;
      if (!this.lockedTarget.enemy || this.enemies.includes(this.lockedTarget.enemy)) {
        drawTargetMarker(ctx, marker, this.clock, Math.min(.78, this.lockedTargetTimer * 1.35));
      }
    }
    this.projectiles.forEach(p => drawProjectile(ctx, p, this.clock));
    this.magicArcs.forEach(arc => drawMagicArc(ctx, arc, this.clock));
    this.magicBursts.forEach(burst => drawMagicBurst(ctx, burst));
    this.reactionEffects.forEach(effect => drawReactionEffect(ctx, effect, this.clock));
    this.effects.forEach(e => drawEffect(ctx, e));
    this.damageNumbers.forEach(item => drawDamageNumber(ctx, item));
    this.reactionFeedback.forEach(item => drawReactionFeedback(ctx, item));
    ctx.restore();
    const vignette = ctx.createRadialGradient(480, 300, 160, 480, 300, 620);
    vignette.addColorStop(.45, 'rgba(5, 9, 17, 0)'); vignette.addColorStop(1, 'rgba(5, 9, 17, .43)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.flashTimer > 0) { ctx.fillStyle = `rgba(230, 127, 152, ${this.flashTimer * 1.5})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    drawUI(ctx, this);
    if (this.toastTimer > 0 && (this.screen === 'playing' || this.screen === 'paused')) {
      const alpha = Math.min(1, this.toastTimer * 2); ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(9, 14, 23, .78)'; ctx.fillRect(346, 510, 268, 28);
      ctx.strokeStyle = 'rgba(170, 196, 220, .25)'; ctx.strokeRect(346.5, 510.5, 267, 27);
      ctx.font = '500 11px "Noto Sans TC", sans-serif'; ctx.fillStyle = '#d7e1eb'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.toast, 480, 524);
      ctx.globalAlpha = 1;
    }
  }
}
