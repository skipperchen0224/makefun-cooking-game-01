// Sizzle Street Kitchen — make.fun 提交入口（Node 22，标准库）。
// 正常模式：把 game/ 与 screenshots/ 拷到输出目录，用 kit 自带的
// vendor/makefun-game.ts 生成 dossier.json。
// 检查模式：node main.ts --check-only —— 不依赖 vendor，只校验文件与截图齐全。
// vendor 文件由统筹从 kit starter 拷入；缺失时构建会明确报错，不静默造假。
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const args = process.argv.slice(2);

function checkOnly() {
  const problems = [];
  const need = ['game/index.html', 'game/src/data.js', 'game/src/rng.js', 'game/src/audio.js',
    'game/src/logic.js', 'game/src/render.js', 'game/src/driver.js', 'game/src/sim.js',
    'game/src/main.js', 'serve.ts', 'tools/headless.mjs'];
  for (const f of need) {
    if (!existsSync(join(here, f))) problems.push(`missing ${f}`);
  }
  const shots = ['1-start.jpg', '2-rush.jpg', '3-serve.jpg', '4-shop.jpg'];
  for (const f of shots) {
    const p = join(here, 'screenshots', f);
    if (!existsSync(p)) problems.push(`missing screenshots/${f}`);
    else if (statSync(p).size > 262144) problems.push(`screenshots/${f} over 256 KiB`);
  }
  const vendor = join(here, 'vendor', 'makefun-game.ts');
  console.log(`vendor/makefun-game.ts: ${existsSync(vendor) ? 'present' : 'MISSING (to be copied from kit starter)'}`);
  if (problems.length > 0) {
    console.log('check-only FAIL:');
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log('check-only PASS: all source files and screenshots present');
}

if (args.includes('--check-only')) {
  checkOnly();
  process.exit(0);
}

const vendorPath = join(here, 'vendor', 'makefun-game.ts');
if (!existsSync(vendorPath)) {
  console.error('ERROR: vendor/makefun-game.ts is missing.');
  console.error('It is a kit-provided file and must be copied from the kit starter before building the dossier.');
  console.error('Run `node main.ts --check-only` to verify everything else without vendor.');
  process.exit(1);
}

const { buildDossier } = await import('./vendor/makefun-game.ts');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossierPath = join(out, 'dossier.json');
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(dossierPath, dossier);
console.log(`Sizzle Street Kitchen handed in: ${out} (dossier ${dossier.length} bytes)`);
void readdirSync;
