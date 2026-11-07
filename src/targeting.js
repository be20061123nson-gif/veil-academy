import { distance } from './constants.js';

export function isValidEnemy(enemy) {
  return Boolean(enemy && enemy.hp > 0 && Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
}

export function findNearestEnemy(origin, enemies, range) {
  let nearest = null, nearestDistance = range;
  for (const enemy of enemies) {
    if (!isValidEnemy(enemy)) continue;
    const d = distance(origin, enemy);
    if (d <= nearestDistance) { nearest = enemy; nearestDistance = d; }
  }
  return nearest;
}

export function findAimedEnemy(origin, enemies, range, angle, tolerance = .34) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let target = null, score = Infinity;
  for (const enemy of enemies) {
    if (!isValidEnemy(enemy)) continue;
    const ex = enemy.x - origin.x, ey = enemy.y - origin.y;
    const along = ex * dx + ey * dy;
    if (along <= 0 || along > range) continue;
    const across = Math.abs(ex * dy - ey * dx);
    if (across > enemy.radius + tolerance * along + 10) continue;
    const candidate = across * 2 + along * .08;
    if (candidate < score) { score = candidate; target = enemy; }
  }
  return target;
}

export function findDenseEnemyPoint(origin, enemies, range, radius) {
  const candidates = enemies.filter(enemy => isValidEnemy(enemy) && distance(origin, enemy) <= range);
  if (!candidates.length) return null;
  let bestMembers = [], bestX = 0, bestY = 0, bestDistance = Infinity;

  for (const candidate of candidates) {
    const members = candidates.filter(enemy => distance(candidate, enemy) <= radius + enemy.radius);
    const x = members.reduce((sum, enemy) => sum + enemy.x, 0) / members.length;
    const y = members.reduce((sum, enemy) => sum + enemy.y, 0) / members.length;
    const d = Math.hypot(x - origin.x, y - origin.y);
    if (members.length > bestMembers.length || (members.length === bestMembers.length && d < bestDistance)) {
      bestMembers = members; bestX = x; bestY = y; bestDistance = d;
    }
  }
  return { x: bestX, y: bestY, targets: bestMembers };
}
