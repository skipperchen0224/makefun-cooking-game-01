// Sizzle Street Kitchen — 纯游戏逻辑（无 DOM、无音频、可在 Node 里跑）。
// 确定性：所有随机都走种子 RNG；tick 只依赖 dt。
import {
  INGREDIENTS, DISHES, dishById, unlockedDishes, unlockedIngredients,
  dayLength, dayTarget, customerPatience, spawnInterval, starsFor,
  FRY_TIME, BOIL_TIME, chopsNeeded, cookSpeedMul, patienceMul, burnWindow,
  MAX_HEARTS, MAX_COMBO, PLATE_RETURN_TIME, LAYOUT, BIN_ORDER, inRect,
  shopItemRect, upgradeById, upgradePrice,
} from './data.js';
import { mulberry32, fnv1a } from './rng.js';

export function derivedPrep(item) {
  if (!item || item.kind !== 'item') return null;
  if (item.boiled) return 'boil';
  if (item.chopped && item.fried) return 'cutfry';
  if (item.chopped) return 'cut';
  if (item.fried) return 'fry';
  return 'none';
}

// 某食材经过某种加工后，是否出现在任一已解锁菜品里
export function prepPossible(ing, prep, day) {
  return unlockedDishes(day).some((d) => d.components.some((c) => c.ing === ing && c.prep === prep));
}

export function createGame(seed = 20261125, best = null) {
  const rng = mulberry32(seed);
  const state = {
    seed,
    phase: 'title', // title | howto | playing | paused | dayend | shop | gameover
    day: 1,
    coins: 0,
    hearts: MAX_HEARTS,
    combo: 1,
    comboStreak: 0,
    servedToday: 0,
    servedTotal: 0,
    lostToday: 0,
    wrongToday: 0,
    revenue: 0,
    target: dayTarget(1),
    dayLength: dayLength(1),
    elapsed: 0,
    customers: [],
    boards: [],
    pans: [],
    pots: [],
    plates: [],
    hand: null,
    spawnIn: 2,
    nextId: 1,
    specialDishId: null,
    upgrades: { knife: 0, stove: 0, board: 0, pan: 0, pot: 0, plate: 0, seats: 0, tipjar: 0, timer: 0, meal: 0 },
    stats: { served: 0, lost: 0, wrong: 0, earned: 0 },
    floaters: [],
    log: [],
    dayResult: null,
    overReason: '',
    newBest: false,
    muted: false,
    frozen: false,
    best: best || { bestDay: 0, bestRevenue: 0, bestStars: 0 },
    _rng: rng,
  };
  return state;
}

function boardCount(s) { return 2 + (s.upgrades.board || 0); }
function panCount(s) { return 2 + (s.upgrades.pan || 0); }
function potCount(s) { return 2 + (s.upgrades.pot || 0); }
function plateCount(s) { return 3 + (s.upgrades.plate || 0); }
function emptyStations(n) {
  return Array.from({ length: n }, () => ({ item: null, progress: 0, t: 0 }));
}

export function newDay(s) {
  s.revenue = 0;
  s.target = dayTarget(s.day);
  s.dayLength = dayLength(s.day);
  s.elapsed = 0;
  s.customers = [];
  s.boards = emptyStations(boardCount(s));
  s.pans = emptyStations(panCount(s));
  s.pots = emptyStations(potCount(s));
  s.plates = Array.from({ length: plateCount(s) }, () => ({ items: [], returning: 0 }));
  s.hand = null;
  s.spawnIn = 2;
  s.servedToday = 0;
  s.lostToday = 0;
  s.wrongToday = 0;
  s.combo = 1;
  s.comboStreak = 0;
  s.floaters = [];
  s.dayResult = null;
  const dishes = unlockedDishes(s.day);
  s.specialDishId = dishes[Math.floor(s._rng() * dishes.length)].id;
  s.log.push(`day ${s.day} start target $${s.target} special ${s.specialDishId}`);
}

export function startGame(s) {
  s.day = 1;
  s.coins = 0;
  s.hearts = MAX_HEARTS;
  s.upgrades = { knife: 0, stove: 0, board: 0, pan: 0, pot: 0, plate: 0, seats: 0, tipjar: 0, timer: 0, meal: 0 };
  s.stats = { served: 0, lost: 0, wrong: 0, earned: 0 };
  s.servedTotal = 0;
  s.newBest = false;
  s.overReason = '';
  newDay(s);
  s.phase = 'playing';
}

function spawnCustomer(s) {
  const freeSeat = [0, 1, 2, 3].find((i) => !s.customers.some((c) => c.seat === i));
  if (freeSeat === undefined) return;
  const dishes = unlockedDishes(s.day);
  const dish = dishes[Math.floor(s._rng() * dishes.length)];
  let vip = false;
  let critic = false;
  const roll = s._rng();
  if (s.day >= 4 && roll < 0.08) critic = true;
  else if (s.day >= 3 && roll < 0.23) vip = true;
  const max = customerPatience(s.day, dish) * patienceMul(s.upgrades) * (vip ? 0.8 : 1);
  s.customers.push({
    id: s.nextId++, seat: freeSeat, dishId: dish.id,
    patience: max, patienceMax: max, vip, critic,
  });
}

function endDay(s) {
  const stars = starsFor(s.revenue, s.target);
  s.dayResult = { day: s.day, revenue: s.revenue, target: s.target, stars, served: s.servedToday, lost: s.lostToday };
  s.coins += Math.round(s.revenue);
  s.stats.earned += Math.round(s.revenue);
  s.log.push(`day ${s.day} end revenue $${s.revenue.toFixed(2)} target $${s.target} stars ${stars}`);
  if (stars === 0) {
    s.overReason = `第 ${s.day} 天营业额 $${Math.round(s.revenue)}，未达到目标 $${s.target}`;
    s.phase = 'gameover';
    finishGame(s);
  } else {
    s.phase = 'dayend';
  }
}

function finishGame(s) {
  const best = s.best;
  if (s.day > best.bestDay || (s.day === best.bestDay && s.stats.earned > best.bestRevenue)) {
    s.newBest = true;
    best.bestDay = Math.max(best.bestDay, s.day);
    best.bestRevenue = Math.max(best.bestRevenue, s.stats.earned);
  }
  s.log.push(`game over: ${s.overReason} newBest=${s.newBest}`);
}

export function tick(s, dt) {
  if (s.phase !== 'playing' || s.frozen || dt <= 0) return;
  s.elapsed += dt;
  const rush = s.elapsed / s.dayLength >= 0.42 && s.elapsed / s.dayLength <= 0.62;
  // 烹饪进度
  const speed = cookSpeedMul(s.upgrades);
  for (const pan of s.pans) {
    if (!pan.item) continue;
    pan.t += dt * speed;
    if (!pan.item.fried && pan.t >= FRY_TIME) { pan.item.fried = true; }
    if (pan.t >= FRY_TIME + burnWindow(s.upgrades)) pan.item.burnt = true;
  }
  for (const pot of s.pots) {
    if (!pot.item) continue;
    pot.t += dt * speed;
    if (!pot.item.boiled && pot.t >= BOIL_TIME) pot.item.boiled = true;
  }
  // 盘子归还
  for (const p of s.plates) {
    if (p.returning > 0) { p.returning -= dt; if (p.returning <= 0) { p.returning = 0; p.items = []; } }
  }
  // 飘字
  for (const f of s.floaters) f.t -= dt;
  s.floaters = s.floaters.filter((f) => f.t > 0);
  // 客人耐心
  for (const c of [...s.customers]) {
    c.patience -= dt;
    if (c.patience <= 0) {
      s.customers = s.customers.filter((x) => x !== c);
      s.combo = 1;
      s.comboStreak = 0;
      s.lostToday++;
      s.stats.lost++;
      s.hearts -= c.critic ? 2 : 1;
      s.log.push(`t=${s.elapsed.toFixed(1)} customer ${c.id} left (${c.critic ? 'critic -2' : '-1'} heart)`);
      if (s.hearts <= 0) {
        s.hearts = 0;
        s.overReason = `第 ${s.day} 天声誉归零（客人走光了）`;
        s.phase = 'gameover';
        finishGame(s);
        return;
      }
    }
  }
  // 生成客人
  if (s.elapsed < s.dayLength) {
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      spawnCustomer(s);
      const base = spawnInterval(s.day) * (rush ? 0.6 : 1);
      s.spawnIn = base * (0.9 + 0.2 * s._rng());
    }
  }
  // 日结：时间到且座位空了
  if (s.elapsed >= s.dayLength && s.customers.length === 0) endDay(s);
}

// ---- 盘子与菜品匹配 ----
export function plateDish(plate) {
  if (!plate || plate.items.length === 0) return null;
  const key = plate.items.map((it) => `${it.ing}:${derivedPrep(it)}`).sort().join('|');
  return DISHES.find((d) => d.components.map((c) => `${c.ing}:${c.prep}`).sort().join('|') === key) || null;
}
function plateNeeds(plate, dish, extraItem) {
  const have = plate.items.map((it) => `${it.ing}:${derivedPrep(it)}`);
  const need = dish.components.map((c) => `${c.ing}:${c.prep}`);
  const all = [...have, `${extraItem.ing}:${derivedPrep(extraItem)}`];
  const pool = [...need];
  for (const k of all) {
    const i = pool.indexOf(k);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}
export function itemPlaceableOnPlate(s, plate, item) {
  if (!item || item.kind !== 'item' || item.burnt) return false;
  if (plate.returning > 0) return false;
  if (plate.items.length >= 4) return false;
  const prep = derivedPrep(item);
  return unlockedDishes(s.day).some((d) => plateNeeds(plate, d, item) && d.components.some((c) => c.ing === item.ing && c.prep === prep));
}

function serveCustomer(s, customer) {
  const dish = dishById(customer.dishId);
  const hand = s.hand;
  const isSpecial = customer.dishId === s.specialDishId;
  let amount = dish.price;
  let tip = dish.price * 0.6 * Math.max(0, customer.patience / customer.patienceMax);
  if (s.upgrades.tipjar) tip *= 1.3;
  if (customer.vip) amount *= 1.5;
  let total = (amount + tip) * s.combo;
  if (isSpecial) total *= 1.5;
  let bonus = 0;
  if (customer.critic && customer.patience > customer.patienceMax * 0.5) {
    bonus = 20;
    total += bonus;
    s.hearts = Math.min(MAX_HEARTS, s.hearts + 1);
  }
  total = Math.round(total * 100) / 100;
  s.revenue += total;
  s.servedToday++;
  s.servedTotal++;
  s.stats.served++;
  s.comboStreak++;
  if (s.comboStreak % 5 === 0) s.hearts = Math.min(MAX_HEARTS, s.hearts + 1);
  s.combo = Math.min(MAX_COMBO, Math.round((s.combo + 0.1) * 10) / 10);
  s.customers = s.customers.filter((c) => c !== customer);
  // 盘子 1.5 秒后归还（找到刚才那只盛菜的盘子：用 hand 上的 plateIdx）
  const pi = hand.plateIdx;
  if (pi !== undefined && s.plates[pi]) s.plates[pi].returning = PLATE_RETURN_TIME;
  s.floaters.push({ x: 0, y: 0, text: `+$${total.toFixed(2)}`, t: 1.6, kind: 'serve', seat: customer.seat });
  s.log.push(`t=${s.elapsed.toFixed(1)} serve ${dish.id} $${total.toFixed(2)} combo x${s.combo.toFixed(1)}${customer.vip ? ' VIP' : ''}${customer.critic ? ' CRITIC' : ''}${isSpecial ? ' SPECIAL' : ''}`);
  s.hand = null;
  return total;
}

function wrongDish(s, customer) {
  s.combo = 1;
  s.comboStreak = 0;
  s.wrongToday++;
  s.stats.wrong++;
  customer.patience = Math.max(0.5, customer.patience - 4);
  const pi = s.hand && s.hand.plateIdx;
  if (pi !== undefined && s.plates[pi]) s.plates[pi].returning = PLATE_RETURN_TIME;
  s.log.push(`t=${s.elapsed.toFixed(1)} wrong dish for ${customer.dishId} patience -4s`);
  s.hand = null;
}

function chopBoard(s, slot) {
  if (!slot.item) return false;
  // 手里有东西时切满了也先留在砧板上，等手空了再取走，避免食材凭空消失
  if (slot.item.chopped) {
    if (!s.hand) { s.hand = slot.item; slot.item = null; slot.progress = 0; }
    return true;
  }
  const need = chopsNeeded(s.upgrades);
  slot.progress++;
  if (slot.progress >= need) {
    slot.item.chopped = true;
    if (!s.hand) { s.hand = slot.item; slot.item = null; slot.progress = 0; }
  }
  return true;
}

function stationClick(s, kind, idx) {
  const list = kind === 'board' ? s.boards : kind === 'pan' ? s.pans : s.pots;
  const slot = list[idx];
  if (!slot) return;
  const hand = s.hand;
  if (kind === 'board') {
    if (hand && hand.kind === 'item' && !hand.chopped && !hand.fried && !hand.boiled
      && (prepPossible(hand.ing, 'cut', s.day) || prepPossible(hand.ing, 'cutfry', s.day)) && !slot.item) {
      slot.item = hand;
      slot.progress = 0;
      s.hand = null;
      return;
    }
    if (!hand && slot.item) chopBoard(s, slot);
    return;
  }
  if (kind === 'pan') {
    if (hand && hand.kind === 'item' && !hand.fried && !hand.boiled
      && (prepPossible(hand.ing, 'fry', s.day) || (hand.chopped && prepPossible(hand.ing, 'cutfry', s.day))) && !slot.item) {
      slot.item = hand;
      slot.t = 0;
      s.hand = null;
      return;
    }
    if (!hand && slot.item) {
      s.hand = slot.item;
      slot.item = null;
      slot.t = 0;
    }
    return;
  }
  // pot
  if (hand && hand.kind === 'item' && !hand.boiled && !hand.fried && !hand.chopped
    && prepPossible(hand.ing, 'boil', s.day) && !slot.item) {
    slot.item = hand;
    slot.t = 0;
    s.hand = null;
    return;
  }
  if (!hand && slot.item) {
    s.hand = slot.item;
    slot.item = null;
    slot.t = 0;
  }
}

function plateClick(s, idx) {
  const plate = s.plates[idx];
  if (!plate || plate.returning > 0) return;
  const hand = s.hand;
  if (hand && hand.kind === 'item') {
    if (itemPlaceableOnPlate(s, plate, hand)) {
      plate.items.push(hand);
      s.hand = null;
    }
    return;
  }
  if (hand && hand.kind === 'dish') return; // 手里端着菜不能再拿盘子
  if (plate.items.length === 0) return;
  const dish = plateDish(plate);
  if (dish) {
    s.hand = { kind: 'dish', dishId: dish.id, plateIdx: idx };
    plate.items = [];
    plate.returning = 0;
  } else {
    // 未拼成的盘子：拿回最上面一样食材
    s.hand = plate.items.pop();
  }
}

function seatClick(s, idx) {
  const customer = s.customers.find((c) => c.seat === idx);
  if (!customer) return;
  const hand = s.hand;
  if (!hand || hand.kind !== 'dish') return;
  if (hand.dishId === customer.dishId) serveCustomer(s, customer);
  else wrongDish(s, customer);
}

export function clickAt(s, x, y) {
  if (s.phase === 'title') {
    if (inRect(LAYOUT.titleStart, x, y)) { startGame(s); return 'start'; }
    if (inRect(LAYOUT.titleHow, x, y)) { s.phase = 'howto'; return 'howto'; }
    return null;
  }
  if (s.phase === 'howto') {
    if (inRect(LAYOUT.howBack, x, y)) { s.phase = 'title'; return 'back'; }
    return null;
  }
  if (s.phase === 'paused') {
    if (inRect(LAYOUT.pauseResume, x, y)) { s.phase = 'playing'; return 'resume'; }
    if (inRect(LAYOUT.pauseQuit, x, y)) { s.phase = 'title'; return 'quit'; }
    return null;
  }
  if (s.phase === 'dayend') {
    if (inRect(LAYOUT.dayNext, x, y)) { s.phase = 'shop'; return 'shop'; }
    return null;
  }
  if (s.phase === 'shop') {
    for (let i = 0; i < 10; i++) {
      if (inRect(shopItemRect(i), x, y)) return buyUpgrade(s, i);
    }
    if (inRect(LAYOUT.shopNext, x, y)) {
      s.day++;
      newDay(s);
      s.phase = 'playing';
      return 'nextday';
    }
    return null;
  }
  if (s.phase === 'gameover') {
    if (inRect(LAYOUT.overRetry, x, y)) { startGame(s); return 'retry'; }
    if (inRect(LAYOUT.overTitle, x, y)) { s.phase = 'title'; return 'title'; }
    return null;
  }
  if (s.phase !== 'playing') return null;
  if (inRect(LAYOUT.pauseBtn, x, y)) { s.phase = 'paused'; return 'pause'; }
  if (inRect(LAYOUT.muteBtn, x, y)) { s.muted = !s.muted; return 'mute'; }
  // 座位（上菜）
  for (let i = 0; i < 4; i++) {
    if (inRect(LAYOUT.seats[i], x, y)) { seatClick(s, i); return 'seat'; }
  }
  // 盘子
  for (let i = 0; i < s.plates.length; i++) {
    if (inRect(LAYOUT.plates[i], x, y)) { plateClick(s, i); return 'plate'; }
  }
  // 工位
  for (let i = 0; i < s.boards.length; i++) {
    if (inRect(LAYOUT.boards[i], x, y)) { stationClick(s, 'board', i); return 'board'; }
  }
  for (let i = 0; i < s.pans.length; i++) {
    if (inRect(LAYOUT.pans[i], x, y)) { stationClick(s, 'pan', i); return 'pan'; }
  }
  for (let i = 0; i < s.pots.length; i++) {
    if (inRect(LAYOUT.pots[i], x, y)) { stationClick(s, 'pot', i); return 'pot'; }
  }
  // 垃圾桶：丢掉手里的东西
  if (inRect(LAYOUT.trash, x, y)) {
    if (s.hand) { s.hand = null; return 'trash'; }
    return null;
  }
  // 食材箱
  const ings = unlockedIngredients(s.day);
  for (let i = 0; i < ings.length; i++) {
    const gi = BIN_ORDER.indexOf(ings[i].id);
    if (gi >= 0 && inRect(LAYOUT.bins[gi], x, y)) {
      if (!s.hand) {
        s.hand = { kind: 'item', ing: ings[i].id, chopped: false, fried: false, boiled: false, burnt: false };
        return 'bin';
      }
      return null;
    }
  }
  return null;
}

export function buyUpgrade(s, i) {
  const defs = [
    'knife', 'stove', 'board', 'pan', 'pot', 'plate', 'seats', 'tipjar', 'timer', 'meal',
  ];
  const id = defs[i];
  const u = upgradeById(id);
  if (!u) return null;
  if (id === 'meal') {
    if (s.coins < 40) return 'poor';
    s.coins -= 40;
    s.hearts = MAX_HEARTS;
    s.log.push(`buy meal hearts full`);
    return 'bought';
  }
  const level = s.upgrades[id] || 0;
  const price = upgradePrice(u, level);
  if (price === null) return 'maxed';
  if (s.coins < price) return 'poor';
  s.coins -= price;
  s.upgrades[id] = level + 1;
  s.log.push(`buy ${id} lv${level + 1} $${price}`);
  return 'bought';
}

export function keyPress(s, key) {
  if (key === 'm' || key === 'M') { s.muted = !s.muted; return 'mute'; }
  if (key === 'Escape' || key === 'p' || key === 'P') {
    if (s.phase === 'playing') { s.phase = 'paused'; return 'pause'; }
    if (s.phase === 'paused') { s.phase = 'playing'; return 'resume'; }
    return null;
  }
  if (key === 'Enter') {
    if (s.phase === 'title') { startGame(s); return 'start'; }
    if (s.phase === 'howto') { startGame(s); return 'start'; }
    if (s.phase === 'dayend') { s.phase = 'shop'; return 'shop'; }
    if (s.phase === 'shop') { s.day++; newDay(s); s.phase = 'playing'; return 'nextday'; }
    if (s.phase === 'gameover') { startGame(s); return 'retry'; }
    return null;
  }
  if (s.phase !== 'playing') return null;
  if (key === ' ' || key === 'Spacebar') {
    for (const slot of s.boards) {
      if (slot.item && !slot.item.chopped) { chopBoard(s, slot); return 'chop'; }
    }
    return null;
  }
  if (key === 'x' || key === 'X') {
    if (s.hand) { s.hand = null; return 'discard'; }
    return null;
  }
  const plateIdx = ['1', '2', '3', '4'].indexOf(key);
  if (plateIdx >= 0) { plateClick(s, plateIdx); return 'plate'; }
  return null;
}

// ---- 摘要 / 快照（供无头模拟与测试）----
export function summary(s) {
  return {
    seed: s.seed, day: s.day, phase: s.phase,
    revenue: Math.round(s.revenue * 100) / 100,
    target: s.target, served: s.servedToday, servedTotal: s.servedTotal,
    lost: s.stats.lost, wrong: s.stats.wrong, hearts: s.hearts,
    combo: s.combo, coins: s.coins, elapsed: Math.round(s.elapsed * 10) / 10,
    logLines: s.log.length,
  };
}
export function summaryHash(s) {
  return fnv1a(JSON.stringify(summary(s)) + '|' + s.log.join('\n'));
}
export function snapshot(s) {
  return {
    phase: s.phase, day: s.day, coins: s.coins, hearts: s.hearts,
    combo: s.combo, revenue: Math.round(s.revenue * 100) / 100, target: s.target,
    elapsed: Math.round(s.elapsed * 10) / 10, dayLength: s.dayLength,
    specialDishId: s.specialDishId, servedToday: s.servedToday,
    hand: s.hand ? { ...s.hand } : null,
    customers: s.customers.map((c) => ({ ...c })),
    boards: s.boards.map((b) => ({ item: b.item ? { ...b.item } : null, progress: b.progress, need: b.item ? chopsNeeded(s.upgrades) : 0 })),
    pans: s.pans.map((p) => ({ item: p.item ? { ...p.item } : null, t: Math.round(p.t * 10) / 10 })),
    pots: s.pots.map((p) => ({ item: p.item ? { ...p.item } : null, t: Math.round(p.t * 10) / 10 })),
    plates: s.plates.map((p) => ({ items: p.items.map((it) => ({ ...it })), returning: Math.round(p.returning * 10) / 10, dish: plateDish(p)?.id || null })),
    dayResult: s.dayResult, overReason: s.overReason, newBest: s.newBest,
    muted: s.muted, upgrades: { ...s.upgrades },
  };
}
export { INGREDIENTS, DISHES };
