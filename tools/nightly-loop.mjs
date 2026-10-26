// Ночной прогон петли по собранному dist/: вопрос → веер → карта → мини-игра →
// предсказание → ONE MORE QUESTION → снова вопрос. Мышь = палец
// (pointerdown/move/up). Инструмент агента, в игру не входит; Playwright не
// ставится в проект (в devDependencies только Vite) — берётся глобальный
// (сам находит его через `npm root -g`, ставить в проект не нужно).
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/nightly-loop.mjs http://localhost:4173/game/ fool,tower 390x844,1440x860
//
// Пишет по строке JSON на прогон в stdout и в $LOOP_OUT/results.jsonl (по
// умолчанию системный tmp): дошла ли до
// предсказания, секунды до него (с ожиданием интро), секунды мини-игры,
// ошибки консоли, запросы с ошибкой, где застряла. Кнопки экранов ищет по
// акцентным пикселям #EBA331; Шута ведёт по window.gameLeapProbe(); Башню —
// удержаниями по сетке точек в случайном (но постоянном) порядке; любую
// другую сцену мини-игры (заготовку из new-minigame.mjs) — тапом в центр.
// Предупреждение Chrome про willReadFrequently вызывает сам скрипт (читает
// пиксели канваса) — к игре не относится и отфильтровано.
import { tmpdir } from 'os';
import { join } from 'path';
const OUT = process.env.LOOP_OUT || tmpdir(); // results.jsonl и снимки — не в репозиторий
const PW = process.env.PLAYWRIGHT_MODULE || 'playwright';
// ESM не видит глобальные пакеты (NODE_PATH не работает для import) — если
// 'playwright' рядом не нашёлся, берём его из `npm root -g`. Playwright —
// CommonJS: chromium может лежать в default.
async function loadPlaywright() {
  try { return await import(PW); } catch (e) {
    if (PW !== 'playwright' || e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    const { execSync } = await import('child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return import(join(root, 'playwright', 'index.js'));
  }
}
const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default?.chromium;

const BASE = process.argv[2] || 'http://localhost:4173/game/';
const cards = (process.argv[3] || 'fool,tower').split(',');
const sizes = (process.argv[4] || '390x844,1440x860').split(',').map((s) => s.split('x').map(Number));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(browser, card, [W, H]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errors = [], badReq = [], log = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('willReadFrequently')) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => badReq.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) badReq.push(`${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  const snap = setInterval(async () => { try { log.push('~' + ((Date.now()-t0)/1000).toFixed(0) + 's ' + JSON.stringify(await page.evaluate(() => [window.gameCurrentScene?.(), window.gameLeapProbe?.()]))); } catch {} }, 15000);
  await page.goto(`${BASE}?card=${card}`);
  const scene = () => page.evaluate(() => window.gameCurrentScene?.());
  const rect = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await sleep(40); await page.mouse.up(); };
  const res = { card, size: `${W}×${H}`, reached: false, secs: null, miniSecs: null, stuck: null, scroll: null };
  const deadline = t0 + 240000;
  let miniStart = null, lastScene = null, sceneSince = Date.now();

  // сканируем тапами сетку, пока сцена не сменится
  async function scanTap(from, x0, x1, y0, y1, step = 24, fn = tap) {
    for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
      if ((await scene()) !== from) return true;
      await fn(rect.x + x, rect.y + y);
      await sleep(60);
    }
    return (await scene()) !== from;
  }

  // точки, где на канвасе есть акцент #EBA331 («это можно тронуть»): центры полос по строкам
  async function accentSpots() {
    return page.evaluate(() => {
      const c = document.getElementById('game'); const r = c.getBoundingClientRect();
      const k = c.width / r.width; const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data; const rows = new Map();
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4; const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R > 120 && R > G * 1.2 && G > B * 1.6 && R - B > 70) {
          const band = Math.floor(y / k / 24); const b = rows.get(band) || { xs: [], ys: [] };
          b.xs.push(x / k); b.ys.push(y / k); rows.set(band, b);
        }
      }
      const out = [];
      for (const b of rows.values()) {
        if (b.xs.length < 4) continue;
        // разбить по x на кластеры (пункты меню в ряд)
        const xs = b.xs.map((x, i) => [x, b.ys[i]]).sort((a, z) => a[0] - z[0]);
        let cur = [xs[0]];
        const push = () => { const mx = cur.reduce((s, p) => s + p[0], 0) / cur.length, my = cur.reduce((s, p) => s + p[1], 0) / cur.length; out.push([mx, my]); };
        for (let j = 1; j < xs.length; j++) { if (xs[j][0] - xs[j - 1][0] > 20) { push(); cur = []; } cur.push(xs[j]); }
        push();
      }
      return out;
    });
  }
  async function tapAccent(from) {
    for (let k = 0; k < 6; k++) {
      const spots = await accentSpots();
      for (const [x, y] of spots) { if ((await scene()) !== from) return true; await tap(rect.x + x, rect.y + y); await sleep(80); }
      await sleep(300);
    }
    return (await scene()) !== from;
  }

  async function leap() {
    let pressed = false;
    while (Date.now() < deadline && (await scene()) === 'leap') {
      const p = await page.evaluate(() => window.gameLeapProbe?.());
      if (!p) { await sleep(100); continue; }
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h * 0.6;
      if (p.state === 'walk') {
        const last = p.idx === p.n - 1;
        if (!last && p.next && p.edge - p.x < 80) {
          if (pressed) { await page.mouse.up(); pressed = false; }
          // свайп вверх-вперёд
          await page.mouse.move(cx, cy); await page.mouse.down();
          for (let i = 1; i <= 5; i++) { await page.mouse.move(cx + i * 22, cy - i * 30); await sleep(12); }
          await page.mouse.up();
          await sleep(300);
        } else if (!pressed) { await page.mouse.move(cx, cy); await page.mouse.down(); pressed = true; }
        else await sleep(16);
      } else if (p.state === 'wait_leap') {
        if (pressed) { await page.mouse.up(); pressed = false; await sleep(100); }
        await page.mouse.move(cx, cy); await page.mouse.down(); await sleep(3200); await page.mouse.up();
      } else { if (pressed && p.state !== 'walk') { await page.mouse.up(); pressed = false; } await sleep(50); }
    }
    if (pressed) await page.mouse.up();
  }

  // сцены мини-игр — всё, что не экран ритуала; новая сцена из
  // new-minigame.mjs (заготовка) уходит на предсказание по тапу
  await page.waitForFunction(() => window.gameScenes?.().includes('prediction'), null, { timeout: 30000 }).catch(() => {});
  const ritual = ['loading', 'question', 'deck', 'draw', 'reveal', 'prediction'];
  const minigames = (await page.evaluate(() => window.gameScenes?.() ?? [])).filter((n) => !ritual.includes(n));

  async function scaffold(name) {
    while (Date.now() < deadline && (await scene()) === name) {
      await tap(rect.x + rect.w / 2, rect.y + rect.h / 2);
      res.taps = (res.taps || 0) + 1;
      await sleep(500);
    }
  }

  async function release() {
    const cx = rect.w / 2;
    const pts = [];
    for (let y = rect.h * 0.3; y < rect.h * 0.88; y += 14) for (let dx = -90; dx <= 90; dx += 18) pts.push([cx + dx, y]);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let j = pts.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [pts[j], pts[k]] = [pts[k], pts[j]]; }
    let i = 0;
    while (Date.now() < deadline && (await scene()) === 'release') {
      const [x, y] = pts[i++ % pts.length];
      if (process.env.SHOTS && i % 15 === 1) await page.screenshot({ path: join(OUT, `tw-${W}-${i}.png`) });
      await page.mouse.move(rect.x + x, rect.y + y); await page.mouse.down(); await sleep(1100); await page.mouse.up();
      res.holds = (res.holds || 0) + 1;
      await sleep(80);
    }
  }

  while (Date.now() < deadline) {
    const s = await scene();
    if (s !== lastScene) { log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`); lastScene = s; sceneSince = Date.now(); }
    if (s === 'question') {
      if (res.reached) { res.loopBack = true; break; }
      await tapAccent('question');
    } else if (s === 'deck') {
      await sleep(500);
      await scanTap('deck', rect.w * 0.3, rect.w * 0.7, rect.h * 0.3, rect.h * 0.95, 30, async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await sleep(40); await page.mouse.up(); await sleep(150); });
    } else if (s === 'reveal') {
      await sleep(500);
      await tapAccent('reveal');
    } else if (s === 'leap' || s === 'release' || minigames.includes(s)) {
      miniStart = Date.now();
      if (s === 'leap') await leap(); else if (s === 'release') await release(); else await scaffold(s);
      res.miniSecs = ((Date.now() - miniStart) / 1000).toFixed(1);
    } else if (s === 'prediction') {
      if (!res.reached) {
        res.reached = true; res.secs = ((Date.now() - t0) / 1000).toFixed(1);
        await sleep(1500);
        await page.screenshot({ path: join(OUT, `shot-${card}-${W}.png`) });
        await tap(rect.x + rect.w / 2, rect.y + rect.h / 2); // дописать текст
        await sleep(1500);
      }
      await tapAccent('prediction');
    } else await sleep(200);
    if (Date.now() - sceneSince > 60000) { res.stuck = s; break; }
  }
  if (!res.reached && !res.stuck) res.stuck = await scene();
  res.scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
  clearInterval(snap);
  res.errors = errors; res.badReq = badReq; res.log = log;
  await ctx.close();
  return res;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const out = [];
for (const c of cards) for (const s of sizes) { const r = await run(browser, c, s); console.log(JSON.stringify(r)); (await import('fs')).appendFileSync(join(OUT, 'results.jsonl'), JSON.stringify(r) + '\n'); out.push(r); }
await browser.close();
