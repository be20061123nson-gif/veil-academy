import { BASIC_ATTACK, PALETTE, VIEW_H, VIEW_W } from './constants.js';
import { drawMinimap } from './world.js';
import { MAGIC_SPELLS, MAGIC_SLOTS } from './magic.js';

const FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
const MONO = '"DM Mono", Consolas, monospace';

function text(ctx, value, x, y, size = 14, color = PALETTE.ivory, weight = 500, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4; ctx.fillText(value, x, y); ctx.shadowBlur = 0;
}

function mono(ctx, value, x, y, size = 11, color = PALETTE.muted, align = 'left') {
  ctx.font = `500 ${size}px ${MONO}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, alpha = .9) {
  ctx.fillStyle = `rgba(10, 15, 25, ${alpha})`; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(170, 189, 218, .24)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(134, 171, 204, .16)'; ctx.fillRect(x + 1, y + 1, 25, 2); ctx.fillRect(x + 1, y + 1, 2, 17);
}

function button(ctx, buttons, game, id, x, y, w, h, label, sub = '', accent = PALETTE.cyan) {
  const hot = game.mouse.x >= x && game.mouse.x <= x + w && game.mouse.y >= y && game.mouse.y <= y + h;
  const index = buttons.length;
  buttons.push({ id, x, y, w, h });
  ctx.fillStyle = hot ? 'rgba(71, 112, 137, .46)' : 'rgba(24, 34, 49, .86)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hot ? accent : 'rgba(157, 180, 211, .34)'; ctx.lineWidth = hot ? 2 : 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.fillStyle = accent; ctx.fillRect(x, y, 3, h);
  text(ctx, label, x + w / 2, y + (sub ? 22 : h / 2), 15, hot ? '#fff' : PALETTE.ivory, 700, 'center');
  if (sub) mono(ctx, sub, x + w / 2, y + 43, 9, '#aab8cd', 'center');
  return index;
}

function drawBar(ctx, x, y, w, h, value, max, color, label, valueText) {
  ctx.fillStyle = 'rgba(3, 7, 13, .72)'; ctx.fillRect(x, y, w, h);
  const fill = Math.max(0, Math.min(w, w * value / Math.max(1, max)));
  ctx.fillStyle = color; ctx.fillRect(x, y, fill, h);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, y, fill, 2);
  ctx.strokeStyle = 'rgba(198, 210, 230, .35)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  mono(ctx, label, x + 1, y - 7, 9, '#d9e1ed');
  mono(ctx, valueText, x + w - 1, y - 7, 9, '#e9edf5', 'right');
}

function drawSpellGlyph(ctx, id, x, y, size, color) {
  const half = size / 2;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, size / 7); ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
  ctx.beginPath();
  if (id === 'fire') {
    ctx.moveTo(0, half); ctx.lineTo(-half * .72, half * .25); ctx.lineTo(-half * .48, -half * .12);
    ctx.lineTo(-half * .18, -half * .62); ctx.lineTo(half * .08, -half * .28);
    ctx.lineTo(half * .42, -half * .7); ctx.lineTo(half * .68, -half * .08); ctx.lineTo(half * .56, half * .3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe0a5'; ctx.fillRect(-1, -half * .1, 2, half * .55);
  } else if (id === 'ice') {
    ctx.moveTo(0, -half); ctx.lineTo(half * .62, -half * .22); ctx.lineTo(half * .42, half * .72);
    ctx.lineTo(0, half); ctx.lineTo(-half * .42, half * .72); ctx.lineTo(-half * .62, -half * .22); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -half * .7); ctx.lineTo(0, half * .75); ctx.moveTo(-half * .48, -half * .16); ctx.lineTo(half * .48, half * .38); ctx.moveTo(half * .48, -half * .16); ctx.lineTo(-half * .48, half * .38); ctx.stroke();
  } else if (id === 'lightning') {
    ctx.moveTo(half * .18, -half); ctx.lineTo(-half * .42, -half * .02); ctx.lineTo(-half * .04, -half * .02);
    ctx.lineTo(-half * .22, half); ctx.lineTo(half * .48, -half * .2); ctx.lineTo(half * .08, -half * .2); ctx.closePath(); ctx.fill();
  } else {
    ctx.moveTo(0, half); ctx.lineTo(0, -half * .75); ctx.moveTo(0, 0); ctx.lineTo(-half * .68, -half * .44); ctx.moveTo(0, half * .18); ctx.lineTo(half * .68, -half * .4); ctx.stroke();
    ctx.fillRect(-half * .72, -half * .56, half * .34, half * .34); ctx.fillRect(half * .38, -half * .52, half * .34, half * .34);
  }
  ctx.restore();
}

function drawAimGuide(ctx, game) {
  if (!game.player || !game.inputFocused) return;
  const p = game.player, sx = p.x - game.camera.x, sy = p.y - game.camera.y;
  let dx = game.mouse.x - sx, dy = game.mouse.y - sy;
  const distance = Math.hypot(dx, dy) || 1;
  dx /= distance; dy /= distance;
  const length = Math.min(480, distance), start = 23, end = Math.max(start, length);
  ctx.save(); ctx.fillStyle = '#ff5b6b'; ctx.globalAlpha = .4;
  for (let at = start; at < end; at += 15) {
    const x = sx + dx * at, y = sy + dy * at;
    ctx.fillRect(Math.round(x), Math.round(y), 4, 2);
  }
  ctx.globalAlpha = .9; ctx.strokeStyle = '#ff6978'; ctx.lineWidth = 1.5;
  const cx = game.mouse.x, cy = game.mouse.y, gap = 4, arm = 10;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy); ctx.lineTo(cx - gap, cy); ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy - gap); ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + arm);
  ctx.stroke(); ctx.fillStyle = '#ff5568'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
  ctx.restore();
}

export function drawUI(ctx, game) {
  const buttons = [];
  if (game.screen === 'menu') drawMenu(ctx, game, buttons);
  if (game.screen === 'settings') drawSettings(ctx, game, buttons);
  if (game.screen === 'howto') drawHowTo(ctx, game, buttons);
  if (game.screen === 'loadout') drawLoadout(ctx, game, buttons);
  if (game.screen === 'playing') drawAimGuide(ctx, game);
  if (game.screen === 'playing' || game.screen === 'paused' || game.screen === 'levelup' || game.screen === 'gameover') drawHUD(ctx, game, buttons);
  if (game.screen === 'paused') drawPause(ctx, game, buttons);
  if (game.screen === 'levelup') drawLevelUp(ctx, game, buttons);
  if (game.screen === 'gameover') drawGameOver(ctx, game, buttons);
  if (game.screen === 'victory') drawVictory(ctx, game, buttons);
  game.buttons = buttons;
}

function drawMenu(ctx, game, buttons) {
  ctx.fillStyle = 'rgba(7, 10, 18, .65)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const shade = ctx.createLinearGradient(0, 40, 750, 560);
  shade.addColorStop(0, 'rgba(7, 11, 19, .8)'); shade.addColorStop(.65, 'rgba(8, 12, 20, .42)'); shade.addColorStop(1, 'rgba(8, 12, 20, .05)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Academy seal and restrained title ornament.
  ctx.strokeStyle = 'rgba(163, 151, 216, .23)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(160, 202, 100, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(160, 202, 84, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.translate(160, 202); ctx.rotate(-game.clock * .08); ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const r = i % 2 ? 67 : 77; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(179, 160, 234, .42)'; ctx.fillRect(157, 187, 6, 30); ctx.fillRect(145, 199, 30, 6);
  ctx.fillStyle = 'rgba(146, 210, 231, .6)'; ctx.fillRect(158, 198, 4, 4);
  mono(ctx, 'THE VEIL ACADEMY  /  FIELD TRIAL 01', 300, 115, 10, '#b5bfd0');
  text(ctx, '霧境學院', 294, 175, 48, '#f1ede3', 800);
  ctx.fillStyle = PALETTE.violet; ctx.fillRect(298, 210, 73, 3);
  text(ctx, '暮鐘試煉', 298, 241, 19, '#c9d5e5', 600);
  text(ctx, '薄霧漫過庭園，鐘聲喚醒了沉睡的守衛。', 298, 278, 14, '#aab5c6', 400);
  button(ctx, buttons, game, 'start', 298, 338, 232, 56, '開始試煉', 'ENTER THE GROUNDS', '#8de4e2');
  button(ctx, buttons, game, 'settings', 298, 405, 112, 43, '遊戲設定', '', '#b29cff');
  button(ctx, buttons, game, 'howto', 418, 405, 112, 43, '遊戲介紹', '', '#a4c8fa');
  button(ctx, buttons, game, 'loadout', 538, 405, 112, 43, '魔法配置', '', '#8ed69a');
  mono(ctx, 'WASD 移動　·　滑鼠瞄準　·　左右鍵施法　·　SPACE 閃避', 298, 482, 9, '#bac5d4');
  mono(ctx, 'A PIXEL ACTION ROGUELITE  ·  BUILD 01', 298, 520, 9, '#7d8ba1');
  mono(ctx, '在迷霧中尋路，撐過暮鐘的召喚。', 298, 557, 10, '#98a4b6');
}

function drawSettings(ctx, game, buttons) {
  overlay(ctx);
  panel(ctx, 250, 82, 460, 436, .97);
  mono(ctx, 'ACADEMY / OPTIONS', 284, 120, 10, PALETTE.cyan);
  text(ctx, '遊戲設定', 284, 158, 27, PALETTE.ivory, 700);
  text(ctx, '試煉難度', 284, 204, 14, '#c5ccda', 600);
  button(ctx, buttons, game, 'difficulty', 284, 224, 390, 52,
    game.difficulty === 'normal' ? '標準試煉' : '夜巡試煉',
    game.difficulty === 'normal' ? '敵人耐久與出現速度平衡' : '敵人更強，霧靈來襲更頻繁',
    game.difficulty === 'normal' ? PALETTE.cyan : PALETTE.red);
  text(ctx, '畫面特效', 284, 302, 14, '#c5ccda', 600);
  button(ctx, buttons, game, 'effects', 284, 322, 390, 52,
    game.reducedFx ? '精簡特效：開' : '精簡特效：關',
    '減少漂浮粒子與受擊閃光', PALETTE.violet);
  text(ctx, '音效', 284, 394, 14, '#c5ccda', 600);
  button(ctx, buttons, game, 'audio', 284, 412, 390, 46,
    game.audio.enabled ? '合成音效：開' : '合成音效：關',
    '使用瀏覽器即時合成，首次操作後啟用', '#87d9d5');
  button(ctx, buttons, game, 'back', 284, 474, 160, 34, '返回主畫面', '', '#a4c8fa');
}

function drawHowTo(ctx, game, buttons) {
  overlay(ctx);
  panel(ctx, 198, 72, 564, 466, .97);
  mono(ctx, 'FIELD GUIDE / 01', 232, 110, 10, PALETTE.cyan);
  text(ctx, '暮鐘庭園試煉', 232, 149, 27, PALETTE.ivory, 700);
  text(ctx, '在學院庭園中迎戰迷霧生物，吸收以太經驗並選擇成長能力。', 232, 189, 13, '#b5c0d1', 400);
  const rows = [
    ['WASD', '八方向移動，斜向速度會正規化'], ['滑鼠', '準心瞄準；角色與法杖持續跟隨方向'],
    ['左右鍵', '施放第一／第二招式，依準心方向攻擊'], ['SPACE', '朝游標方向閃避，冷卻期間無法再次使用'],
    ['F', '靠近庭園異象後互動，選擇恢復或風險獎勵'], ['暮鐘', '試煉經過一段時間後，監院將現身'],
  ];
  rows.forEach((r, i) => {
    const y = 226 + i * 43;
    ctx.fillStyle = 'rgba(42, 55, 76, .5)'; ctx.fillRect(232, y - 16, 122, 31);
    mono(ctx, r[0], 293, y, 11, i === 4 ? '#e8adcf' : '#a8d8e0', 'center');
    text(ctx, r[1], 372, y, 12, '#d6dce8', 500);
    ctx.fillStyle = 'rgba(172, 192, 217, .13)'; ctx.fillRect(232, y + 22, 496, 1);
  });
  button(ctx, buttons, game, 'back', 232, 480, 166, 40, '返回主畫面', '', '#a4c8fa');
}

function drawLoadout(ctx, game, buttons) {
  overlay(ctx); panel(ctx, 124, 58, 712, 484, .98);
  mono(ctx, 'ACADEMY / SPELL ATTUNEMENT', 160, 93, 10, PALETTE.cyan);
  text(ctx, '魔法配置', 160, 124, 26, PALETTE.ivory, 700);
  const selectedSpell = MAGIC_SPELLS[game.loadout[game.selectedLoadoutSlot]];
  text(ctx, '每局選配兩種招式；選取第一或第二招式欄位，再點選要裝備的魔法。', 160, 149, 11, '#aeb9ca', 400);
  MAGIC_SLOTS.forEach((slot, i) => {
    const x = 160 + i * 326, y = 169, w = 310, h = 74;
    const selected = game.selectedLoadoutSlot === i;
    const spell = MAGIC_SPELLS[game.loadout[i]];
    buttons.push({ id: 'loadout-slot', index: i, x, y, w, h });
    ctx.fillStyle = selected ? 'rgba(61, 75, 103, .95)' : 'rgba(17, 25, 39, .92)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = selected ? spell.color : 'rgba(165, 184, 214, .34)'; ctx.lineWidth = selected ? 2 : 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = spell.color; ctx.fillRect(x, y, 3, h);
    drawSpellGlyph(ctx, spell.id, x + 33, y + 37, 25, spell.color);
    mono(ctx, `${slot.input}  /  ${slot.name}`, x + 57, y + 20, 9, selected ? '#eff5ff' : '#aab7ca');
    text(ctx, spell.name, x + 57, y + 52, 16, spell.color, 700);
  });
  text(ctx, `目前選取：${MAGIC_SLOTS[game.selectedLoadoutSlot].name}｜${selectedSpell.name}`, 160, 260, 12, selectedSpell.color, 600);
  const ids = Object.keys(MAGIC_SPELLS);
  ids.forEach((id, i) => {
    const spell = MAGIC_SPELLS[id], x = 160 + (i % 2) * 326, y = 282 + Math.floor(i / 2) * 77, w = 310, h = 68;
    const assignedTo = game.loadout.indexOf(id), selected = assignedTo === game.selectedLoadoutSlot;
    const hot = game.mouse.x >= x && game.mouse.x <= x + w && game.mouse.y >= y && game.mouse.y <= y + h;
    buttons.push({ id: 'loadout-spell', spellId: id, x, y, w, h });
    ctx.fillStyle = hot || selected ? 'rgba(50, 65, 92, .97)' : 'rgba(17, 25, 39, .92)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hot || selected ? spell.color : 'rgba(165, 184, 214, .31)'; ctx.lineWidth = hot || selected ? 2 : 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = spell.color; ctx.fillRect(x, y, 3, h);
    drawSpellGlyph(ctx, spell.id, x + 29, y + 33, 24, spell.color);
    text(ctx, spell.name, x + 51, y + 23, 15, spell.color, 700);
    const role = assignedTo >= 0 ? `已配置：${MAGIC_SLOTS[assignedTo].name}` : '未配置';
    mono(ctx, `${spell.element}  ·  ${spell.manaCost} MP  ·  冷卻 ${spell.cooldown.toFixed(1)}s  ·  ${role}`, x + 51, y + 48, 9, '#b7c2d2');
  });
  button(ctx, buttons, game, 'back', 160, 476, 170, 42, '儲存並返回', '', '#a4c8fa');
}

function drawHUD(ctx, game, buttons) {
  const p = game.player;
  ctx.fillStyle = 'rgba(9, 14, 23, .82)'; ctx.fillRect(0, 0, VIEW_W, 66);
  ctx.fillStyle = 'rgba(180, 195, 222, .2)'; ctx.fillRect(0, 65, VIEW_W, 1);
  text(ctx, '霧境學院', 18, 20, 13, '#dcd9e3', 700);
  mono(ctx, `LV ${String(p.level).padStart(2, '0')}`, 19, 43, 10, PALETTE.cyan);
  drawBar(ctx, 94, 24, 178, 12, p.hp, p.maxHp, '#c05f73', '生命', `${Math.ceil(p.hp)} / ${p.maxHp}`);
  drawBar(ctx, 94, 49, 178, 9, p.mana, p.maxMana, '#607bd1', '魔力', `${Math.floor(p.mana)} / ${p.maxMana}`);
  const expX = 299, expW = 238;
  ctx.fillStyle = 'rgba(3, 7, 13, .68)'; ctx.fillRect(expX, 37, expW, 9);
  ctx.fillStyle = '#7bcbd0'; ctx.fillRect(expX, 37, expW * Math.min(1, p.xp / p.nextXp), 9);
  ctx.strokeStyle = 'rgba(198, 210, 230, .28)'; ctx.strokeRect(expX + .5, 37.5, expW - 1, 8);
  mono(ctx, '以太經驗', expX, 24, 9, '#c7d4e1'); mono(ctx, `${p.xp} / ${p.nextXp}`, expX + expW, 24, 9, '#dbe3ed', 'right');
  mono(ctx, '擊敗', 579, 27, 9, '#a7b4c8'); text(ctx, String(p.kills).padStart(2, '0'), 579, 47, 16, '#e8e5da', 700);
  mono(ctx, '存活', 646, 27, 9, '#a7b4c8'); text(ctx, game.formatTime(), 646, 47, 15, '#e8e5da', 600);
  if (game.boss) mono(ctx, '暮鐘已響', 735, 47, 9, '#ec9dbd', 'center');
  const pauseBtn = { id: 'pause', x: 811, y: 16, w: 34, h: 34 };
  buttons.push(pauseBtn);
  ctx.fillStyle = game.mouse.x >= 811 && game.mouse.x <= 845 && game.mouse.y >= 16 && game.mouse.y <= 50 ? 'rgba(113, 144, 177, .4)' : 'rgba(35, 45, 62, .65)';
  ctx.fillRect(811, 16, 34, 34); ctx.strokeStyle = 'rgba(191, 208, 230, .38)'; ctx.strokeRect(811.5, 16.5, 33, 33);
  ctx.fillStyle = '#c5cfde'; ctx.fillRect(822, 25, 3, 16); ctx.fillRect(831, 25, 3, 16);
  drawMinimap(ctx, p, game.enemies);
  // XP strip hugs the bottom edge, so progression remains visible in combat.
  ctx.fillStyle = 'rgba(4, 7, 12, .72)'; ctx.fillRect(0, VIEW_H - 8, VIEW_W, 8);
  ctx.fillStyle = '#7ed5d8'; ctx.fillRect(0, VIEW_H - 8, VIEW_W * Math.min(1, p.xp / p.nextXp), 3);
  const dashLabel = p.dashCooldown <= 0 ? 'SPACE  /  閃避就緒' : `SPACE  /  ${p.dashCooldown.toFixed(1)}s`;
  MAGIC_SLOTS.forEach((slot, i) => {
    const spell = MAGIC_SPELLS[game.loadout[i]], timer = game.spellCooldowns[i] || 0;
    const x = 320 + i * 204, y = 544, w = 198, h = 40;
    const active = game.activeSpellSlot === i && game.activeSpellTimer > 0;
    ctx.fillStyle = active ? 'rgba(51, 65, 88, .96)' : 'rgba(8, 13, 22, .88)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active ? spell.color : 'rgba(160, 179, 209, .26)'; ctx.lineWidth = active ? 2 : 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = spell.color; ctx.fillRect(x + 1, y + 1, w - 2, 2);
    drawSpellGlyph(ctx, spell.id, x + 17, y + 21, 16, spell.color);
    mono(ctx, `${slot.input}  ${spell.name}`, x + 32, y + 13, 10, active ? '#fff' : spell.color);
    mono(ctx, `${spell.manaCost} MP  ·  ${timer <= 0 ? '就緒' : `${timer.toFixed(1)}s`}`, x + w / 2, y + 29, 9, p.mana >= spell.manaCost ? '#aebdce' : '#858b9c', 'center');
  });
  ctx.fillStyle = 'rgba(8, 13, 22, .88)'; ctx.fillRect(180, 544, 132, 40);
  ctx.strokeStyle = 'rgba(160, 179, 209, .26)'; ctx.strokeRect(180.5, 544.5, 131, 39);
  mono(ctx, '自動普攻', 246, 557, 9, '#8fe4df', 'center');
  const basicState = game.basicAttackTarget
    ? game.basicAttackTimer <= 0 ? '目標鎖定' : `下一擊 ${game.basicAttackTimer.toFixed(1)}s`
    : '搜尋目標';
  mono(ctx, `${basicState}  ·  ${BASIC_ATTACK.damage} 傷害`, 246, 573, 8, '#aebdce', 'center');
  ctx.fillStyle = 'rgba(8, 13, 22, .88)'; ctx.fillRect(729, 544, 117, 40);
  ctx.strokeStyle = 'rgba(160, 179, 209, .26)'; ctx.strokeRect(729.5, 544.5, 116, 39);
  mono(ctx, dashLabel, 787, 564, 9, p.dashCooldown <= 0 ? '#c8b9fa' : '#a4a9b6', 'center');
  if (game.boss) drawBossBar(ctx, game.boss);
  if (game.announcement > 0) {
    const alpha = Math.min(1, game.announcement * 1.1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(17, 12, 27, .82)'; ctx.fillRect(275, 193, 410, 71);
    ctx.strokeStyle = 'rgba(218, 158, 222, .58)'; ctx.strokeRect(275.5, 193.5, 409, 70);
    mono(ctx, 'THE BELL HAS ANSWERED', 480, 211, 10, '#e6b2d5', 'center');
    text(ctx, game.boss?.phaseTwo ? '鐘核裂解・攻勢轉變' : '暮鐘監院現身', 480, 239, 22, '#f1dde9', 700, 'center');
    ctx.globalAlpha = 1;
  }
}

function drawBossBar(ctx, boss) {
  ctx.fillStyle = 'rgba(9, 9, 17, .82)'; ctx.fillRect(285, 79, 390, 24);
  ctx.fillStyle = '#68435c'; ctx.fillRect(293, 91, 374, 5);
  ctx.fillStyle = '#d071a2'; ctx.fillRect(293, 91, 374 * Math.max(0, boss.hp / boss.maxHp), 5);
  mono(ctx, boss.attackWarning > 0 ? '攻擊預警' : boss.phaseTwo ? '暮鐘監院・第二相' : '暮鐘監院', 294, 85, 9, boss.attackWarning > 0 ? '#f0a7d5' : '#eadbe8');
}

function overlay(ctx) {
  ctx.fillStyle = 'rgba(6, 9, 16, .73)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawPause(ctx, game, buttons) {
  overlay(ctx); panel(ctx, 326, 174, 308, 250, .97);
  mono(ctx, 'FIELD TRIAL / PAUSED', 480, 215, 10, PALETTE.cyan, 'center');
  text(ctx, '暫停試煉', 480, 251, 25, PALETTE.ivory, 700, 'center');
  text(ctx, 'WASD 移動　·　滑鼠瞄準　·　左右鍵施法　·　SPACE 閃避', 480, 287, 10, '#b4bfd0', 400, 'center');
  button(ctx, buttons, game, 'resume', 369, 324, 222, 42, '繼續試煉', '', PALETTE.cyan);
  button(ctx, buttons, game, 'menu', 369, 375, 222, 36, '返回主畫面', '', '#b29cff');
}

function drawLevelUp(ctx, game, buttons) {
  overlay(ctx);
  mono(ctx, `LEVEL ${String(game.player.level).padStart(2, '0')} / NEW ATTUNEMENT`, 480, 129, 10, PALETTE.cyan, 'center');
  text(ctx, '選擇一項能力', 480, 171, 27, '#f0ecdf', 700, 'center');
  text(ctx, '試煉暫停中，選擇後立即生效', 480, 202, 12, '#aeb9ca', 400, 'center');
  game.choices.forEach((choice, i) => {
    const x = 169 + i * 207, y = 246, w = 190, h = 213;
    const hot = game.mouse.x >= x && game.mouse.x <= x + w && game.mouse.y >= y && game.mouse.y <= y + h;
    buttons.push({ id: 'upgrade', index: i, x, y, w, h });
    ctx.fillStyle = hot ? 'rgba(50, 65, 92, .97)' : 'rgba(17, 25, 39, .96)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hot ? '#9fceec' : 'rgba(165, 184, 214, .36)'; ctx.lineWidth = hot ? 2 : 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = i === 0 ? '#b9a4ee' : i === 1 ? '#8bd9dc' : '#d5b779'; ctx.fillRect(x + 1, y + 1, w - 2, 3);
    ctx.fillStyle = 'rgba(88, 100, 137, .3)'; ctx.fillRect(x + 21, y + 25, 44, 44);
    text(ctx, choice.icon, x + 43, y + 47, 24, i === 0 ? '#d6c4ff' : i === 1 ? '#a9f2ee' : '#f0d9a1', 600, 'center');
    mono(ctx, choice.tag, x + 18, y + 91, 8, '#9eacc1');
    text(ctx, choice.name, x + 18, y + 119, 17, '#eee9df', 700);
    ctx.fillStyle = 'rgba(167, 185, 211, .22)'; ctx.fillRect(x + 18, y + 141, w - 36, 1);
    text(ctx, choice.description, x + 18, y + 165, 11, '#b4c0d2', 500);
    mono(ctx, `選擇 ${i + 1}`, x + 18, y + 194, 9, hot ? '#d7e6f6' : '#8f9caf');
  });
}

function drawGameOver(ctx, game, buttons) {
  overlay(ctx); panel(ctx, 300, 112, 360, 378, .98);
  mono(ctx, 'FIELD TRIAL / COMPLETE', 480, 154, 10, '#d88ca9', 'center');
  text(ctx, '迷霧吞沒了庭園', 480, 198, 25, '#eee5de', 700, 'center');
  text(ctx, '你的試煉紀錄', 480, 233, 12, '#aeb9ca', 500, 'center');
  const stats = [['存活時間', game.formatTime()], ['擊敗敵人', `${game.player.kills} 隻`], ['最高等級', `LV ${game.player.level}`]];
  stats.forEach((row, i) => {
    const y = 282 + i * 42;
    text(ctx, row[0], 360, y, 13, '#aab5c6', 500);
    text(ctx, row[1], 600, y, 16, '#eee8da', 700, 'right');
    ctx.fillStyle = 'rgba(175, 191, 216, .16)'; ctx.fillRect(354, y + 20, 246, 1);
  });
  button(ctx, buttons, game, 'restart', 350, 422, 260, 43, '再次進入庭園', 'RESTART TRIAL', PALETTE.cyan);
}

function drawVictory(ctx, game, buttons) {
  overlay(ctx); panel(ctx, 300, 96, 360, 428, .98);
  mono(ctx, 'FIELD TRIAL / CLEARED', 480, 139, 10, PALETTE.cyan, 'center');
  text(ctx, '暮鐘止息', 480, 184, 27, '#f1ede3', 700, 'center');
  text(ctx, '暮鐘監院已被擊敗，庭園暫時重歸寧靜。', 480, 221, 12, '#b8c6d6', 400, 'center');
  text(ctx, '你的試煉紀錄', 480, 255, 12, '#aeb9ca', 500, 'center');
  const stats = [['存活時間', game.formatTime()], ['擊敗敵人', `${game.player.kills} 隻`], ['本局等級', `LV ${game.player.level}`]];
  stats.forEach((row, i) => {
    const y = 298 + i * 42;
    text(ctx, row[0], 360, y, 13, '#aab5c6', 500);
    text(ctx, row[1], 600, y, 16, '#eee8da', 700, 'right');
    ctx.fillStyle = 'rgba(175, 191, 216, .16)'; ctx.fillRect(354, y + 20, 246, 1);
  });
  button(ctx, buttons, game, 'restart', 350, 433, 260, 43, '再次進入庭園', 'RESTART TRIAL', PALETTE.cyan);
  button(ctx, buttons, game, 'menu', 350, 483, 260, 30, '返回主畫面', '', '#b29cff');
}
