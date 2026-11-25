// Sizzle Street Kitchen — 纯 canvas 渲染。所有画面程序生成，零外部资源。
import {
  CANVAS_W, CANVAS_H, INGREDIENTS, DISHES, dishById, unlockedIngredients,
  ingredientUnlockDay, LAYOUT, BIN_ORDER, inRect, shopItemRect,
  upgradeById, upgradePrice, UPGRADES, FRY_TIME, BOIL_TIME,
  chopsNeeded, burnWindow,
} from './data.js';
import { derivedPrep, plateDish } from './logic.js';

const FONT = '"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function heart(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);
  ctx.beginPath();
  ctx.moveTo(8, 14);
  ctx.bezierCurveTo(0, 8, -2, 2, 3, 0);
  ctx.bezierCurveTo(6, -1, 8, 2, 8, 4);
  ctx.bezierCurveTo(8, 2, 10, -1, 13, 0);
  ctx.bezierCurveTo(18, 2, 16, 8, 8, 14);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
function star(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
function text(ctx, str, x, y, size, color, align = 'left', bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}
function chipTextColor(hex) {
  // 浅色底用深字、深色底用白字，避免鸡蛋/米饭这类浅色签看不清
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#3b2d20' : '#fff';
}
function chip(ctx, x, y, label, color, w = 44) {
  rr(ctx, x, y, w, 22, 11);
  ctx.fillStyle = color;
  ctx.fill();
  text(ctx, label, x + w / 2, y + 11, 12, chipTextColor(color), 'center', true);
}
function button(ctx, r, label, sub, enabled = true) {
  rr(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fillStyle = enabled ? '#e4572e' : '#9a9a9a';
  ctx.fill();
  ctx.strokeStyle = '#b23a17';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 10 : 0), 22, '#fff', 'center', true);
  if (sub) text(ctx, sub, r.x + r.w / 2, r.y + r.h / 2 + 16, 13, '#ffe8d6', 'center');
}
function progressBar(ctx, x, y, w, h, frac, color) {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#e8e0d0';
  ctx.fill();
  if (frac > 0) {
    rr(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
function itemLabel(item) {
  const g = INGREDIENTS[item.ing];
  let suffix = '';
  if (item.burnt) suffix = '(焦)';
  else if (item.fried) suffix = '(煎好)';
  else if (item.boiled) suffix = '(煮好)';
  else if (item.chopped) suffix = '(切好)';
  return g.name + suffix;
}

export function render(ctx, s) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  // 厨房底色
  ctx.fillStyle = '#f7ead7';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#e8cfa8';
  ctx.fillRect(0, 210, CANVAS_W, 8);
  ctx.fillStyle = '#d9b98a';
  ctx.fillRect(0, 640, CANVAS_W, 80);

  if (s.phase === 'title') return renderTitle(ctx, s);
  if (s.phase === 'howto') return renderHowto(ctx, s);
  if (s.phase === 'dayend') return renderDayEnd(ctx, s);
  if (s.phase === 'shop') return renderShop(ctx, s);
  if (s.phase === 'gameover') return renderGameOver(ctx, s);
  renderPlaying(ctx, s);
  if (s.phase === 'paused') renderPaused(ctx, s);
}

function renderHud(ctx, s) {
  rr(ctx, 0, 0, CANVAS_W, 54, 0);
  ctx.fillStyle = '#3b2d20';
  ctx.fillRect(0, 0, CANVAS_W, 54);
  text(ctx, `第 ${s.day} 天`, 24, 28, 20, '#fff', 'left', true);
  const left = Math.max(0, s.dayLength - s.elapsed);
  const mm = Math.floor(left / 60);
  const ss = Math.floor(left % 60).toString().padStart(2, '0');
  text(ctx, `时间 ${mm}:${ss}`, 150, 28, 18, '#ffd98a');
  text(ctx, `营业额 $${s.revenue.toFixed(0)} / $${s.target}`, 300, 28, 18, '#fff', 'left', true);
  const special = dishById(s.specialDishId);
  if (special) text(ctx, `今日特价: ${special.name} x1.5`, 560, 28, 16, '#ffd23e');
  for (let i = 0; i < 5; i++) heart(ctx, 830 + i * 26, 28, 18, i < s.hearts ? '#e63946' : '#5a4632');
  text(ctx, `连击 x${s.combo.toFixed(1)}`, 970, 28, 18, '#7ee081', 'left', true);
  rr(ctx, LAYOUT.muteBtn.x, LAYOUT.muteBtn.y, 40, 38, 8);
  ctx.fillStyle = '#5a4632';
  ctx.fill();
  text(ctx, s.muted ? '静音' : '音效', LAYOUT.muteBtn.x + 20, 27, 13, '#fff', 'center', true);
  rr(ctx, LAYOUT.pauseBtn.x, LAYOUT.pauseBtn.y, 40, 38, 8);
  ctx.fillStyle = '#5a4632';
  ctx.fill();
  text(ctx, '暂停', LAYOUT.pauseBtn.x + 20, 27, 13, '#fff', 'center', true);
}

function renderPlaying(ctx, s) {
  renderHud(ctx, s);
  // ---- 座位与客人 ----
  for (let i = 0; i < 4; i++) {
    const r = LAYOUT.seats[i];
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fillStyle = '#fff8ec';
    ctx.fill();
    ctx.strokeStyle = '#d9c39a';
    ctx.lineWidth = 2;
    ctx.stroke();
    const c = s.customers.find((x) => x.seat === i);
    if (!c) {
      text(ctx, '空座', r.x + r.w / 2, r.y + r.h / 2, 18, '#b09a7a', 'center');
      continue;
    }
    const dish = dishById(c.dishId);
    // 人像
    ctx.beginPath();
    ctx.arc(r.x + 52, r.y + 78, 26, 0, Math.PI * 2);
    ctx.fillStyle = c.vip ? '#f2c230' : c.critic ? '#8e6cc8' : '#7fb069';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r.x + 52, r.y + 128, 30, Math.PI, 0);
    ctx.fillStyle = c.vip ? '#d9a41f' : c.critic ? '#6a4fa3' : '#5a8f4d';
    ctx.fill();
    text(ctx, c.vip ? 'VIP' : c.critic ? '评论家' : '客人', r.x + 52, r.y + 30, 13, c.vip ? '#a67c00' : c.critic ? '#5b3d99' : '#666', 'center', true);
    // 订单
    text(ctx, dish.name, r.x + 110, r.y + 28, 19, '#3b2d20', 'left', true);
    text(ctx, `$${dish.price}${c.vip ? ' x1.5' : ''}`, r.x + 110, r.y + 52, 15, '#e4572e', 'left', true);
    let cx = r.x + 110;
    for (const comp of dish.components) {
      const g = INGREDIENTS[comp.ing];
      const label = g.short + (comp.prep === 'cut' ? '切' : comp.prep === 'fry' ? '煎' : comp.prep === 'boil' ? '煮' : comp.prep === 'cutfry' ? '切煎' : '');
      chip(ctx, cx, r.y + 68, label, g.color, 46);
      cx += 52;
    }
    // 耐心条
    const frac = Math.max(0, c.patience / c.patienceMax);
    progressBar(ctx, r.x + 110, r.y + 104, 160, 14, frac, frac > 0.5 ? '#58b368' : frac > 0.25 ? '#f2a541' : '#e63946');
    text(ctx, `耐心 ${Math.ceil(c.patience)}s`, r.x + 110, r.y + 128, 13, '#666');
  }
  // ---- 食材箱 ----
  text(ctx, '食材箱（点一下拿料）', 24, 222, 14, '#8a6d4b', 'left', true);
  const ings = unlockedIngredients(s.day);
  for (const g of Object.values(INGREDIENTS)) {
    const gi = BIN_ORDER.indexOf(g.id);
    const r = LAYOUT.bins[gi];
    const locked = ingredientUnlockDay(g.id) > s.day;
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = locked ? '#d8cfc0' : '#fff';
    ctx.fill();
    ctx.strokeStyle = locked ? '#b8ab90' : '#cbb37e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r.x + 18, r.y + 20, 11, 0, Math.PI * 2);
    ctx.fillStyle = locked ? '#b8ab90' : g.color;
    ctx.fill();
    text(ctx, g.name, r.x + 34, r.y + 20, 14, locked ? '#9a8a70' : '#3b2d20', 'left', true);
    if (locked) text(ctx, `第${ingredientUnlockDay(g.id)}天`, r.x + r.w / 2, r.y + 44, 11, '#9a8a70', 'center');
    else if (ings.some((x) => x.id === g.id)) text(ctx, '可拿', r.x + r.w / 2, r.y + 44, 11, '#7a9a5a', 'center');
  }
  // ---- 工位 ----
  text(ctx, '砧板（点一下 / 空格 = 切一刀）', 384, 222, 14, '#8a6d4b', 'left', true);
  text(ctx, '平底锅（6 秒煎熟，再放 6 秒会焦）', 660, 222, 14, '#8a6d4b', 'left', true);
  text(ctx, '汤锅（9 秒煮熟，不会焦）', 936, 222, 14, '#8a6d4b', 'left', true);
  s.boards.forEach((slot, i) => {
    const r = LAYOUT.boards[i];
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#c89b6a';
    ctx.fill();
    ctx.strokeStyle = '#a67c4e';
    ctx.stroke();
    text(ctx, '砧板', r.x + 10, r.y + 16, 13, '#6b4a26', 'left', true);
    if (slot.item) {
      text(ctx, itemLabel(slot.item), r.x + 10, r.y + 40, 13, '#3b2d20', 'left', true);
      const need = chopsNeeded(s.upgrades);
      progressBar(ctx, r.x + 10, r.y + 52, 100, 8, slot.progress / need, '#58b368');
      text(ctx, `${slot.progress}/${need}刀`, r.x + r.w - 6, r.y + 40, 11, '#6b4a26', 'right');
    } else text(ctx, '空', r.x + r.w / 2, r.y + 40, 14, '#8a6d4b', 'center');
  });
  s.pans.forEach((slot, i) => {
    const r = LAYOUT.pans[i];
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#4a4a4a';
    ctx.fill();
    text(ctx, '平底锅', r.x + 10, r.y + 16, 13, '#cfcfcf', 'left', true);
    if (slot.item) {
      const frac = Math.min(1, slot.t / FRY_TIME);
      text(ctx, itemLabel(slot.item), r.x + 10, r.y + 40, 13, '#fff', 'left', true);
      progressBar(ctx, r.x + 10, r.y + 52, 100, 8, frac, slot.item.burnt ? '#e63946' : '#f2a541');
      if (slot.item.burnt) text(ctx, '焦了!', r.x + r.w - 6, r.y + 40, 11, '#ff8a8a', 'right', true);
      else if (slot.item.fried) text(ctx, '熟了!', r.x + r.w - 6, r.y + 40, 11, '#ffd23e', 'right', true);
    } else text(ctx, '空', r.x + r.w / 2, r.y + 40, 14, '#9a9a9a', 'center');
  });
  s.pots.forEach((slot, i) => {
    const r = LAYOUT.pots[i];
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#7a8a99';
    ctx.fill();
    text(ctx, '汤锅', r.x + 10, r.y + 16, 13, '#eef2f5', 'left', true);
    if (slot.item) {
      const frac = Math.min(1, slot.t / BOIL_TIME);
      text(ctx, itemLabel(slot.item), r.x + 10, r.y + 40, 13, '#fff', 'left', true);
      progressBar(ctx, r.x + 10, r.y + 52, 100, 8, frac, '#7fb069');
      if (slot.item.boiled) text(ctx, '熟了!', r.x + r.w - 6, r.y + 40, 11, '#d6ffd6', 'right', true);
    } else text(ctx, '空', r.x + r.w / 2, r.y + 40, 14, '#d6dde3', 'center');
  });
  // 垃圾桶
  rr(ctx, LAYOUT.trash.x, LAYOUT.trash.y, LAYOUT.trash.w, LAYOUT.trash.h, 10);
  ctx.fillStyle = '#8a8a8a';
  ctx.fill();
  text(ctx, '垃圾桶', LAYOUT.trash.x + 40, LAYOUT.trash.y + 60, 15, '#fff', 'center', true);
  text(ctx, '点 / 按 X', LAYOUT.trash.x + 40, LAYOUT.trash.y + 84, 11, '#eee', 'center');
  text(ctx, '丢手里的东西', LAYOUT.trash.x + 40, LAYOUT.trash.y + 104, 11, '#eee', 'center');
  // ---- 手 + 盘子 ----
  rr(ctx, LAYOUT.handBox.x, LAYOUT.handBox.y, LAYOUT.handBox.w, LAYOUT.handBox.h, 12);
  ctx.fillStyle = '#fff8ec';
  ctx.fill();
  ctx.strokeStyle = '#d9c39a';
  ctx.stroke();
  text(ctx, '手里', LAYOUT.handBox.x + 14, LAYOUT.handBox.y + 20, 14, '#8a6d4b', 'left', true);
  const hand = s.hand;
  if (!hand) text(ctx, '空', LAYOUT.handBox.x + 126, LAYOUT.handBox.y + 70, 20, '#b09a7a', 'center');
  else if (hand.kind === 'dish') {
    const d = dishById(hand.dishId);
    text(ctx, d.name, LAYOUT.handBox.x + 126, LAYOUT.handBox.y + 60, 20, '#3b2d20', 'center', true);
    text(ctx, '点客人上菜', LAYOUT.handBox.x + 126, LAYOUT.handBox.y + 92, 13, '#e4572e', 'center');
  } else {
    text(ctx, itemLabel(hand), LAYOUT.handBox.x + 126, LAYOUT.handBox.y + 60, 20, '#3b2d20', 'center', true);
    text(ctx, '点工位加工 / 点盘子装盘', LAYOUT.handBox.x + 126, LAYOUT.handBox.y + 92, 13, '#8a6d4b', 'center');
  }
  s.plates.forEach((plate, i) => {
    const r = LAYOUT.plates[i];
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#cbb37e';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, `盘子 ${i + 1}（按 ${i + 1}）`, r.x + 12, r.y + 18, 13, '#8a6d4b', 'left', true);
    if (plate.returning > 0) {
      text(ctx, '清洗中…', r.x + r.w / 2, r.y + 66, 16, '#9a8a70', 'center');
    } else if (plate.items.length === 0) {
      text(ctx, '空盘', r.x + r.w / 2, r.y + 66, 16, '#b09a7a', 'center');
    } else {
      const dish = plateDish(plate);
      let cy = r.y + 44;
      for (const it of plate.items) {
        const g = INGREDIENTS[it.ing];
        chip(ctx, r.x + 12, cy - 11, `${g.short}${derivedPrep(it) === 'cut' ? '切' : derivedPrep(it) === 'fry' ? '煎' : derivedPrep(it) === 'boil' ? '煮' : derivedPrep(it) === 'cutfry' ? '切煎' : ''}`, g.color, 52);
        cy += 26;
      }
      if (dish) text(ctx, `${dish.name} 已做好!`, r.x + r.w / 2, r.y + 108, 14, '#e4572e', 'center', true);
    }
  });
  // 飘字
  for (const f of s.floaters) {
    const seat = LAYOUT.seats[f.seat] || LAYOUT.seats[0];
    const a = Math.min(1, f.t);
    ctx.globalAlpha = a;
    text(ctx, f.text, seat.x + seat.w - 12, seat.y + 26 - (1.6 - f.t) * 24, 20, '#e4572e', 'right', true);
    ctx.globalAlpha = 1;
  }
  // 底部操作提示
  text(ctx, '操作: 点食材箱拿料 → 砧板/平底锅/汤锅加工 → 点盘子装盘 → 点客人上菜    空格切菜 | 1-4 盘子 | X 丢弃 | Esc/P 暂停 | M 静音', 24, 668, 14, '#6b4a26');
  text(ctx, `已上 ${s.servedToday} 单 · 走失 ${s.lostToday} 位 · 上错 ${s.wrongToday} 单`, 24, 694, 13, '#8a6d4b');
}

function renderTitle(ctx, s) {
  ctx.fillStyle = '#3b2d20';
  ctx.fillRect(0, 0, CANVAS_W, 90);
  text(ctx, 'SIZZLE STREET KITCHEN', 640, 46, 40, '#ffd23e', 'center', true);
  text(ctx, '街角小馆后厨', 640, 150, 44, '#3b2d20', 'center', true);
  text(ctx, '切菜、煎炸、煮面，在客人失去耐心之前把菜端上去!', 640, 192, 20, '#8a6d4b', 'center');
  text(ctx, '4 个座位 · 7 道菜 · 每日目标营业额 · 升级你的小馆', 640, 246, 17, '#8a6d4b', 'center');
  // 小馆示意：三个盘子
  const dishes = ['田园沙拉', '经典汉堡', '鸡蛋拉面'];
  dishes.forEach((name, i) => {
    const x = 390 + i * 170;
    ctx.beginPath();
    ctx.ellipse(x, 330, 70, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#cbb37e';
    ctx.stroke();
    text(ctx, name, x, 332, 16, '#3b2d20', 'center', true);
  });
  if (s.best.bestDay > 0) {
    text(ctx, `最佳纪录: 第 ${s.best.bestDay} 天 · 累计 $${s.best.bestRevenue}`, 640, 392, 17, '#5a8f4d', 'center', true);
  }
  button(ctx, LAYOUT.titleStart, '开始营业', 'Enter 也可开始');
  button(ctx, LAYOUT.titleHow, '玩法说明', '菜品 / 计分 / 升级');
  text(ctx, '纯 Canvas 绘制 · Web Audio 合成音效 · 零网络请求', 640, 620, 14, '#9a8a70', 'center');
}

function renderHowto(ctx, s) {
  text(ctx, '玩法说明', 640, 70, 34, '#3b2d20', 'center', true);
  const lines = [
    '1. 点食材箱拿料:砧板切(5 刀)、平底锅煎(6 秒熟, 再放 6 秒烧焦)、汤锅煮(9 秒, 不会焦)。',
    '2. 加工好的食材点盘子装盘, 拼成客人点的菜后点盘子端起, 再点客人上菜。',
    '3. 小费最高为菜价的 60%, 按剩余耐心算; 连击每单 +0.1, 最高 x2.0; 今日特价菜 x1.5。',
    '4. 上错菜: 连击清零, 客人耐心 -4 秒; 客人超时离开: 连击清零, -1 颗心; 每连上 5 单回 1 颗心。',
    '5. VIP(第 3 天起)付 1.5 倍、耐心只有 80%; 美食评论家(第 4 天起)离开扣 2 颗心,',
    '   在耐心剩一半以上时上菜另奖 $20 并回 1 颗心。',
    '6. 每日目标 = 80 + 55d + 5d²(d=天数-1):$80、$140、$210、$290……达标进商店, 不达标关店。',
    '7. 菜品随天数解锁: 沙拉/汉堡(第 1 天)、拉面(第 2 天)、炸鱼薯条(第 3 天)、',
    '   芝士汉堡(第 4 天)、鲜虾饭(第 5 天)、大早餐(第 6 天)。土豆要先切后煎。',
    '8. 操作: 鼠标点工位; 空格切菜; 1-4 盘子; X 丢弃; Esc/P 暂停; M 静音; Enter 确认。',
  ];
  lines.forEach((ln, i) => text(ctx, ln, 90, 130 + i * 42, 17, '#3b2d20'));
  button(ctx, LAYOUT.howBack, '返回标题', '');
}

function renderPaused(ctx, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  text(ctx, '已暂停', 640, 220, 44, '#fff', 'center', true);
  text(ctx, `第 ${s.day} 天 · 营业额 $${s.revenue.toFixed(0)} / $${s.target}`, 640, 272, 18, '#ffd98a', 'center');
  button(ctx, LAYOUT.pauseResume, '继续营业', 'Esc / P 也可继续');
  button(ctx, LAYOUT.pauseQuit, '回到标题', '');
}

function renderDayEnd(ctx, s) {
  const r = s.dayResult;
  text(ctx, `第 ${r.day} 天打烊`, 640, 80, 36, '#3b2d20', 'center', true);
  text(ctx, `营业额 $${r.revenue.toFixed(0)}  /  目标 $${r.target}`, 640, 140, 24, '#3b2d20', 'center', true);
  for (let i = 0; i < 3; i++) star(ctx, 560 + i * 80, 210, 30, i < r.stars ? '#f2c230' : '#d8cfc0');
  text(ctx, r.stars === 3 ? '满分!小馆火爆全街!' : r.stars === 2 ? '干得漂亮!' : '达标!继续加油!', 640, 280, 20, '#5a8f4d', 'center', true);
  text(ctx, `上菜 ${r.served} 单 · 客人走失 ${r.lost} 位 · 金币 $${s.coins}`, 640, 330, 18, '#3b2d20', 'center');
  text(ctx, '金币可以留到商店里升级装备', 640, 366, 16, '#8a6d4b', 'center');
  button(ctx, LAYOUT.dayNext, '去升级商店', 'Enter 继续');
}

function renderShop(ctx, s) {
  text(ctx, `升级商店 — 第 ${s.day} 天结束`, 40, 60, 30, '#3b2d20', 'left', true);
  text(ctx, `金币: $${s.coins}`, 40, 100, 22, '#e4572e', 'left', true);
  text(ctx, `声誉: ${s.hearts} / 5 颗心`, 300, 100, 20, '#e63946', 'left', true);
  UPGRADES.forEach((u, i) => {
    const r = shopItemRect(i);
    const level = s.upgrades[u.id] || 0;
    const price = upgradePrice(u, level);
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = '#fff8ec';
    ctx.fill();
    ctx.strokeStyle = '#d9c39a';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, u.name, r.x + 16, r.y + 24, 20, '#3b2d20', 'left', true);
    text(ctx, u.desc, r.x + 16, r.y + 54, 14, '#8a6d4b', 'left');
    const levelText = u.id === 'meal' ? '可重复' : `Lv ${level}/${u.max}`;
    text(ctx, levelText, r.x + r.w - 150, r.y + 24, 15, '#5a8f4d', 'left', true);
    if (price === null) text(ctx, '已满级', r.x + r.w - 150, r.y + 54, 15, '#9a8a70', 'left', true);
    else text(ctx, `$${price}`, r.x + r.w - 150, r.y + 54, 18, price <= s.coins ? '#e4572e' : '#b09a7a', 'left', true);
  });
  button(ctx, LAYOUT.shopNext, '开始下一天', `第 ${s.day + 1} 天`);
  text(ctx, '点一项购买;买完点右下角开始下一天', 40, 668, 14, '#8a6d4b');
}

function renderGameOver(ctx, s) {
  text(ctx, '关店结算', 640, 80, 36, '#3b2d20', 'center', true);
  text(ctx, s.overReason || '小馆打烊了', 640, 140, 20, '#e63946', 'center');
  text(ctx, `坚持到第 ${s.day} 天 · 累计营业额 $${s.stats.earned} · 共上菜 ${s.stats.served} 单`, 640, 200, 20, '#3b2d20', 'center');
  if (s.newBest) text(ctx, 'NEW BEST 新纪录!', 640, 260, 28, '#e4572e', 'center', true);
  else if (s.best.bestDay > 0) text(ctx, `最佳纪录: 第 ${s.best.bestDay} 天 · 累计 $${s.best.bestRevenue}`, 640, 260, 18, '#5a8f4d', 'center');
  text(ctx, '明天再来, 小馆会更好。', 640, 320, 17, '#8a6d4b', 'center');
  button(ctx, LAYOUT.overRetry, '再来一局', 'Enter');
  button(ctx, LAYOUT.overTitle, '回到标题', '');
}
