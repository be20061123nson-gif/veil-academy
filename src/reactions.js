export const ELEMENT_MARK_DURATION = Object.freeze({
  fire: 4.5,
  ice: 4.5,
  lightning: 3.2,
  nature: 3.2,
});
export const ELEMENT_IDS = Object.freeze(Object.keys(ELEMENT_MARK_DURATION));

export const ELEMENT_REACTIONS = Object.freeze({
  steamBurst: Object.freeze({
    id: 'steamBurst', name: '蒸氣爆發', elements: Object.freeze(['fire', 'ice']),
    triggersOn: Object.freeze(['fire', 'ice']), cooldown: 1.6,
    damage: 11, splashDamage: 5, radius: 58, duration: .42,
  }),
  lightningVines: Object.freeze({
    id: 'lightningVines', name: '雷藤蔓延', elements: Object.freeze(['lightning', 'nature']),
    triggersOn: Object.freeze(['lightning']), cooldown: 2.1,
    damage: 8, hopDamage: 4, maxTargets: 3, range: 138, duration: .32,
  }),
  frozenThorns: Object.freeze({
    id: 'frozenThorns', name: '冰封荊棘', elements: Object.freeze(['ice', 'nature']),
    triggersOn: Object.freeze(['ice']), cooldown: 2.6,
    damage: 9, rootDuration: .52, duration: .48,
  }),
});
export const REACTION_IDS = Object.freeze(Object.keys(ELEMENT_REACTIONS));
export const REACTION_DEFINITIONS = Object.freeze(REACTION_IDS.map(id => ELEMENT_REACTIONS[id]));

export const BOSS_CONTROL_LIMITS = Object.freeze({
  iceSlowFactor: .78,
  iceSlowDuration: .58,
  natureRootDuration: .18,
  frozenThornsSlowFactor: .82,
  frozenThornsSlowDuration: .14,
});

export function createElementState() {
  return {
    elementMarks: { fire: 0, ice: 0, lightning: 0, nature: 0 },
    reactionCooldowns: { steamBurst: 0, lightningVines: 0, frozenThorns: 0 },
  };
}

export function updateElementState(enemy, dt) {
  for (const element of ELEMENT_IDS) {
    enemy.elementMarks[element] = Math.max(0, enemy.elementMarks[element] - dt);
  }
  for (const id of REACTION_IDS) {
    enemy.reactionCooldowns[id] = Math.max(0, enemy.reactionCooldowns[id] - dt);
  }
}

export function applyElementMark(enemy, element, duration = ELEMENT_MARK_DURATION[element], blockedReactions = null) {
  if (!ELEMENT_MARK_DURATION[element] || !enemy?.elementMarks) return null;
  enemy.elementMarks[element] = Math.max(enemy.elementMarks[element], duration);

  for (const reaction of REACTION_DEFINITIONS) {
    if (!reaction.triggersOn.includes(element) || enemy.reactionCooldowns[reaction.id] > 0) continue;
    if (blockedReactions?.has(reaction.id)) continue;
    if (!reaction.elements.every(markedElement => enemy.elementMarks[markedElement] > 0)) continue;
    for (const markedElement of reaction.elements) enemy.elementMarks[markedElement] = 0;
    enemy.reactionCooldowns[reaction.id] = reaction.cooldown;
    return reaction.id;
  }
  return null;
}
