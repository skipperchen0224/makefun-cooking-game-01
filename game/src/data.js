// Sizzle Street Kitchen — 数据配置：菜品、食材、升级、数值公式、布局。
// 全部数值来自规格；与任何外部实现无关，由本会话手写。

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// ---- 食材（11 种食材箱）----
export const INGREDIENTS = {
  lettuce: { id: 'lettuce', name: '生菜', short: '菜', color: '#58b368' },
  tomato: { id: 'tomato', name: '番茄', short: '茄', color: '#e4572e' },
  bread: { id: 'bread', name: '面包', short: '包', color: '#e8b25a' },
  patty: { id: 'patty', name: '肉饼', short: '肉', color: '#8a5a3b' },
  cheese: { id: 'cheese', name: '芝士', short: '芝', color: '#f2c230' },
  noodle: { id: 'noodle', name: '面条', short: '面', color: '#f0d98c' },
  egg: { id: 'egg', name: '鸡蛋', short: '蛋', color: '#f6ead2' },
  fish: { id: 'fish', name: '炸鱼', short: '鱼', color: '#e8a87c' },
  potato: { id: 'potato', name: '土豆', short: '薯', color: '#d9a05b' },
  shrimp: { id: 'shrimp', name: '鲜虾', short: '虾', color: '#f28c8c' },
  rice: { id: 'rice', name: '米饭', short: '饭', color: '#f5f0e1' },
};

// prep: cut 切 / fry 煎 / boil 煮 / cutfry 先切后煎 / none 直接用
// ---- 菜品（7 道）----
export const DISHES = [
  {
    id: 'salad', name: '田园沙拉', price: 14, unlockDay: 1,
    components: [
      { ing: 'lettuce', prep: 'cut' },
      { ing: 'tomato', prep: 'cut' },
    ],
  },
  {
    id: 'burger', name: '经典汉堡', price: 16, unlockDay: 1,
    components: [
      { ing: 'bread', prep: 'none' },
      { ing: 'patty', prep: 'fry' },
      { ing: 'lettuce', prep: 'cut' },
    ],
  },
  {
    id: 'ramen', name: '鸡蛋拉面', price: 22, unlockDay: 2,
    components: [
      { ing: 'noodle', prep: 'boil' },
      { ing: 'egg', prep: 'boil' },
    ],
  },
  {
    id: 'fishchips', name: '炸鱼薯条', price: 26, unlockDay: 3,
    components: [
      { ing: 'fish', prep: 'fry' },
      { ing: 'potato', prep: 'cutfry' },
    ],
  },
  {
    id: 'cheeseburger', name: '豪华芝士汉堡', price: 32, unlockDay: 4,
    components: [
      { ing: 'bread', prep: 'none' },
      { ing: 'patty', prep: 'fry' },
      { ing: 'cheese', prep: 'none' },
      { ing: 'tomato', prep: 'cut' },
    ],
  },
  {
    id: 'shrimprice', name: '鲜虾饭', price: 34, unlockDay: 5,
    components: [
      { ing: 'rice', prep: 'boil' },
      { ing: 'shrimp', prep: 'fry' },
      { ing: 'egg', prep: 'fry' },
    ],
  },
  {
    id: 'breakfast', name: '大早餐', price: 30, unlockDay: 6,
    components: [
      { ing: 'egg', prep: 'fry' },
      { ing: 'potato', prep: 'cutfry' },
      { ing: 'bread', prep: 'none' },
      { ing: 'tomato', prep: 'cut' },
    ],
  },
];

export function dishById(id) {
  return DISHES.find((d) => d.id === id);
}
export function unlockedDishes(day) {
  return DISHES.filter((d) => d.unlockDay <= day);
}
// 某道菜第一次需要某食材的那天（食材箱解锁日）
export function ingredientUnlockDay(ingId) {
  let day = 99;
  for (const d of DISHES) {
    if (d.components.some((c) => c.ing === ingId)) day = Math.min(day, d.unlockDay);
  }
  return day;
}
export function unlockedIngredients(day) {
  return Object.values(INGREDIENTS).filter((g) => ingredientUnlockDay(g.id) <= day);
}

// ---- 数值公式 ----
export function dayLength(day) {
  return Math.min(180, 110 + 10 * (day - 1));
}
export function dayTarget(day) {
  const d = day - 1;
  return 80 + 55 * d + 5 * d * d;
}
export function basePatience(day) {
  return Math.max(28, 48 - 2.5 * (day - 1));
}
export function customerPatience(day, dish) {
  return basePatience(day) + 7 * dish.components.length;
}
export function spawnInterval(day) {
  return Math.max(4.2, 10 - 0.75 * (day - 1));
}
export function starsFor(revenue, target) {
  if (revenue >= 2 * target) return 3;
  if (revenue >= 1.5 * target) return 2;
  if (revenue >= target) return 1;
  return 0;
}
export const FRY_TIME = 6; // 煎熟秒数
export const FRY_BURN_AFTER = 6; // 熟后再放多久烧焦
export const BOIL_TIME = 9; // 煮熟秒数，不焦
export const CHOPS_BASE = 5;
export const PLATE_RETURN_TIME = 1.5; // 上菜后盘子回来时间
export const MAX_HEARTS = 5;
export const MAX_COMBO = 2.0;

// ---- 升级商店（10 项）----
export const UPGRADES = [
  { id: 'knife', name: '利刀', desc: '每级少切 1 刀', prices: [60, 140], max: 2 },
  { id: 'stove', name: '猛火灶', desc: '每级烹饪加快 20%', prices: [80, 180], max: 2 },
  { id: 'board', name: '加砧板', desc: '多 1 块砧板', prices: [90], max: 1 },
  { id: 'pan', name: '加平底锅', desc: '多 1 个平底锅', prices: [110], max: 1 },
  { id: 'pot', name: '加汤锅', desc: '多 1 个汤锅', prices: [100], max: 1 },
  { id: 'plate', name: '加盘子', desc: '多 1 个盘子', prices: [70], max: 1 },
  { id: 'seats', name: '舒适卡座', desc: '每级客人耐心 +15%', prices: [70, 150], max: 2 },
  { id: 'tipjar', name: '小费罐', desc: '小费 +30%', prices: [90], max: 1 },
  { id: 'timer', name: '煎锅计时器', desc: '焦糊前多 4 秒', prices: [50], max: 1 },
  { id: 'meal', name: '员工餐', desc: '回满心，可重复购买', prices: [40], max: 99 },
];
export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id);
}
export function upgradePrice(u, level) {
  if (u.id === 'meal') return 40;
  if (level >= u.max) return null;
  return u.prices[level];
}
// 由升级推导出的实际数值
export function chopsNeeded(up) {
  return Math.max(1, CHOPS_BASE - (up.knife || 0));
}
export function cookSpeedMul(up) {
  return 1 + 0.2 * (up.stove || 0);
}
export function patienceMul(up) {
  return 1 + 0.15 * (up.seats || 0);
}
export function burnWindow(up) {
  return FRY_BURN_AFTER + (up.timer ? 4 : 0);
}

// ---- 布局（1280x720 固定画布）----
function rect(x, y, w, h) {
  return { x, y, w, h };
}
export const LAYOUT = {
  hud: rect(0, 0, 1280, 54),
  pauseBtn: rect(1186, 8, 40, 38),
  muteBtn: rect(1138, 8, 40, 38),
  seats: [0, 1, 2, 3].map((i) => rect(24 + i * 316, 64, 296, 146)),
  // 食材箱：4 列 x 3 行（只显示已解锁的）
  bins: Object.keys(INGREDIENTS).map((_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    return rect(24 + col * 86, 232 + row * 66, 78, 58);
  }),
  boards: [rect(384, 232, 120, 64), rect(516, 232, 120, 64), rect(384, 312, 120, 64)],
  pans: [rect(660, 232, 120, 64), rect(792, 232, 120, 64), rect(660, 312, 120, 64)],
  pots: [rect(936, 232, 112, 64), rect(1056, 232, 112, 64), rect(936, 312, 112, 64)],
  trash: rect(1176, 232, 80, 144),
  handBox: rect(24, 470, 252, 130),
  plates: [0, 1, 2, 3].map((i) => rect(300 + i * 172, 470, 156, 130)),
  hintBar: rect(0, 640, 1280, 80),
  // 标题 / 说明 / 日结 / 商店 / 关店 按钮
  titleStart: rect(490, 430, 300, 64),
  titleHow: rect(490, 510, 300, 64),
  howBack: rect(490, 600, 300, 56),
  dayNext: rect(490, 600, 300, 56),
  shopNext: rect(980, 600, 260, 56),
  overRetry: rect(400, 520, 220, 60),
  overTitle: rect(660, 520, 220, 60),
  pauseResume: rect(490, 300, 300, 60),
  pauseQuit: rect(490, 380, 300, 60),
};
export function inRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export const BIN_ORDER = Object.keys(INGREDIENTS);
// 商店：2 列 x 5 行，每项 560x92
export function shopItemRect(i) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return { x: 40 + col * 640, y: 150 + row * 88, w: 600, h: 80 };
}
