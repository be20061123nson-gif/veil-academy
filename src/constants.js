export const VIEW_W = 960;
export const VIEW_H = 600;
export const WORLD_W = 2240;
export const WORLD_H = 1600;
export const TILE = 32;

export const PLAYER_MOVEMENT = Object.freeze({
  stopDistance: 20,
  acceleration: 4.8,
  turnRate: 9.5,
});

export const PLAYER_KEYBOARD_SPEED = 190;
export const ENEMY_LIMIT = Object.freeze({ normal: 34, nightmare: 42 });

export const BASIC_ATTACK = Object.freeze({
  damage: 12,
  interval: .72,
  range: 420,
  projectileSpeed: 560,
  projectileRadius: 5,
});

export const PALETTE = {
  ink: '#080c13', night: '#101725', panel: '#121a28', panelLight: '#1c2738',
  line: '#44536a', ivory: '#e9e5d8', muted: '#a3aec1', cyan: '#75e4e4',
  blue: '#77a8ff', violet: '#b29cff', gold: '#e4c783', red: '#ed777f',
};

export const OBSTACLES = [
  { x: 910, y: 500, w: 420, h: 270, type: 'academy' },
  { x: 680, y: 240, w: 220, h: 104, type: 'ruin' },
  { x: 1460, y: 240, w: 210, h: 115, type: 'ruin' },
  { x: 430, y: 1190, w: 300, h: 72, type: 'pond' },
  { x: 1660, y: 1070, w: 250, h: 150, type: 'pond' },
  { x: 1540, y: 720, w: 104, h: 126, type: 'ruin' },
  { x: 590, y: 900, w: 122, h: 118, type: 'ruin' },
];

export const DECOR = [
  ...Array.from({ length: 37 }, (_, i) => ({
    x: 120 + ((i * 313 + 67) % 1980), y: 100 + ((i * 197 + 53) % 1380),
    type: i % 13 === 0 ? 'flower' : i % 6 === 0 ? 'lamp' : i % 5 === 0 ? 'rune' : 'tree', seed: i * 17 + 4,
  })),
  { x: 1120, y: 420, type: 'lamp', seed: 3 }, { x: 1390, y: 810, type: 'lamp', seed: 7 },
  { x: 820, y: 840, type: 'rune', seed: 9 }, { x: 1510, y: 490, type: 'rune', seed: 12 },
];

export const UPGRADES = [
  { id: 'power', name: '元素共鳴', tag: 'SPELL / FORCE', description: '所有魔法傷害提高 25%。', icon: '✦', apply: p => { p.damage *= 1.25; } },
  { id: 'haste', name: '迅捷回響', tag: 'SPELL / TEMPO', description: '施法間隔縮短 18%。', icon: '◈', apply: p => { p.fireDelay *= .82; } },
  { id: 'swift', name: '疾行步法', tag: 'BODY / MOTION', description: '移動速度提高 14%。', icon: '➤', apply: p => { p.speed *= 1.14; } },
  { id: 'vitality', name: '月銀護符', tag: 'BODY / VITALITY', description: '生命上限增加 30，並恢復 30。', icon: '◇', apply: p => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
  { id: 'aether', name: '潮汐冥想', tag: 'AETHER / FOCUS', description: '魔力上限增加 24，回復加快。', icon: '≈', apply: p => { p.maxMana += 24; p.manaRegen += .45; } },
  { id: 'ward', name: '暮霧結界', tag: 'BODY / WARD', description: '承受傷害降低 12%。', icon: '⬡', apply: p => { p.armor = Math.min(.48, p.armor + .12); } },
  { id: 'fireReach', spellId: 'fire', isAvailable: p => p.fireRadiusBonus < .6, name: '熾域擴張', tag: 'FIRE / AREA', description: '焰爆彈爆炸範圍擴大 20%。', icon: '✧', apply: p => { p.fireRadiusBonus = Math.min(.6, p.fireRadiusBonus + .2); } },
  { id: 'iceHold', spellId: 'ice', isAvailable: p => p.iceDurationBonus < .8, name: '寒霜留痕', tag: 'ICE / CONTROL', description: '霜晶矢的減速延長 0.25 秒。', icon: '◇', apply: p => { p.iceDurationBonus = Math.min(.8, p.iceDurationBonus + .25); } },
  { id: 'lightningFork', spellId: 'lightning', isAvailable: p => p.lightningChainBonus < 2, name: '導體分岔', tag: 'LIGHTNING / CHAIN', description: '鏈雷術可多跳躍至一名敵人，最多七個目標。', icon: 'ϟ', apply: p => { p.lightningChainBonus = Math.min(2, p.lightningChainBonus + 1); } },
  { id: 'natureBloom', spellId: 'nature', isAvailable: p => p.natureRadiusBonus < .45, name: '古根蔓延', tag: 'NATURE / FIELD', description: '縛藤法陣半徑擴大 15%。', icon: '❋', apply: p => { p.natureRadiusBonus = Math.min(.45, p.natureRadiusBonus + .15); } },
];

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const randomBetween = (min, max) => min + Math.random() * (max - min);
