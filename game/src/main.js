// Sizzle Street Kitchen — 浏览器入口：主循环、输入、音效、截图定妆模式。
import { createGame, startGame, tick, clickAt, keyPress, snapshot, summary } from './logic.js';
import { render } from './render.js';
import { SoundBank } from './audio.js';
import { dishById, LAYOUT } from './data.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '20261125');
const speed = Number(params.get('speed') || '1');
const shot = params.get('shot') || '';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sounds = new SoundBank();

// 最佳成绩（localStorage）
let best = { bestDay: 0, bestRevenue: 0, bestStars: 0 };
try {
  const raw = localStorage.getItem('sizzle-street-best');
  if (raw) best = { ...best, ...JSON.parse(raw) };
} catch { /* 无痕模式等情况忽略 */ }

const state = createGame(seed, best);
state.speed = speed;

function saveBest() {
  try {
    localStorage.setItem('sizzle-street-best', JSON.stringify(state.best));
  } catch { /* 忽略 */ }
}

// ---- 截图定妆：固定局面、冻结时钟，两次生成逐字节一致 ----
function stageShot(mode) {
  state.frozen = true;
  if (mode === 'start') {
    state.phase = 'title';
  } else if (mode === 'rush') {
    // 第 4 天午市高峰：4 位客人（含 VIP 与评论家），煎锅汤锅全开
    startGame(state);
    state.day = 4;
    state.target = 290;
    state.dayLength = 140;
    state.elapsed = 55;
    state.revenue = 186.4;
    state.servedToday = 6;
    state.combo = 1.4;
    state.hearts = 4;
    state.phase = 'playing';
    state.customers = [
      { id: 1, seat: 0, dishId: 'cheeseburger', patience: 22, patienceMax: 62, vip: false, critic: false },
      { id: 2, seat: 1, dishId: 'fishchips', patience: 31, patienceMax: 55, vip: true, critic: false },
      { id: 3, seat: 2, dishId: 'ramen', patience: 18, patienceMax: 48, vip: false, critic: true },
      { id: 4, seat: 3, dishId: 'burger', patience: 40, patienceMax: 55, vip: false, critic: false },
    ];
    state.boards = [
      { item: { kind: 'item', ing: 'lettuce', chopped: false, fried: false, boiled: false, burnt: false }, progress: 3, t: 0 },
      { item: { kind: 'item', ing: 'tomato', chopped: false, fried: false, boiled: false, burnt: false }, progress: 1, t: 0 },
    ];
    state.pans = [
      { item: { kind: 'item', ing: 'patty', chopped: false, fried: false, boiled: false, burnt: false }, progress: 0, t: 4.2 },
      { item: { kind: 'item', ing: 'fish', chopped: false, fried: true, boiled: false, burnt: false }, progress: 0, t: 6.0 },
    ];
    state.pots = [
      { item: { kind: 'item', ing: 'noodle', chopped: false, fried: false, boiled: false, burnt: false }, progress: 0, t: 6.5 },
      { item: { kind: 'item', ing: 'egg', chopped: false, fried: false, boiled: true, burnt: false }, progress: 0, t: 9.0 },
    ];
    state.plates = [
      { items: [{ kind: 'item', ing: 'bread', chopped: false, fried: false, boiled: false, burnt: false }], returning: 0 },
      { items: [{ kind: 'item', ing: 'lettuce', chopped: true, fried: false, boiled: false, burnt: false }], returning: 0 },
      { items: [], returning: 0 },
    ];
    state.specialDishId = 'cheeseburger';
    state.floaters = [];
  } else if (mode === 'serve') {
    // 上菜结算瞬间：第 1 天，刚上一单，飘字 +$25.60
    startGame(state);
    state.day = 1;
    state.elapsed = 38;
    state.revenue = 25.6;
    state.combo = 1.1;
    state.servedToday = 1;
    state.phase = 'playing';
    state.customers = [
      { id: 1, seat: 0, dishId: 'salad', patience: 41, patienceMax: 62, vip: false, critic: false },
      { id: 2, seat: 1, dishId: 'burger', patience: 52, patienceMax: 62, vip: false, critic: false },
    ];
    state.boards = [{ item: null, progress: 0, t: 0 }, { item: null, progress: 0, t: 0 }];
    state.pans = [{ item: null, progress: 0, t: 0 }, { item: null, progress: 0, t: 0 }];
    state.pots = [{ item: null, progress: 0, t: 0 }, { item: null, progress: 0, t: 0 }];
    state.plates = [
      { items: [], returning: 1.5 },
      { items: [], returning: 0 },
      { items: [], returning: 0 },
    ];
    state.specialDishId = 'salad';
    state.floaters = [{ x: 0, y: 0, text: '+$25.60', t: 1.6, kind: 'serve', seat: 0 }];
  } else if (mode === 'shop') {
    // 第 3 天日结 + 商店：2 星，已买利刀 1 级
    startGame(state);
    state.day = 3;
    state.coins = 210;
    state.hearts = 4;
    state.upgrades.knife = 1;
    state.dayResult = { day: 3, revenue: 316, target: 210, stars: 2, served: 11, lost: 1 };
    state.phase = 'shop';
  }
}

if (shot) stageShot(shot);

// ---- 输入 ----
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * 1280,
    y: ((ev.clientY - r.top) / r.height) * 720,
  };
}
canvas.addEventListener('mousedown', (ev) => {
  sounds.resume();
  sounds.startMusic();
  const p = canvasPos(ev);
  const before = state.phase;
  const res = clickAt(state, p.x, p.y);
  if (res === 'mute') sounds.setMuted(state.muted);
  else if (res) sounds.click();
  if (before === 'gameover' && state.phase === 'playing') saveBest();
  if (state.phase === 'playing' && before !== 'playing') saveBest();
});
window.addEventListener('keydown', (ev) => {
  if ([' ', 'ArrowUp', 'ArrowDown'].includes(ev.key)) ev.preventDefault();
  sounds.resume();
  const res = keyPress(state, ev.key);
  if (res === 'mute') sounds.setMuted(state.muted);
  else if (res === 'chop') sounds.chop();
  else if (res) sounds.click();
});

// 音效钩子：主循环里按状态变化补音（简单起见，只在关键帧播）
let lastServed = 0;
let lastLost = 0;

// ---- 主循环 ----
let lastT = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (!state.frozen) {
    tick(state, dt * (state.speed || 1));
    if (state.stats.served !== lastServed) { sounds.serve(); lastServed = state.stats.served; }
    if (state.stats.lost !== lastLost) { sounds.leave(); lastLost = state.stats.lost; }
    if (state.phase === 'gameover') saveBest();
  }
  render(ctx, state);
  frames++;
  if (frames === 3 && shot) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- 供测试与调试的只读接口 ----
window.__game = {
  snapshot: () => snapshot(state),
  summary: () => summary(state),
  click: (x, y) => clickAt(state, x, y),
  key: (k) => keyPress(state, k),
  layout: LAYOUT,
  dishById,
  state,
};
window.__shotReady = shot ? false : true;
