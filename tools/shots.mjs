// 截图工具：真实浏览器渲染 4 张定妆，1280x720 JPEG，每张拍两次，
// 逐字节哈希必须一致、单张 ≤256 KiB。
// 用法：node tools/shots.mjs   （需本机 google-chrome；服务由脚本自起）
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8092;
const BASE = `http://localhost:${PORT}`;
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'screenshots');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODES = [
  ['1-start', 'start'],
  ['2-rush', 'rush'],
  ['3-serve', 'serve'],
  ['4-shop', 'shop'],
];

const server = spawn('node', ['serve.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(800);
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--mute-audio',
  '--window-size=1280,720', '--remote-debugging-port=9333',
  '--user-data-dir=/tmp/cooking-shots-profile-' + process.pid,
  'about:blank',
], { stdio: 'ignore' });

let ws;
async function connectCDP() {
  for (let i = 0; i < 30; i++) {
    try {
      const tabs = await fetch('http://127.0.0.1:9333/json/list').then((r) => r.json());
      const page = tabs.find((t) => t.type === 'page');
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
await connectCDP();
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails?.text || '').slice(0, 200));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE-ERR');
});
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r?.result?.value;
};
const shot = async () => {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  return Buffer.from(r.data, 'base64');
};
const hash = (b) => createHash('sha256').update(b).digest('hex');

let fail = 0;
try {
  for (const [name, mode] of MODES) {
    const hashes = [];
    for (let round = 0; round < 2; round++) {
      await send('Page.navigate', { url: `${BASE}/?shot=${mode}&seed=1` });
      let ready = false;
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        if (await evalJs('window.__shotReady === true')) { ready = true; break; }
      }
      if (!ready) { console.log(`FAIL  ${name}: shot not ready`); fail++; break; }
      await sleep(300);
      const buf = await shot();
      hashes.push(hash(buf));
      if (round === 0) {
        const p = join(outDir, `${name}.jpg`);
        writeFileSync(p, buf);
        console.log(`${name}.jpg  ${buf.length} bytes  sha256 ${hashes[0].slice(0, 16)}…`);
      }
    }
    if (hashes.length === 2) {
      const same = hashes[0] === hashes[1];
      const size = statSync(join(outDir, `${name}.jpg`)).size;
      console.log(`${same ? 'PASS' : 'FAIL'}  ${name} 两次逐字节一致: ${same}`);
      console.log(`${size <= 262144 ? 'PASS' : 'FAIL'}  ${name} ≤256 KiB: ${size} bytes`);
      if (!same || size > 262144) fail++;
    }
  }
  console.log(`page errors: ${errors.length}`, errors.slice(0, 3));
  if (errors.length) fail++;
} finally {
  try { ws?.close(); } catch { /* 忽略 */ }
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
}
console.log(fail === 0 ? 'SHOTS: ALL PASS' : `SHOTS: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
