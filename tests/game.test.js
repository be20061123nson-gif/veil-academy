import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { createPlayer, drawActor, enemyStats } from '../src/entities.js';
import { BASIC_ATTACK, ENEMY_LIMIT, PLAYER_MOVEMENT, UPGRADES, VIEW_H, VIEW_W } from '../src/constants.js';
import { MAGIC_SPELLS, normalizeLoadout, projectileLife } from '../src/magic.js';
import { createWorldEvent, resolveWorldEvent } from '../src/events.js';
import { mouseFollowMotion, rotateTowards } from '../src/movement.js';
import { findAimedEnemy, findDenseEnemyPoint, findNearestEnemy } from '../src/targeting.js';
import { applyElementMark, BOSS_CONTROL_LIMITS, createElementState, ELEMENT_MARK_DURATION, ELEMENT_REACTIONS, updateElementState } from '../src/reactions.js';
import { isBlocked, moveWithCollision } from '../src/world.js';
import { AudioBus } from '../src/audio.js';
import { readSetting, writeSetting } from '../src/storage.js';

globalThis.localStorage = { getItem: () => null, setItem: () => {} };

test('browser settings persist when available and safely fall back when storage is blocked', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    const values = new Map();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    } });
    assert.equal(writeSetting('veil-difficulty', 'nightmare'), true);
    assert.equal(readSetting('veil-difficulty'), 'nightmare');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    assert.equal(readSetting('veil-difficulty'), null);
    assert.equal(writeSetting('veil-difficulty', 'normal'), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('spell tuning keeps distinct roles, affordable cadence, and bounded control', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(MAGIC_SPELLS).map(([id, spell]) => [id, [spell.damage, spell.manaCost, spell.cooldown]])), {
    fire: [31, 14, .9], ice: [17, 8, .52], lightning: [18, 12, .78], nature: [8, 20, 1],
  });
  assert.equal(MAGIC_SPELLS.fire.explosionRadius, 92);
  assert.equal(MAGIC_SPELLS.fire.splashRatio, .66);
  assert.equal(MAGIC_SPELLS.ice.slowFactor, .62);
  assert.equal(MAGIC_SPELLS.ice.slowDuration, 1.25);
  assert.equal(MAGIC_SPELLS.lightning.chainCount, 5);
  assert.equal(MAGIC_SPELLS.lightning.chainRange, 190);
  assert.equal(MAGIC_SPELLS.nature.zoneRadius, 112);
  assert.equal(MAGIC_SPELLS.nature.zoneDuration, 3);
  assert.equal(MAGIC_SPELLS.nature.rootDuration, .38);
  assert.ok(Object.values(MAGIC_SPELLS).every(spell => spell.cooldown <= 1));
  assert.ok(Object.values(MAGIC_SPELLS).filter(spell => spell.castMode === 'projectile').every(spell => projectileLife(spell) > 0));
  assert.equal(createPlayer().manaRegen, 10);
});

test('element mark helpers expire marks and trigger each configured pair once per cooldown', () => {
  const enemy = createElementState();
  assert.equal(applyElementMark(enemy, 'fire'), null);
  assert.equal(applyElementMark(enemy, 'ice'), 'steamBurst');
  assert.equal(enemy.elementMarks.fire, 0, 'a reaction consumes both paired marks');
  assert.equal(enemy.elementMarks.ice, 0);
  assert.equal(applyElementMark(enemy, 'fire'), null, 'a reaction cannot retrigger while the pair is incomplete');
  assert.equal(applyElementMark(enemy, 'ice'), null, 'the reaction cooldown prevents immediate retrigger');
  updateElementState(enemy, ELEMENT_REACTIONS.steamBurst.cooldown);
  assert.equal(applyElementMark(enemy, 'fire'), 'steamBurst', 'a fresh hit may resolve a still-valid pair after cooldown');

  applyElementMark(enemy, 'nature', .3);
  updateElementState(enemy, .31);
  assert.equal(enemy.elementMarks.nature, 0, 'element marks expire over time');
  assert.equal(ELEMENT_MARK_DURATION.fire, 4.5);
});

test('lightning vines and frozen thorns require nature and the correct triggering element', () => {
  const enemy = createElementState();
  applyElementMark(enemy, 'nature');
  assert.equal(applyElementMark(enemy, 'ice'), 'frozenThorns');
  assert.equal(enemy.elementMarks.nature, 0);

  const rooted = createElementState();
  applyElementMark(rooted, 'nature');
  assert.equal(applyElementMark(rooted, 'lightning'), 'lightningVines');
  assert.equal(rooted.elementMarks.nature, 0);
  assert.equal(ELEMENT_REACTIONS.lightningVines.maxTargets, 3);
});

test('steam burst spends paired marks, adds bounded area damage, and emits its own effect', () => {
  const game = makeGame(); game.start();
  const target = enemyStats('stalker', game.player.x + 180, game.player.y); target.hp = 200;
  const bystander = enemyStats('wisp', target.x + 42, target.y); bystander.hp = 200;
  const distant = enemyStats('wisp', target.x + 100, target.y); distant.hp = 200;
  game.enemies.push(target, bystander, distant);
  applyElementMark(target, 'ice');
  const targetBefore = target.hp, bystanderBefore = bystander.hp, distantBefore = distant.hp;
  game.applyMagicImpact({ magicId: 'fire', damage: MAGIC_SPELLS.fire.damage, explosionRadius: MAGIC_SPELLS.fire.explosionRadius, splashRatio: MAGIC_SPELLS.fire.splashRatio, x: target.x, y: target.y }, target);
  assert.equal(target.hp, targetBefore - MAGIC_SPELLS.fire.damage * (1 + MAGIC_SPELLS.fire.splashRatio) - ELEMENT_REACTIONS.steamBurst.damage);
  assert.equal(bystander.hp, bystanderBefore - MAGIC_SPELLS.fire.damage * MAGIC_SPELLS.fire.splashRatio - ELEMENT_REACTIONS.steamBurst.splashDamage);
  assert.equal(distant.hp, distantBefore - MAGIC_SPELLS.fire.damage * MAGIC_SPELLS.fire.splashRatio, 'only the fire splash should reach targets outside the steam radius');
  assert.equal(target.elementMarks.fire, 0);
  assert.equal(target.elementMarks.ice, 0);
  assert.ok(game.reactionEffects.some(effect => effect.id === 'steamBurst'));
  assert.ok(game.reactionFeedback.some(item => item.kind === 'label' && item.text === '蒸氣爆發'));
  assert.ok(game.reactionFeedback.some(item => item.kind === 'damage' && item.amount === ELEMENT_REACTIONS.steamBurst.damage));
});

test('lightning vines propagates to a bounded number of unique enemies without recursive reactions', () => {
  const game = makeGame(); game.start();
  const source = enemyStats('stalker', game.player.x + 150, game.player.y);
  const targets = [50, 100, 150, 200].map(offset => enemyStats('wisp', source.x + offset, source.y));
  [source, ...targets].forEach(enemy => { enemy.hp = 200; game.enemies.push(enemy); });
  applyElementMark(source, 'nature'); source.rootTimer = .5;
  game.applyElementalHit(source, 'lightning', { triggered: new Set() });
  assert.equal(source.elementMarks.nature, 0);
  assert.ok(targets.slice(0, 3).every(enemy => enemy.hp < 200), 'the reaction should conduct along its bounded route');
  assert.equal(targets[3].hp, 200, 'no more than the configured three extra targets should be hit');
  assert.equal(game.reactionEffects.filter(effect => effect.id === 'lightningVines').length, 3);
  assert.equal(source.elementMarks.lightning, 0, 'reaction resolution consumes both paired marks');
  assert.ok(source.reactionCooldowns.lightningVines > 0);
});

test('frozen thorns controls ordinary enemies briefly and uses a short non-root boss slow', () => {
  const game = makeGame(); game.start();
  const ordinary = enemyStats('brute', game.player.x + 100, game.player.y);
  const boss = enemyStats('boss', game.player.x + 180, game.player.y);
  ordinary.hp = boss.hp = 300; game.enemies.push(ordinary, boss);
  applyElementMark(ordinary, 'nature'); applyElementMark(boss, 'nature');
  game.applyElementalHit(ordinary, 'ice', { triggered: new Set() });
  game.applyElementalHit(boss, 'ice', { triggered: new Set() });
  assert.ok(ordinary.rootTimer > 0 && ordinary.rootTimer <= ELEMENT_REACTIONS.frozenThorns.rootDuration);
  assert.equal(boss.rootTimer, 0, 'the reaction must not root a boss');
  assert.equal(boss.slowTimer, BOSS_CONTROL_LIMITS.frozenThornsSlowDuration);
  assert.equal(boss.slowFactor, BOSS_CONTROL_LIMITS.frozenThornsSlowFactor);
  assert.ok(game.reactionEffects.some(effect => effect.id === 'frozenThorns'));
});

test('boss control stays capped and reaction chains do not disable its attack pattern', () => {
  const game = makeGame(); game.start();
  const boss = enemyStats('boss', game.player.x + 300, game.player.y); boss.hp = 1000;
  const neighbor = enemyStats('stalker', boss.x + 40, boss.y); neighbor.hp = 1000;
  game.boss = boss; game.bossSpawned = true; game.enemies.push(boss, neighbor);
  applyElementMark(boss, 'nature'); boss.rootTimer = 0;
  game.applyElementalHit(boss, 'lightning', { triggered: new Set() });
  boss.attackTimer = 0;
  game.updateEnemies(.016);
  assert.ok(boss.attackWarning > 0, 'the boss telegraphs its aimed volley before firing');
  assert.equal(game.projectiles.length, 0, 'projectiles are delayed until the visible warning finishes');
  game.updateEnemies(.6);
  assert.ok(game.projectiles.length >= 2, 'the boss fires after its warning even while elemental control is active');

  game.loadout = ['fire', 'ice'];
  const ice = { x: boss.x + 30, y: boss.y, damage: 16, magicId: 'ice' };
  applyElementMark(boss, 'nature');
  boss.slowTimer = 0; boss.rootTimer = 0;
  game.applyMagicImpact(ice, boss);
  assert.equal(boss.rootTimer, 0, 'ice reactions must never root a boss');
  assert.equal(boss.slowTimer, BOSS_CONTROL_LIMITS.iceSlowDuration, 'the reaction must not extend the underlying ice slow');

  game.magicZones = [{ x: boss.x, y: boss.y, spellId: 'nature', color: '#8ed69a', damage: 0, radius: 40, life: 1, maxLife: 1, tickInterval: .55, tickTimer: 0, rootDuration: .72, pulse: 0 }];
  boss.rootTimer = 0; boss.slowTimer = 0;
  game.updateMagicZones(.016);
  assert.ok(boss.rootTimer <= BOSS_CONTROL_LIMITS.natureRootDuration, 'nature field roots must be short on the boss');

  boss.hp = boss.maxHp * .51;
  boss.rootTimer = 0;
  game.applyEnemyDamage(boss, boss.maxHp * .03, '#fff', false);
  assert.equal(boss.phaseTwo, true, 'crossing half health changes the boss attack phase');
  assert.equal(boss.rootTimer, 0);
  game.updateEnemies(.7);
  assert.ok(boss.attackWarning > 0, 'phase two still shows a warning before its wider volley');
  const beforePhaseVolley = game.projectiles.length;
  game.updateEnemies(.4);
  assert.equal(game.projectiles.length - beforePhaseVolley, 3, 'phase two uses a readable three-bolt spread');
});

test('reaction feedback and status state stay bounded, expire, clear on death, and reset between runs', () => {
  const game = makeGame(); game.start();
  const enemy = enemyStats('stalker', game.player.x + 100, game.player.y);
  game.enemies.push(enemy);
  applyElementMark(enemy, 'nature', .1);
  enemy.elementMarks.fire = enemy.elementMarks.ice = enemy.elementMarks.lightning = .2;
  enemy.rootTimer = .4;
  game.addReactionEffect({ id: 'steamBurst', x: enemy.x, y: enemy.y, radius: 30, life: .1, maxLife: .1 });
  for (let i = 0; i < 30; i++) game.addReactionFeedback({ kind: 'damage', reactionId: 'steamBurst', amount: 5, x: enemy.x + i, y: enemy.y, life: .6, maxLife: .6 });
  for (let i = 0; i < 12; i++) game.addReactionFeedback({ kind: 'label', text: '蒸氣爆發', color: '#fff', x: enemy.x + i, y: enemy.y, life: .6, maxLife: .6 });
  assert.ok(game.reactionFeedback.filter(item => item.kind === 'damage').length <= 18);
  assert.ok(game.reactionFeedback.filter(item => item.kind === 'label').length <= 8);
  game.render();
  game.updateEnemies(.11);
  game.updateEffects(.11);
  assert.equal(enemy.elementMarks.nature, 0);
  assert.equal(game.reactionEffects.length, 0);

  enemy.hp = 0; game.killEnemy(enemy);
  assert.equal(enemy.rootTimer, 0);
  assert.equal(enemy.elementMarks.nature, 0);
  assert.equal(enemy.reactionCooldowns.steamBurst, 0);
  for (let run = 0; run < 3; run++) {
    game.start();
    assert.equal(game.enemies.length, 0);
    assert.equal(game.reactionEffects.length, 0);
    assert.equal(game.reactionFeedback.length, 0);
    assert.equal(game.projectiles.length, 0);
    const nextEnemy = enemyStats('wisp', game.player.x + 180, game.player.y);
    game.enemies.push(nextEnemy); game.spawnTimer = 10;
    assert.deepEqual(nextEnemy.elementMarks, { fire: 0, ice: 0, lightning: 0, nature: 0 });
    assert.deepEqual(nextEnemy.reactionCooldowns, { steamBurst: 0, lightningVines: 0, frozenThorns: 0 });
  }
});

test('killed marked enemies clear their status and new spawns begin with clean reaction state', () => {
  const game = makeGame(); game.start();
  const enemy = enemyStats('stalker', game.player.x + 160, game.player.y);
  game.enemies.push(enemy);
  applyElementMark(enemy, 'nature'); applyElementMark(enemy, 'fire');
  enemy.rootTimer = .4;
  assert.ok(enemy.elementMarks.nature > 0 && enemy.elementMarks.fire > 0);
  game.killEnemy(enemy);
  assert.equal(enemy.elementMarks.nature, 0);
  assert.equal(enemy.elementMarks.fire, 0);
  assert.equal(enemy.rootTimer, 0);

  game.spawnTimer = 0;
  game.update(.016);
  assert.equal(game.enemies.length, 1, 'the next spawn should still occur normally after a reaction-marked death');
  assert.deepEqual(game.enemies[0].elementMarks, { fire: 0, ice: 0, lightning: 0, nature: 0 });
  assert.deepEqual(game.enemies[0].reactionCooldowns, { steamBurst: 0, lightningVines: 0, frozenThorns: 0 });
});

test('maximum enemy count keeps reaction searches and visual pools bounded', () => {
  const game = makeGame(); game.start();
  const enemies = Array.from({ length: 31 }, (_, index) => {
    const enemy = enemyStats('stalker', game.player.x + 120 + index * 18, game.player.y);
    enemy.hp = 10000;
    applyElementMark(enemy, 'nature');
    game.enemies.push(enemy);
    return enemy;
  });
  for (const enemy of enemies) game.applyElementalHit(enemy, 'lightning', { triggered: new Set() });
  assert.ok(game.reactionEffects.length <= 32);
  assert.ok(game.reactionFeedback.filter(item => item.kind === 'damage').length <= 18);
  assert.ok(game.reactionFeedback.filter(item => item.kind === 'label').length <= 8);
  assert.ok(enemies.every(enemy => enemy.hp > 0), 'stress case should exercise active enemies without ending the trial');
});

test('pixel actor rendering supports student, distinct enemy silhouettes, and boss without canvas errors', () => {
  const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { target[key] = value; return true; },
  });
  const actors = [
    { ...makeGame().player, type: 'player', x: 40, y: 50, facing: Math.PI / 4, moving: true },
    enemyStats('wisp', 80, 50), enemyStats('stalker', 120, 50), enemyStats('brute', 160, 50), enemyStats('boss', 210, 50),
  ];
  actors.forEach(actor => drawActor(ctx, actor, 1.25));
  assert.equal(actors.length, 5);
});

test('dash afterimages and general particles stay capped, expire, and clear on restart', () => {
  const game = makeGame(); game.start();
  game.player.dashTimer = .16; game.player.dashVector = { x: 1, y: 0 };
  for (let i = 0; i < 30; i++) game.updatePlayerMovement(.034);
  assert.ok(game.dashAfterimages.length <= 6);
  game.updateEffects(.3);
  assert.equal(game.dashAfterimages.length, 0);
  for (let i = 0; i < 20; i++) game.addEffect(50, 50, '#fff', 12, 3);
  assert.ok(game.effects.length <= 180);
  game.start();
  assert.equal(game.dashAfterimages.length, 0, 'restart clears all visual objects from the prior trial');
  assert.equal(game.effects.length, 0);
});

test('level choices follow the equipped elements and mastery upgrades tune only their spell behavior', () => {
  const game = makeGame(); game.start(); game.loadout = ['fire', 'nature'];
  game.player.xp = game.player.nextXp; game.levelUp();
  assert.equal(game.choices.length, 3);
  assert.ok(game.choices.every(choice => !choice.spellId || game.loadout.includes(choice.spellId)));

  const fire = UPGRADES.find(upgrade => upgrade.id === 'fireReach');
  const ice = UPGRADES.find(upgrade => upgrade.id === 'iceHold');
  const lightning = UPGRADES.find(upgrade => upgrade.id === 'lightningFork');
  const nature = UPGRADES.find(upgrade => upgrade.id === 'natureBloom');
  const player = game.player;
  fire.apply(player); ice.apply(player); lightning.apply(player); nature.apply(player);
  fire.apply(player); ice.apply(player); lightning.apply(player); nature.apply(player);
  assert.equal(player.fireRadiusBonus, .4);
  assert.equal(player.iceDurationBonus, .5);
  assert.equal(player.lightningChainBonus, 2);
  assert.equal(player.natureRadiusBonus, .3);
  assert.equal(fire.isAvailable(player), true);
  lightning.apply(player); lightning.apply(player);
  assert.equal(player.lightningChainBonus, 2, 'specialized upgrades respect their stack ceiling');
});

test('procedural audio is lazy, capped, optional, and safely disabled without Web Audio', () => {
  const original = globalThis.AudioContext;
  class FakeParam {
    setValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.oscillators = []; }
    createOscillator() {
      const oscillator = { frequency: new FakeParam(), connect() {}, disconnect() {}, start() {}, stop() {}, type: '', onended: null };
      this.oscillators.push(oscillator); return oscillator;
    }
    createGain() { return { gain: new FakeParam(), connect() {}, disconnect() {} }; }
    resume() { return Promise.resolve(); }
  }
  try {
    globalThis.AudioContext = FakeAudioContext;
    const bus = new AudioBus(globalThis.localStorage);
    assert.equal(bus.play('fire'), false, 'sound does not create a context before a user gesture');
    assert.equal(bus.unlock(), true);
    for (let i = 0; i < 8; i++) assert.equal(bus.play('hit'), true);
    assert.equal(bus.play('hit'), false, 'simultaneous oscillator count is capped');
    bus.context.oscillators[0].onended();
    assert.equal(bus.play('steamBurst'), true);
    bus.toggle();
    assert.equal(bus.play('fire'), false, 'the sound toggle mutes all cues');
  } finally {
    if (original === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = original;
  }
  const unsupported = new AudioBus(null);
  assert.equal(unsupported.play('hit'), false, 'missing audio context is a safe no-op');
});

function makeGame() {
  const ctx = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { target[key] = value; return true; },
  });
  const canvas = { width: 960, height: 600, getContext: () => ctx };
  const game = new Game(canvas, { textContent: '' });
  return game;
}

function aimAt(game, worldX, worldY) {
  game.cameraToPlayer();
  game.setMouse(worldX - game.camera.x, worldY - game.camera.y);
}

function step(game, count = 12, dt = .034) {
  for (let i = 0; i < count; i++) game.update(dt);
}

test('movement respects walls and dungeon obstacles', () => {
  const actor = { x: 895, y: 620, radius: 13 };
  moveWithCollision(actor, 40, 0);
  assert.equal(actor.x, 895);
  assert.equal(isBlocked(1120, 600, 12), true);
  const boundary = { x: 50, y: 200, radius: 13 };
  moveWithCollision(boundary, -80, 0);
  assert.equal(boundary.x, 50, 'the world edge should block outward movement');
});

test('keyboard movement is normalized, mouse only aims, and camera conversion and blur work', () => {
  const game = makeGame(); game.start();
  const p = game.player; p.x = 1500; p.y = 970; game.cameraToPlayer();
  const start = { x: p.x, y: p.y };
  game.setMouse(720, 250); game.update(.1);
  assert.deepEqual({ x: p.x, y: p.y }, start, 'the cursor only changes aim, it never moves the player');
  const mouseWorld = game.getMouseWorld();
  assert.equal(mouseWorld.x, game.camera.x + 720);
  assert.equal(mouseWorld.y, game.camera.y + 250);
  game.keyDown('d'); game.update(.1); game.keyUp('d');
  assert.ok(Math.abs(p.x - (start.x + 19)) < 1);
  assert.ok(Math.abs(p.y - start.y) < 1);
  p.x = start.x; p.y = start.y; game.cameraToPlayer();
  game.keyDown('d'); game.keyDown('w'); game.update(.1); game.keyUp('d'); game.keyUp('w');
  const diagonal = 190 * .1 / Math.sqrt(2);
  assert.ok(Math.abs(p.x - (start.x + diagonal)) < 1);
  assert.ok(Math.abs(p.y - (start.y - diagonal)) < 1);
  game.keyDown('d'); game.setInputFocused(false);
  const blurred = { x: p.x, y: p.y }; game.update(.2);
  assert.deepEqual({ x: p.x, y: p.y }, blurred, 'blur clears held movement keys');
  game.setInputFocused(true);
  assert.ok(Math.abs(rotateTowards(0, Math.PI / 2, .2) - .2) < 1e-9);
});

test('WASD respects obstacle collisions and aim direction tracks world coordinates', () => {
  const game = makeGame(); game.start();
  const p = game.player;
  p.x = 890; p.y = 620; game.cameraToPlayer();
  game.keyDown('d');
  game.update(.2);
  game.keyUp('d');
  assert.ok(p.x <= 897, 'the movement path should stop at the academy obstacle collision edge');
  assert.equal(isBlocked(1120, 600, 12), true);
});

test('aim targeting only selects valid enemies in the forward corridor', () => {
  const origin = { x: 10, y: 20 };
  const ahead = enemyStats('stalker', 130, 24);
  const offAxis = enemyStats('stalker', 120, 100);
  const behind = enemyStats('stalker', -50, 20);
  assert.equal(findAimedEnemy(origin, [offAxis, behind, ahead], 300, 0), ahead);
  ahead.hp = 0;
  assert.equal(findAimedEnemy(origin, [ahead, offAxis, behind], 300, 0), null);
});

test('elite enemies spawn in safe spaces, telegraph a bounded dash, and damage numbers stay capped', () => {
  const game = makeGame(); game.start();
  game.elapsed = 50;
  const elite = game.spawnEnemy('stalker', true);
  assert.ok(elite?.elite);
  assert.equal(isBlocked(elite.x, elite.y, elite.radius), false);
  assert.ok(Math.hypot(elite.x - game.player.x, elite.y - game.player.y) >= 400);
  const healthBefore = elite.hp;
  elite.eliteCooldown = 0;
  game.updateEnemies(.034);
  assert.ok(elite.eliteWindup > 0, 'the elite warns before its charge');
  for (let i = 0; i < 15; i++) game.updateEnemies(.034);
  assert.ok(elite.eliteDash > 0 || elite.eliteCooldown < 3.8, 'the warned elite executes a short dash');
  for (let i = 0; i < 80; i++) game.applyEnemyDamage(elite, .1, '#fff', false);
  assert.ok(game.damageNumbers.length <= 48);
  assert.ok(elite.hp < healthBefore);
  game.updateEffects(.7);
  assert.equal(game.damageNumbers.length, 0, 'short-lived damage feedback is reclaimed');
});

test('garden spring restores bounded health and mana and grants experience', () => {
  const game = makeGame(); game.start();
  game.player.hp = 30; game.player.mana = 5;
  game.worldEvent = createWorldEvent('spring', game.player.x, game.player.y);
  assert.equal(game.keyDown('f'), true);
  assert.equal(game.player.hp, 54);
  assert.equal(game.player.mana, 35);
  assert.equal(game.player.xp, 12);
  assert.equal(game.worldEvent, null);
  const full = makeGame(); full.start(); full.player.hp = full.player.maxHp; full.player.mana = full.player.maxMana;
  const outcome = resolveWorldEvent('spring', full.player);
  assert.equal(outcome.hp, 0); assert.equal(outcome.mana, 0);
});

test('rift event grants a short damage buff and bounded enemy wave, then restart clears event state', () => {
  const game = makeGame(); game.start();
  const origin = { x: game.player.x + 180, y: game.player.y };
  game.worldEvent = createWorldEvent('rift', origin.x, origin.y);
  game.player.x = origin.x; game.player.y = origin.y;
  const baseDamage = game.player.damage;
  game.interactWorldEvent();
  assert.equal(game.player.damage, baseDamage * 1.2);
  assert.equal(game.eventDamageTimer, 10);
  assert.equal(game.enemies.length, 3);
  assert.equal(game.enemies.filter(enemy => enemy.elite).length, 1);
  assert.equal(game.worldEvent, null);
  game.start();
  assert.equal(game.eventDamageTimer, 0); assert.equal(game.worldEvent, null); assert.equal(game.enemies.length, 0);
});

test('world events appear only while playing, expire after their lifetime, and pause with the run', () => {
  const game = makeGame(); game.start(); game.worldEventTimer = 0;
  game.update(.034);
  assert.ok(game.worldEvent, 'a safe event location is created when the timer reaches zero');
  const event = game.worldEvent; game.screen = 'paused'; const remaining = event.remaining;
  game.update(1); assert.equal(event.remaining, remaining);
  game.screen = 'playing'; event.remaining = .01; game.update(.034);
  assert.equal(game.worldEvent, null);
});

test('mouse buttons cast independently without moving the player', () => {
  const game = makeGame(); game.start();
  const p = game.player, origin = { x: p.x, y: p.y };
  const enemy = enemyStats('stalker', p.x + 180, p.y); enemy.hp = 500; game.enemies.push(enemy);
  aimAt(game, enemy.x, enemy.y);
  game.pointerDown(game.mouse.x, game.mouse.y, 0);
  assert.ok(game.spellCooldowns[0] > 0 && game.spellCooldowns[1] === 0);
  game.update(.05);
  assert.deepEqual({ x: p.x, y: p.y }, origin, 'mouse aiming and casting do not move the player');
  game.pointerDown(game.mouse.x, game.mouse.y, 2);
  assert.ok(game.spellCooldowns[1] > 0, 'right mouse casts the independent second slot');
  assert.ok(game.spellCooldowns[0] > 0, 'casting one slot does not reset the other');
});

test('menu, movement, dodge, spell, level choice, boss and result all run', () => {
  const game = makeGame();
  game.render();
  assert.ok(game.buttons.some(button => button.id === 'start'));
  game.pointerDown(414, 366);
  assert.equal(game.screen, 'playing');

  const startX = game.player.x;
  game.setMouse(VIEW_W / 2 + 90, 300); game.update(.1);
  assert.equal(game.player.x, startX, 'mouse movement aims without moving the player');
  game.keyDown('d'); game.update(.1); game.keyUp('d');
  assert.ok(game.player.x > startX, 'D moves the player to the right');
  const afterMove = game.player.x;
  game.update(.1);
  assert.equal(game.player.x, afterMove, 'releasing movement keys stops normal movement');
  game.keyDown(' ');
  assert.ok(game.player.dashCooldown > 2);
  game.update(.08);
  assert.ok(game.player.x > afterMove, 'Space should dash toward the current aim direction');

  const enemy = enemyStats('stalker', game.player.x + 90, game.player.y);
  enemy.hp = BASIC_ATTACK.damage; game.enemies.push(enemy); game.spawnTimer = 10;
  const manaBeforeBasic = game.player.mana;
  for (let i = 0; i < 12; i++) game.update(.034);
  assert.equal(game.player.kills, 1);
  assert.ok(Math.abs(game.player.mana - Math.min(game.player.maxMana, manaBeforeBasic + game.player.manaRegen * .034 * 12)) < 1e-9);

  const reward = enemyStats('wisp', 100, 100); reward.xp = game.player.nextXp;
  game.enemies.push(reward); game.killEnemy(reward);
  assert.equal(game.screen, 'levelup');
  game.render();
  assert.ok(game.buttons.filter(button => button.id === 'upgrade').length === 3);
  game.chooseUpgrade(0);
  assert.equal(game.player.level, 2);
  assert.equal(game.screen, 'playing');

  game.elapsed = 76; game.spawnTimer = 10; game.update(.02);
  assert.ok(game.boss);
  assert.equal(isBlocked(game.boss.x, game.boss.y, game.boss.radius), false);
  game.render();

  game.player.hp = 0; game.update(.02);
  assert.equal(game.screen, 'gameover');
  game.render();
});

test('defeating the stage boss freezes the trial and exposes both result actions', () => {
  const game = makeGame();
  game.start(); game.elapsed = 81;
  const boss = enemyStats('boss', game.player.x + 300, game.player.y);
  const remainingEnemy = enemyStats('stalker', game.player.x + 200, game.player.y);
  game.boss = boss; game.bossSpawned = true;
  game.enemies = [boss, remainingEnemy]; game.projectiles.push({ owner: 'enemy' });

  game.killEnemy(boss);
  assert.equal(game.screen, 'victory');
  assert.equal(game.boss, null);
  assert.equal(game.player.kills, 1);
  assert.equal(game.projectiles.length, 0);
  game.killEnemy(boss);
  assert.equal(game.player.kills, 1, 'a defeated boss must only be counted once');

  const frozenTime = game.elapsed;
  const frozenPlayerPosition = { x: game.player.x, y: game.player.y };
  const frozenPosition = { x: remainingEnemy.x, y: remainingEnemy.y };
  const frozenEnemyCount = game.enemies.length;
  game.keys.add('d'); game.spawnTimer = 0; game.update(1);
  assert.equal(game.elapsed, frozenTime);
  assert.deepEqual({ x: game.player.x, y: game.player.y }, frozenPlayerPosition);
  assert.deepEqual({ x: remainingEnemy.x, y: remainingEnemy.y }, frozenPosition);
  assert.equal(game.enemies.length, frozenEnemyCount);

  game.render();
  assert.ok(game.buttons.some(button => button.id === 'restart'));
  assert.ok(game.buttons.some(button => button.id === 'menu'));
});

test('victory result can restart a fresh run or return cleanly to the menu', () => {
  const game = makeGame();
  game.start();
  const boss = enemyStats('boss', game.player.x + 300, game.player.y);
  game.boss = boss; game.bossSpawned = true; game.enemies = [boss];
  game.killEnemy(boss);
  game.difficulty = 'nightmare'; game.reducedFx = true;
  game.render();
  const restartButton = game.buttons.find(button => button.id === 'restart');
  assert.ok(restartButton);
  game.pointerDown(restartButton.x + restartButton.w / 2, restartButton.y + restartButton.h / 2);
  assert.equal(game.screen, 'playing');
  assert.equal(game.elapsed, 0);
  assert.equal(game.player.level, 1);
  assert.equal(game.player.kills, 0);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.difficulty, 'nightmare');
  assert.equal(game.reducedFx, true);

  const nextBoss = enemyStats('boss', game.player.x + 300, game.player.y);
  game.boss = nextBoss; game.bossSpawned = true; game.enemies = [nextBoss];
  game.killEnemy(nextBoss);
  game.enemies.push(enemyStats('wisp', 200, 200));
  game.keys.add('d');
  game.render();
  const menuButton = game.buttons.find(button => button.id === 'menu');
  assert.ok(menuButton);
  game.pointerDown(menuButton.x + menuButton.w / 2, menuButton.y + menuButton.h / 2);
  assert.equal(game.screen, 'menu');
  assert.equal(game.player, null);
  assert.equal(game.boss, null);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.effects.length, 0);
  assert.equal(game.keys.size, 0);
});

test('magic configuration swaps unique spells between the left and right skill slots', () => {
  const game = makeGame();
  game.render();
  const configure = game.buttons.find(button => button.id === 'loadout');
  assert.ok(configure);
  game.pointerDown(configure.x + configure.w / 2, configure.y + configure.h / 2);
  assert.equal(game.screen, 'loadout');
  game.render();
  const secondary = game.buttons.find(button => button.id === 'loadout-slot' && button.index === 1);
  game.pointerDown(secondary.x + secondary.w / 2, secondary.y + secondary.h / 2);
  game.render();
  const fireCard = game.buttons.find(button => button.id === 'loadout-spell' && button.spellId === 'fire');
  game.pointerDown(fireCard.x + fireCard.w / 2, fireCard.y + fireCard.h / 2);
  assert.deepEqual(game.loadout, ['ice', 'fire']);
  assert.equal(new Set(game.loadout).size, 2);
  game.render();
  const natureCard = game.buttons.find(button => button.id === 'loadout-spell' && button.spellId === 'nature');
  game.pointerDown(natureCard.x + natureCard.w / 2, natureCard.y + natureCard.h / 2);
  assert.deepEqual(game.loadout, ['ice', 'nature']);
  assert.ok(game.buttons.some(button => button.id === 'back'));
});

test('legacy four-spell configuration migrates its former Q and E selections', () => {
  assert.deepEqual(normalizeLoadout(['fire', 'ice', 'lightning', 'nature']), ['lightning', 'nature']);
  assert.deepEqual(normalizeLoadout(['fire', 'fire']), ['fire', 'ice']);
});

test('basic attack selects the nearest enemy, switches targets, costs no mana, and stops when none remain', () => {
  const game = makeGame(); game.start();
  const p = game.player; p.mana = 37;
  const far = enemyStats('stalker', p.x + 210, p.y);
  const near = enemyStats('wisp', p.x + 115, p.y + 10);
  game.enemies.push(far, near); game.spawnTimer = 10;
  game.update(.016);
  assert.equal(game.basicAttackTarget, near);
  assert.equal(game.projectiles.at(-1).magicId, 'basic');
  const manaAfterShot = p.mana;
  game.killEnemy(near);
  game.basicAttackTimer = 0;
  game.update(.016);
  assert.equal(game.basicAttackTarget, far, 'a defeated target should be replaced by the next nearest enemy');
  assert.equal(game.projectiles.at(-1).magicId, 'basic');
  assert.ok(p.mana >= manaAfterShot, 'basic attacks should not spend mana');

  game.killEnemy(far);
  const projectileCount = game.projectiles.length, effectCount = game.effects.length;
  game.basicAttackTimer = 0;
  game.update(.016);
  assert.equal(game.basicAttackTarget, null);
  assert.equal(game.projectiles.length, projectileCount, 'there should be no empty basic attack projectile');
  assert.equal(game.effects.length, effectCount, 'there should be no empty basic attack muzzle effect');
});

test('WASD movement coexists with automatic attack, left/right skills, and Space dodge', () => {
  const game = makeGame(); game.start();
  const enemy = enemyStats('stalker', game.player.x + 130, game.player.y);
  game.enemies.push(enemy); game.spawnTimer = 10;
  aimAt(game, enemy.x, enemy.y);
  game.pointerDown(game.mouse.x, game.mouse.y, 0);
  game.pointerDown(game.mouse.x, game.mouse.y, 2);
  assert.ok(game.spellCooldowns[0] > 0 && game.spellCooldowns[1] > 0, 'left and right clicks cast their own slots');
  const position = { x: game.player.x, y: game.player.y };
  game.keyDown('d'); game.keyUp('d');
  game.update(.016);
  assert.deepEqual({ x: game.player.x, y: game.player.y }, position);
  assert.equal(game.basicAttackTarget, enemy, 'automatic target selection should remain active after release');
  assert.ok(game.projectiles.some(projectile => projectile.magicId === 'basic'));
  assert.equal(game.projectiles.filter(projectile => projectile.magicId !== 'basic').length, 2);
  game.keyDown(' ');
  assert.ok(game.player.dashCooldown > 2, 'Space should still activate the dodge');
});

test('aimed slots select enemies along the cursor ray and can cast into open space', () => {
  const game = makeGame(); game.start();
  const nearest = enemyStats('stalker', game.player.x + 130, game.player.y + 5);
  const other = enemyStats('stalker', game.player.x - 220, game.player.y);
  game.enemies.push(nearest, other);
  aimAt(game, nearest.x, nearest.y);
  const aimWorld = game.getMouseWorld();
  const before = game.player.mana;
  game.pointerDown(game.mouse.x, game.mouse.y, 0);
  assert.equal(game.player.castTimer, .2, 'successful casting immediately triggers the staff animation');
  assert.equal(game.lockedTarget.enemy, nearest, 'first slot locks the enemy under the aim ray');
  assert.ok(game.projectiles.at(-1).vx > 0, 'the projectile should point toward the selected target');
  assert.ok(game.spellCooldowns[0] > 0);
  assert.equal(game.player.mana, before - MAGIC_SPELLS.fire.manaCost);
  const secondBefore = game.player.mana;
  game.setMouse(VIEW_W - 15, 45);
  game.pointerDown(game.mouse.x, game.mouse.y, 2);
  assert.ok(game.spellCooldowns[1] > 0, 'second slot can be fired independently toward the cursor');
  assert.ok(game.player.mana < secondBefore);
  assert.ok(Number.isFinite(aimWorld.x));
});

test('nature field is placed at the clamped aim point and remains area based', () => {
  const game = makeGame(); game.start(); game.loadout = ['fire', 'nature'];
  const clusteredA = enemyStats('stalker', game.player.x + 245, game.player.y + 15);
  const clusteredB = enemyStats('stalker', game.player.x + 265, game.player.y + 30);
  game.enemies.push(clusteredA, clusteredB);
  aimAt(game, clusteredA.x, clusteredA.y);
  const target = game.getMouseWorld();
  game.pointerDown(game.mouse.x, game.mouse.y, 2);
  assert.ok(Math.abs(game.magicZones[0].x - target.x) < 1);
  assert.ok(Math.abs(game.magicZones[0].y - target.y) < 1);
  assert.equal(game.magicZones[0].radius, 112);
});

test('fire explodes across nearby enemies and spends its own mana and cooldown', () => {
  const game = makeGame(); game.start();
  const p = game.player;
  p.xp = p.nextXp - 1;
  const primary = enemyStats('stalker', p.x + 120, p.y); primary.hp = 20;
  const nearby = enemyStats('stalker', p.x + 145, p.y + 15); nearby.hp = 20;
  game.enemies.push(primary, nearby);
  aimAt(game, primary.x, primary.y);
  game.pointerDown(game.mouse.x, game.mouse.y, 0);
  assert.equal(p.mana, 62);
  assert.equal(game.spellCooldowns[0], MAGIC_SPELLS.fire.cooldown);
  assert.ok(game.spellCooldowns[0] > 0);
  step(game, 10);
  assert.ok(!game.enemies.includes(primary), 'direct impact should defeat the first target');
  assert.ok(nearby.hp < 20, 'the area hit should resolve before the level-up pause');
  assert.ok(game.magicBursts.length > 0, 'the explosion should leave a visible burst');
  assert.equal(game.screen, 'levelup');
});

test('ice applies a bounded timed slow and nature roots only for a limited field duration', () => {
  const iceGame = makeGame(); iceGame.start();
  iceGame.loadout = ['fire', 'ice'];
  const iceTarget = enemyStats('stalker', iceGame.player.x + 120, iceGame.player.y); iceTarget.hp = 100;
  iceGame.enemies.push(iceTarget); aimAt(iceGame, iceTarget.x, iceTarget.y);
  const iceManaBefore = iceGame.player.mana;
  iceGame.pointerDown(iceGame.mouse.x, iceGame.mouse.y, 2);
  assert.equal(iceGame.player.mana, iceManaBefore - MAGIC_SPELLS.ice.manaCost);
  step(iceGame, 10);
  assert.equal(iceTarget.slowFactor, .62);
  assert.ok(iceTarget.slowTimer > 0 && iceTarget.slowTimer <= MAGIC_SPELLS.ice.slowDuration);
  assert.ok(iceGame.spellCooldowns[1] > 0, 'right mouse uses the second active skill slot');
  assert.equal(iceGame.spellCooldowns[0], 0, 'the two mouse-button cooldowns are independent');
  step(iceGame, 60);
  assert.equal(iceTarget.slowTimer, 0);
  assert.equal(iceTarget.slowFactor, 1);

  const natureGame = makeGame(); natureGame.start();
  const rooted = enemyStats('brute', natureGame.player.x + 105, natureGame.player.y); rooted.hp = 100;
  natureGame.enemies.push(rooted); aimAt(natureGame, rooted.x, rooted.y);
  natureGame.loadout = ['fire', 'nature']; aimAt(natureGame, rooted.x, rooted.y); natureGame.pointerDown(natureGame.mouse.x, natureGame.mouse.y, 2);
  assert.equal(natureGame.magicZones.length, 1);
  assert.equal(natureGame.player.mana, 76 - MAGIC_SPELLS.nature.manaCost, 'nature field spends its configured mana cost');
  assert.equal(natureGame.spellCooldowns[1], MAGIC_SPELLS.nature.cooldown);
  step(natureGame, 1);
  assert.ok(rooted.rootTimer > 0 && rooted.rootTimer <= MAGIC_SPELLS.nature.rootDuration);
  assert.ok(rooted.hp < 100);
  step(natureGame, 100);
  assert.equal(natureGame.magicZones.length, 0);
  assert.equal(rooted.rootTimer, 0);
});

test('lightning chain stops after its target limit and all four spells can damage the boss', () => {
  const chainGame = makeGame(); chainGame.start();
  const p = chainGame.player;
  const targets = [
    enemyStats('stalker', p.x + 120, p.y),
    enemyStats('stalker', p.x + 165, p.y + 22),
    enemyStats('stalker', p.x + 210, p.y + 18),
    enemyStats('stalker', p.x + 184, p.y - 91),
  ];
  targets.forEach(enemy => { enemy.hp = 100; chainGame.enemies.push(enemy); });
  chainGame.player.xp = chainGame.player.nextXp - 1; targets[0].hp = 10;
  chainGame.basicAttackTimer = 10;
  aimAt(chainGame, targets[0].x, targets[0].y);
  chainGame.loadout = ['fire', 'lightning'];
  chainGame.pointerDown(chainGame.mouse.x, chainGame.mouse.y, 2); step(chainGame, 6);
  assert.equal(targets.filter(enemy => enemy.hp < 100).length, 4);
  assert.equal(chainGame.screen, 'levelup', 'a level-up must pause after the complete chain resolves');
  assert.ok(chainGame.magicArcs.length > 0);

  for (const spellId of ['fire', 'ice', 'lightning', 'nature']) {
    const game = makeGame(); game.start();
    const boss = enemyStats('boss', game.player.x + 130, game.player.y);
    game.boss = boss; game.bossSpawned = true; game.enemies.push(boss);
    aimAt(game, boss.x, boss.y);
    game.loadout = [spellId, spellId === 'fire' ? 'ice' : 'fire'];
    const slot = 0;
    game.setMouse(VIEW_W / 2 + 130, VIEW_H / 2);
    game.pointerDown(game.mouse.x, game.mouse.y, 0);
    step(game, 14);
    assert.ok(boss.hp < boss.maxHp, `${spellId} should damage the stage boss`);
  }
});
