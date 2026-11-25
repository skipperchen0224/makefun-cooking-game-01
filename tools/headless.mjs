// 无头模拟入口：同一种子跑两次，摘要哈希必须一致。
// 用法：node tools/headless.mjs [seed] [days]
import { runSim } from '../game/src/sim.js';

const seed = Number(process.argv[2] || '20261125');
const days = Number(process.argv[3] || '1');
const a = runSim(seed, days);
const b = runSim(seed, days);
console.log('run 1:', JSON.stringify(a));
console.log('run 2:', JSON.stringify(b));
console.log('deterministic:', a.hash === b.hash ? 'PASS' : 'FAIL');
if (a.hash !== b.hash) process.exit(1);
