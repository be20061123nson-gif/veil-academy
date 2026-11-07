export function mouseFollowMotion(player, target, movement) {
  const dx = target.x - player.x, dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= movement.stopDistance) return { x: 0, y: 0, speed: 0, distance };
  const speed = Math.min(player.speed, (distance - movement.stopDistance) * movement.acceleration);
  return { x: dx / distance, y: dy / distance, speed, distance };
}

export function rotateTowards(current, target, maxStep) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxStep, Math.min(maxStep, delta));
}
