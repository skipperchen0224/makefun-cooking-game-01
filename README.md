# Sizzle Street Kitchen — 街角小馆后厨

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/skipperchen0224/makefun-cooking-game-01/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/skipperchen0224/makefun-cooking-game-01/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

经营一家 4 个座位的小馆：客人入座点菜，你在后厨切菜、煎炸、煮面，
赶在客人失去耐心之前把菜端上去。每天达到营业额目标就进升级商店，
开新的一天、解锁新菜；营业额不达标或声誉归零就关店。

纯 Canvas 绘制、Web Audio 合成音效、零外部请求、桌面 Chrome 可玩。

## 玩法

- 点食材箱拿料 → 砧板切（5 刀）、平底锅煎（6 秒熟，再放 6 秒烧焦）、
  汤锅煮（9 秒熟，不会焦）→ 点盘子装盘 → 点客人上菜。
- 盘子拼成客人点的菜才能端起；上错菜连击清零、客人耐心 -4 秒；
  客人超时离开连击清零、-1 颗心；每连上 5 单回 1 颗心。
- 上菜 1.5 秒后盘子洗干净回来。焦掉的东西只能丢进垃圾桶。

## 操作

| 按键 / 鼠标 | 作用 |
|---|---|
| 鼠标点工位 | 拿料、加工、装盘、上菜 |
| 空格 | 切菜一刀 |
| 1–4 | 用第 1–4 个盘子 |
| X | 丢掉手里的东西 |
| Esc / P | 暂停 / 继续 |
| M | 静音 / 恢复 |
| Enter | 确认（开始、进商店、下一天、重开） |

## 菜品（7 道，11 种食材）

| 菜品 | 价格 | 解锁 | 配料与做法 |
|---|---|---|---|
| 田园沙拉 | $14 | 第 1 天 | 生菜切、番茄切 |
| 经典汉堡 | $16 | 第 1 天 | 面包、肉饼煎、生菜切 |
| 鸡蛋拉面 | $22 | 第 2 天 | 面条煮、鸡蛋煮 |
| 炸鱼薯条 | $26 | 第 3 天 | 炸鱼煎、土豆先切后煎 |
| 豪华芝士汉堡 | $32 | 第 4 天 | 面包、肉饼煎、芝士、番茄切 |
| 鲜虾饭 | $34 | 第 5 天 | 米饭煮、鲜虾煎、鸡蛋煎 |
| 大早餐 | $30 | 第 6 天 | 鸡蛋煎、土豆先切后煎、面包、番茄切 |

鸡蛋既能煎也能煮（看菜品需要）；土豆要先切再煎。

## 数值

- 客人耐心 =（48 秒 − 每天 2.5 秒，最低 28 秒）+ 每样食材 7 秒。
- VIP（第 3 天起）：付 1.5 倍，耐心只有 80%。
  美食评论家（第 4 天起）：离开扣 2 颗心；在耐心剩一半以上时上菜，
  另奖 $20 并回 1 颗心。
- 小费最高为菜价的 60%，按剩余耐心比例算；连击每上一单 +0.1，
  最高 ×2.0；每日特价菜 ×1.5。
- 营业时长 110 秒起、每天 +10 秒、最多 180 秒；
  一天的 42%–62% 是午市高峰，客人来得快约 40%；
  客人到达间隔从 10 秒起、每天 −0.75 秒、最低 4.2 秒。
- 营业额目标 = 80 + 55d + 5d²（d = 天数 − 1），即 $80、$140、$210、$290……
  日结按营业额与目标之比给 1–3 星（1 倍 1 星、1.5 倍 2 星、2 倍 3 星）。
- 开局 2 砧板、2 平底锅、2 汤锅、3 盘子。

## 升级商店（金币）

| 升级 | 效果 | 价格 |
|---|---|---|
| 利刀 | 每级少切 1 刀 | 60 / 140 |
| 猛火灶 | 每级烹饪加快 20% | 80 / 180 |
| 加砧板 | 多 1 块砧板 | 90 |
| 加平底锅 | 多 1 个平底锅 | 110 |
| 加汤锅 | 多 1 个汤锅 | 100 |
| 加盘子 | 多 1 个盘子 | 70 |
| 舒适卡座 | 每级客人耐心 +15% | 70 / 150 |
| 小费罐 | 小费 +30% | 90 |
| 煎锅计时器 | 焦糊前多 4 秒 | 50 |
| 员工餐 | 回满心，可重复购买 | 40 |

## 本地运行

```sh
node serve.ts            # http://localhost:8080
node tools/headless.mjs  # 无头模拟：固定种子跑完整对局，两次哈希须一致
node tools/verify.mjs    # 浏览器实测：无头 Chrome 真实点击/按键打完整对局
node tools/shots.mjs     # 截图：4 张 1280x720 JPEG，两次生成逐字节一致
node main.ts --check-only  # 校验文件与截图齐全（不依赖 vendor）
```

## 确定性

逻辑由固定种子驱动（默认种子 20261125，可用 `?seed=` 改）：
同一种子跑两次无头模拟，输出摘要哈希一致。
`game/src/driver.js` 是自动玩家，无头模拟与浏览器实测共用同一决策。

## 文件

- `game/index.html` — 入口
- `game/src/data.js` — 菜品、食材、升级、数值公式、布局
- `game/src/rng.js` — 确定性随机数与哈希
- `game/src/logic.js` — 纯游戏逻辑（可在 Node 里跑）
- `game/src/render.js` — 纯 Canvas 渲染
- `game/src/audio.js` — Web Audio 合成音效与音乐
- `game/src/driver.js` — 自动玩家（测试用）
- `game/src/sim.js` — 无头模拟
- `game/src/main.js` — 浏览器入口（主循环、输入、截图定妆）
- `tools/` — headless / verify / shots 三个验证脚本
- `serve.ts` — 本地调试服务器（Node 标准库）
- `main.ts` — make.fun 提交入口（需 kit 的 `vendor/makefun-game.ts` 才能构建 dossier）
- `screenshots/` — 4 张实拍截图

最佳成绩存在浏览器 localStorage（`sizzle-street-best`）。
