// 浏览器实测：无头 Chrome + CDP，只用真实鼠标点击与真实按键打完整对局。
// 覆盖：标题→第 1 天（约 12 单、保住心、超目标）→ 暂停/静音 → 日结 →
// 商店买升级 → 第 2 天 → 第 3 天挂机至关店 → 结算 NEW BEST → 重开回第 1 天。
// 全程统计页面报错与外部请求；任一断言失败即非零退出。
// 用法：node tools/verify.mjs   （需本机 google-chrome；服务由脚本自起）
import { spawn } from 'node:child_process';
import { decide } from '../game/src/driver.js';

const PORT = 8091;
const BASE = `http://localhost:${PORT}`;
const SEED = 20261125;
const SPEED = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const requests = [];
let failures = [];
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures.push(name);
}

// ---- 起服务 ----
const server = spawn('node', ['serve.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(800);

// ---- 起无头 Chrome ----
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--mute-audio',
  '--window-size=1280,720', '--remote-debugging-port=9334',
  '--user-data-dir=/tmp/cooking-verify-profile-' + process.pid,
  `${BASE}/?seed=${SEED}&speed=${SPEED}`,
], { stdio: 'ignore' });

let ws;
async function connectCDP() {
  for (let i = 0; i < 120; i++) {
    try {
      const tabs = await fetch('http://127.0.0.1:9334/json/list').then((r) => r.json());
      const page = tabs.find((t) => t.type === 'page' && t.url.startsWith(BASE));
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        return;
      }
    } catch { /* 再等 */ }
    await sleep(500);
  }
  throw new Error('CDP connect timeout');
}
try { await connectCDP(); } catch (e) { chrome.kill('SIGKILL'); server.kill('SIGKILL'); throw e; }
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('EXC ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push('CONSOLE-ERR ' + m.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
  }
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
});
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r?.result?.value;
};
const snap = () => evalJs('window.__game.snapshot()');
async function click(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
const KEYMAP = {
  ' ': { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  p: { key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 },
  m: { key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 },
  x: { key: 'x', code: 'KeyX', windowsVirtualKeyCode: 88 },
};
async function press(k) {
  const m = KEYMAP[k] || { key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...m, text: k.length === 1 ? k : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...m });
}
async function waitPhase(phase, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (s.phase === phase) return s;
    await sleep(300);
  }
  throw new Error(`timeout waiting for phase ${phase}`);
}
// 用自动玩家打一整天：每 150ms 读一次快照、决策、发真实点击/按键
async function playDay(timeoutMs = 150000) {
  const t0 = Date.now();
  let lastPhase = 'playing';
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (s.phase !== 'playing') return s;
    const a = decide(s);
    if (a?.kind === 'click') await click(a.x, a.y);
    else if (a?.kind === 'key') await press(a.key);
    await sleep(150);
    lastPhase = s.phase;
  }
  void lastPhase;
  throw new Error('playDay timeout');
}

try {
  await sleep(1500);
  let s = await snap();
  check('标题界面', s.phase === 'title', `phase=${s.phase}`);

  // 开始营业（真实 Enter 键）
  await press('Enter');
  await sleep(300);
  s = await snap();
  check('Enter 开始第 1 天', s.phase === 'playing' && s.day === 1, `phase=${s.phase} day=${s.day}`);

  // 暂停 / 恢复（真实 P 键）
  await press('p');
  await sleep(200);
  s = await snap();
  check('P 暂停', s.phase === 'paused', `phase=${s.phase}`);
  await press('p');
  await sleep(200);
  s = await snap();
  check('P 恢复', s.phase === 'playing', `phase=${s.phase}`);

  // 静音 / 恢复（真实 M 键）
  await press('m');
  await sleep(150);
  s = await snap();
  check('M 静音开', s.muted === true);
  await press('m');
  await sleep(150);
  s = await snap();
  check('M 静音关', s.muted === false);

  // 打第 1 天
  s = await playDay();
  check('第 1 天打完进日结', s.phase === 'dayend', `phase=${s.phase}`);
  const d1 = s.dayResult;
  check('第 1 天约 12 单', d1.served >= 10 && d1.served <= 16, `served=${d1.served}`);
  check('第 1 天保住心（0 走失）', d1.lost === 0, `lost=${d1.lost}`);
  check('第 1 天远超 $80 目标', d1.revenue > d1.target * 2, `revenue=$${d1.revenue} target=$${d1.target}`);
  check('第 1 天 3 星', d1.stars === 3, `stars=${d1.stars}`);
  console.log(`  day1: served=${d1.served} revenue=$${d1.revenue} stars=${d1.stars} coins=$${s.coins}`);

  // 日结 → 商店，买利刀（真实点击第 1 个升级格）
  await press('Enter');
  await sleep(300);
  s = await snap();
  check('进商店', s.phase === 'shop', `phase=${s.phase}`);
  const coinsBefore = s.coins;
  await click(340, 190); // 商店第 1 格（利刀）中心
  await sleep(300);
  s = await snap();
  check('买利刀 1 级', s.upgrades.knife === 1 && s.coins === coinsBefore - 60, `knife=${s.upgrades.knife} coins ${coinsBefore}->${s.coins}`);

  // 下一天 → 打第 2 天
  await press('Enter');
  await sleep(300);
  s = await snap();
  check('进第 2 天', s.phase === 'playing' && s.day === 2, `phase=${s.phase} day=${s.day}`);
  s = await playDay();
  check('第 2 天打完进日结', s.phase === 'dayend', `phase=${s.phase}`);
  const d2 = s.dayResult;
  check('第 2 天达标', d2.revenue >= d2.target, `revenue=$${d2.revenue} target=$${d2.target}`);
  console.log(`  day2: served=${d2.served} lost=${d2.lost} revenue=$${d2.revenue} stars=${d2.stars}`);

  // 第 3 天：挂机（不操作），等客人走光关店
  await press('Enter'); // → 商店
  await sleep(300);
  await press('Enter'); // → 第 3 天
  await sleep(300);
  s = await snap();
  check('进第 3 天', s.phase === 'playing' && s.day === 3, `phase=${s.phase} day=${s.day}`);
  s = await waitPhase('gameover', 240000);
  check('挂机第 3 天关店', s.phase === 'gameover', `phase=${s.phase}`);
  check('关店原因有文案', typeof s.overReason === 'string' && s.overReason.length > 0, s.overReason);
  const best = await evalJs('JSON.parse(localStorage.getItem("sizzle-street-best") || "null")');
  check('localStorage 记最佳成绩', best && best.bestDay >= 3, JSON.stringify(best));
  check('NEW BEST', s.newBest === true, `newBest=${s.newBest}`);

  // 重开（真实点击「再来一局」）
  await click(510, 550);
  await sleep(400);
  s = await snap();
  check('重开回第 1 天', s.phase === 'playing' && s.day === 1, `phase=${s.phase} day=${s.day}`);

  // 页面报错与外部请求
  check('页面报错 0 个', errors.length === 0, errors.slice(0, 3).join(' | '));
  const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
  check('外部请求 0 个', external.length === 0, external.slice(0, 3).join(' | '));
  console.log(`  total requests: ${requests.length} (all ${BASE} or data:)`);
} catch (e) {
  console.log('FAIL  exception — ' + (e?.message || e));
  failures.push('exception: ' + (e?.message || e));
} finally {
  try { ws?.close(); } catch { /* 忽略 */ }
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
}

console.log(failures.length === 0 ? 'VERIFY: ALL PASS' : `VERIFY: ${failures.length} FAILURES`);
process.exit(failures.length === 0 ? 0 : 1);
