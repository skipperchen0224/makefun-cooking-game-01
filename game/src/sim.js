// 无头模拟：固定种子 + 自动玩家，跑完整对局，输出摘要与哈希。
// 同一种子跑两次，摘要哈希必须一致（确定性验证）。
import { createGame, startGame, tick, clickAt, keyPress, summary, summaryHash } from './logic.js';
import { decide } from './driver.js';

export function runSim(seed = 20261125, maxDays = 1) {
  const s = createGame(seed);
  startGame(s);
  const DT = 0.1;
  let steps = 0;
  const maxSteps = 20000;
  while (steps < maxSteps) {
    steps++;
    if (s.phase === 'playing') {
      const a = decide(s);
      if (a && a.kind === 'click') clickAt(s, a.x, a.y);
      else if (a && a.kind === 'key') keyPress(s, a.key);
      tick(s, DT);
    } else if (s.phase === 'dayend') {
      keyPress(s, 'Enter'); // 去商店
    } else if (s.phase === 'shop') {
      if (s.day >= maxDays) break;
      keyPress(s, 'Enter'); // 下一天
    } else if (s.phase === 'gameover') {
      break;
    } else {
      break;
    }
    if (s.phase === 'dayend' && s.day >= maxDays) break;
  }
  const sum = summary(s);
  return { ...sum, hash: summaryHash(s), steps };
}
