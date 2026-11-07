// Spell definitions are kept separate from the game loop so new elements can
// be added without growing a single spell-specific combat function.
export const MAGIC_SPELLS = Object.freeze({
  fire: Object.freeze({
    id: 'fire', name: '焰爆彈', element: '火焰', color: '#ff9b62',
    damage: 31, manaCost: 14, cooldown: .9, range: 500,
    castMode: 'projectile', speed: 560, radius: 6, explosionRadius: 92, splashRatio: .66,
    description: '高傷害廣域爆裂，適合清理聚集敵群。',
  }),
  ice: Object.freeze({
    id: 'ice', name: '霜晶矢', element: '冰霜', color: '#79d8f2',
    damage: 17, manaCost: 8, cooldown: .52, range: 460,
    castMode: 'projectile', speed: 590, radius: 7, iceRadius: 70, splashRatio: .38, slowFactor: .62, slowDuration: 1.25,
    description: '快速連續射出冰晶，爆裂並短暫減速敵人。',
  }),
  lightning: Object.freeze({
    id: 'lightning', name: '鏈雷術', element: '雷電', color: '#c2a9ff',
    damage: 18, manaCost: 12, cooldown: .78, range: 520,
    castMode: 'projectile', speed: 700, radius: 6, chainCount: 5, chainRange: 190, chainFalloff: .74,
    description: '命中後以閃電跳躍攻擊最多四名近敵；升級後最多六名。',
  }),
  nature: Object.freeze({
    id: 'nature', name: '縛藤法陣', element: '自然', color: '#8ed69a',
    damage: 8, manaCost: 20, cooldown: 1, range: 360,
    castMode: 'zone', zoneRadius: 112, zoneDuration: 3, tickInterval: .5, rootDuration: .38,
    description: '在瞄準位置展開大範圍藤陣，持續傷害並牽制敵群。',
  }),
});

export const MAGIC_ORDER = Object.freeze(['fire', 'ice', 'lightning', 'nature']);
export const DEFAULT_LOADOUT = Object.freeze(['fire', 'ice']);
export const MAGIC_SLOTS = Object.freeze([
  Object.freeze({ id: 'skillOne', name: '第一招式', input: '左鍵' }),
  Object.freeze({ id: 'skillTwo', name: '第二招式', input: '右鍵' }),
]);

export function validLoadout(value) {
  return Array.isArray(value) && value.length === MAGIC_SLOTS.length &&
    value.every(id => MAGIC_ORDER.includes(id)) && new Set(value).size === MAGIC_SLOTS.length;
}

export function normalizeLoadout(value) {
  if (validLoadout(value)) return [...value];
  // Version 1 stored four unique spells in [left, right, Q, E] order.
  if (Array.isArray(value) && value.length === 4 && value.every(id => MAGIC_ORDER.includes(id)) && new Set(value).size === 4) {
    return [value[2], value[3]];
  }
  return [...DEFAULT_LOADOUT];
}

export function projectileLife(spell) {
  return spell.range / spell.speed;
}
