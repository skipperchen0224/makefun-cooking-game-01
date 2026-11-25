// 自动玩家：只读游戏状态，返回下一步操作（点击坐标或按键）。
// 无头模拟（tools/headless.mjs）和浏览器实测（tools/verify.mjs）共用同一决策，
// 因此模拟成绩与真实点击成绩来自同一策略。
import { LAYOUT, BIN_ORDER, dishById } from './data.js';
import { derivedPrep, plateDish, itemPlaceableOnPlate, prepPossible } from './logic.js';

function oldestCustomer(s) {
  let best = null;
  for (const c of s.customers) {
    if (!best || c.patience < best.patience) best = c;
  }
  return best;
}

// 工位上这件食材最终会变成哪种加工方式（用于判断它能顶掉订单里哪一项）
function eventualPrep(item, where) {
  if (item.boiled) return 'boil';
  if (where === 'pot') return 'boil';
  if (where === 'pan') return item.chopped ? 'cutfry' : 'fry';
  if (where === 'board') return 'cut'; // 切完后还可能再煎，规划时按 cut 估算
  if (item.chopped) return 'cut';
  if (item.fried) return 'fry';
  return 'none';
}

function stationItems(s) {
  const out = [];
  s.boards.forEach((b, i) => b.item && out.push({ item: b.item, where: 'board', index: i }));
  s.pans.forEach((p, i) => p.item && out.push({ item: p.item, where: 'pan', index: i }));
  s.pots.forEach((p, i) => p.item && out.push({ item: p.item, where: 'pot', index: i }));
  return out;
}

// 某道菜还缺哪些配料：只认「正拼这道菜的盘子」和「能变成这道菜配料的在制品」
// （别家菜盘子里的料不算，避免占着茅坑等死）
function missingComponents(s, dish) {
  const need = dish.components.map((c) => `${c.ing}:${c.prep}`);
  const used = [];
  for (const p of s.plates) {
    if (p.returning > 0 || p.items.length === 0) continue;
    const keys = p.items.map((it) => `${it.ing}:${derivedPrep(it)}`);
    const pool = [...need];
    let ok = true;
    for (const k of keys) {
      const i = pool.indexOf(k);
      if (i < 0) { ok = false; break; }
      pool.splice(i, 1);
    }
    if (ok) used.push(...keys);
  }
  for (const { item, where } of stationItems(s)) {
    // 砧板上的料切完还可能再煎：cut 与 cutfry 两种可能都算上
    // （missing 循环只认 need 里有的，多算的会被忽略）
    const keys = where === 'board'
      ? [`${item.ing}:cut`, `${item.ing}:cutfry`]
      : [`${item.ing}:${eventualPrep(item, where)}`];
    for (const k of keys) if (need.includes(k)) used.push(k);
  }
  // 注意：手里的食材不算「已备好」——它正是要被放上盘子的那一份，
  // 算进去会导致 wantedByWaiting 误判没人要它而丢掉。
  const missing = [];
  for (const k of need) {
    const i = used.indexOf(k);
    if (i >= 0) used.splice(i, 1);
    else missing.push(k);
  }
  return missing;
}

// 手里这件配料，有没有正在等的客人需要它（扣掉已在盘/在做的）
function wantedByWaiting(s, item) {
  const k = `${item.ing}:${derivedPrep(item)}`;
  for (const c of s.customers) {
    const dish = dishById(c.dishId);
    if (!dish.components.some((cp) => `${cp.ing}:${cp.prep}` === k)) continue;
    const missing = missingComponents(s, dish);
    if (missing.includes(k)) return true;
  }
  return false;
}

function plateForItem(s, item) {
  if (!wantedByWaiting(s, item)) return -1;
  // 优先：已有部分配料、且正拼同一道菜的盘子；其次空盘
  for (let i = 0; i < s.plates.length; i++) {
    const p = s.plates[i];
    if (p.returning > 0 || p.items.length === 0) continue;
    if (itemPlaceableOnPlate(s, p, item)) return i;
  }
  for (let i = 0; i < s.plates.length; i++) {
    const p = s.plates[i];
    if (p.returning > 0 || p.items.length > 0) continue;
    if (itemPlaceableOnPlate(s, p, item)) return i;
  }
  return -1;
}

export function decide(s) {
  if (s.phase !== 'playing') return null;
  const hand = s.hand;

  // 手里是焦掉的东西 → 丢掉
  if (hand && hand.kind === 'item' && hand.burnt) return { kind: 'key', key: 'x' };

  // 手里端着菜 → 上给最急的、点这道菜的客人
  if (hand && hand.kind === 'dish') {
    const c = s.customers
      .filter((x) => x.dishId === hand.dishId)
      .sort((a, b) => a.patience - b.patience)[0];
    if (c) {
      const r = LAYOUT.seats[c.seat];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    return { kind: 'key', key: 'x' }; // 点菜的客人走了，这盘菜没用了
  }

  // 手里有加工好的食材 → 装盘
  if (hand && hand.kind === 'item') {
    const pi = plateForItem(s, hand);
    if (pi >= 0) {
      const r = LAYOUT.plates[pi];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    // 没盘子能接：还能继续加工（生的、或切好待煎的）就送去工位；
    // 既加工完又没人要，才丢掉
    const routed = routeToStation(s, hand);
    if (routed) return routed;
    return { kind: 'key', key: 'x' };
  }

  // 手空：先抢救快焦的煎锅
  for (let i = 0; i < s.pans.length; i++) {
    const p = s.pans[i];
    if (p.item && (p.item.fried || p.item.burnt)) {
      const r = LAYOUT.pans[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  // 汤锅熟了 → 取走
  for (let i = 0; i < s.pots.length; i++) {
    const p = s.pots[i];
    if (p.item && p.item.boiled) {
      const r = LAYOUT.pots[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  // 砧板切好了 → 取走
  for (let i = 0; i < s.boards.length; i++) {
    const b = s.boards[i];
    if (b.item && b.item.chopped) {
      const r = LAYOUT.boards[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  // 有菜在切 → 切一刀
  for (const b of s.boards) {
    if (b.item && !b.item.chopped) return { kind: 'key', key: ' ' };
  }
  // 有拼好的菜 → 端起
  for (let i = 0; i < s.plates.length; i++) {
    const p = s.plates[i];
    if (p.returning > 0 || p.items.length === 0) continue;
    if (plateDish(p)) {
      const r = LAYOUT.plates[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  // 规划：按耐心从低到高，给第一个还有缺料的客人补配料；
  // 最急那单的料都在做了，就顺手给下一单备料，别干等。
  // 同一道菜里先下最耗时的料（煮 9s > 煎 6s > 切煎 > 切 > 直接用），并行度更高。
  const PREP_RANK = { boil: 0, fry: 1, cutfry: 2, cut: 3, none: 4 };
  const waiting = [...s.customers].sort((a, b) => a.patience - b.patience);
  for (const cust of waiting) {
    const dish = dishById(cust.dishId);
    const missing = missingComponents(s, dish);
    if (missing.length === 0) continue;
    missing.sort((a, b) => PREP_RANK[a.split(':')[1]] - PREP_RANK[b.split(':')[1]]);
    const [ing] = missing[0].split(':');
    const gi = BIN_ORDER.indexOf(ing);
    if (gi < 0) continue;
    const r = LAYOUT.bins[gi];
    return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  return { kind: 'wait' };
}

// 手里有生料时，送去对应的工位；没空位时先切菜腾地方。
// 返回 null 表示这件料已经没法再加工（成品或死路）；返回 wait 表示能加工但暂无空位。
function routeToStation(s, hand) {
  const ing = hand.ing;
  const needCut = !hand.chopped && !hand.fried && !hand.boiled
    && (prepPossible(ing, 'cut', s.day) || prepPossible(ing, 'cutfry', s.day));
  const needFry = !hand.fried && !hand.boiled
    && ((hand.chopped && prepPossible(ing, 'cutfry', s.day)) || prepPossible(ing, 'fry', s.day));
  const needBoil = !hand.boiled && !hand.fried && !hand.chopped && prepPossible(ing, 'boil', s.day);
  if (!needCut && !needFry && !needBoil) return null;
  // 死锁自救：要进的工位全被「已做好/已焦、等取走」的东西占着，
  // 手又是满的 → 先丢掉手里的料，腾出手来清工位。
  const blocked = (list, done) => {
    const busy = list.filter((s) => s.item);
    return busy.length > 0 && busy.length === list.length && busy.every((s) => done(s.item));
  };
  if (needCut && !s.boards.some((b) => !b.item) && blocked(s.boards, (it) => it.chopped)) return { kind: 'key', key: 'x' };
  if (needFry && !s.pans.some((p) => !p.item) && blocked(s.pans, (it) => it.fried || it.burnt)) return { kind: 'key', key: 'x' };
  if (needBoil && !s.pots.some((p) => !p.item) && blocked(s.pots, (it) => it.boiled)) return { kind: 'key', key: 'x' };
  if (needCut) {
    const i = s.boards.findIndex((b) => !b.item);
    if (i >= 0) {
      const r = LAYOUT.boards[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  if (needFry) {
    const i = s.pans.findIndex((p) => !p.item);
    if (i >= 0) {
      const r = LAYOUT.pans[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  if (needBoil) {
    const i = s.pots.findIndex((p) => !p.item);
    if (i >= 0) {
      const r = LAYOUT.pots[i];
      return { kind: 'click', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  // 没空位：有菜在切就先切
  for (const b of s.boards) {
    if (b.item && !b.item.chopped) return { kind: 'key', key: ' ' };
  }
  return { kind: 'wait' };
}
