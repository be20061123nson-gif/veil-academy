export const WORLD_EVENTS = Object.freeze({
  spring: Object.freeze({ id: 'spring', name: '庭園泉祠', color: '#77e1d3', life: 30 }),
  rift: Object.freeze({ id: 'rift', name: '裂隙祭壇', color: '#bb9cff', life: 30 }),
});

export const WORLD_EVENT_RADIUS = 68;

export function createWorldEvent(type, x, y) {
  const data = WORLD_EVENTS[type];
  return data ? { ...data, x, y, remaining: data.life } : null;
}

export function resolveWorldEvent(type, player) {
  if (type === 'spring') {
    const hp = Math.min(24, player.maxHp - player.hp);
    const mana = Math.min(30, player.maxMana - player.mana);
    player.hp += hp; player.mana += mana;
    return { xp: 12, hp, mana, spawns: 0, powerSeconds: 0 };
  }
  if (type === 'rift') return { xp: 18, hp: 0, mana: 0, spawns: 3, powerSeconds: 10 };
  return null;
}
