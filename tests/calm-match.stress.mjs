import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const cpuRate = Number(process.env.CALM_CPU_RATE || 1);
assert.ok([1, 4, 6].includes(cpuRate), 'CALM_CPU_RATE must be 1, 4 or 6');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
await mkdir('artifacts', { recursive: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('softie:calm-match:v1', JSON.stringify({ version: 1, board: Array(30).fill(0), cleared: 0, moves: 0, best: 0, tools: { coffee: 1, plaster: 1 } }));
    });
    await page.goto(`${base}/games/calm-match`, { waitUntil: 'networkidle' });
    await page.locator('.has-jelly-renderer').waitFor({ timeout: 60000 });
    await page.locator('.has-3d-companion').waitFor({ timeout: 60000 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    const select = async index => { await page.locator(`[data-cell="${index}"]`).focus(); await page.keyboard.press('Space'); };
    for (const i of [0, 1, 2, 3, 4]) await select(i);
    assert.equal(await page.locator('.calm-game').getAttribute('data-chain-tier'), '1');
    for (const i of [9, 8]) await select(i);
    assert.equal(await page.locator('.calm-game').getAttribute('data-chain-tier'), '2');
    assert.equal(await page.locator('.game-companion').getAttribute('data-mood'), 'excited');
    assert.equal(await page.locator('.selected').evaluateAll(cells => cells.every(cell => getComputedStyle(cell, '::after').content === 'none' && getComputedStyle(cell).backgroundColor === 'rgba(0, 0, 0, 0)')), true, 'selection uses gel lighting, not fixed circles or cell backgrounds');
    await page.screenshot({ path: `artifacts/calm-charge-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    // Measure the active charged state, not an empty page or a hidden renderer.
    const frames = await page.evaluate(() => new Promise(resolve => {
      const values = []; let last = 0;
      function tick(now) { if (last) values.push(now - last); last = now; if (values.length < 180) requestAnimationFrame(tick); else resolve(values.slice(30)); }
      requestAnimationFrame(tick);
    }));
    frames.sort((a, b) => a - b);
    const measurement = { mobile, cpuRate, medianMs: frames[Math.floor(frames.length * .5)], p95Ms: frames[Math.floor(frames.length * .95)], maxMs: frames.at(-1) };
    results.push(measurement);
    await select(9); await select(4); await select(3);
    assert.equal(await page.locator('.selected').count(), 4);
    assert.equal(await page.locator('.calm-game').getAttribute('data-chain-tier'), '0');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.selected').count(), 0);
    await page.locator('[data-tool="coffee"]').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-tool="coffee"]').getAttribute('aria-pressed'), 'false');
    // Select all 30; repeated Enter and focus loss must not double-consume a move.
    for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) await select(row * 5 + (row % 2 ? 4 - col : col));
    await page.evaluate(() => {
      window.__slowClearFrames = [];
      window.__fallFrames = new Promise(resolve => {
        const frames = []; let last = 0;
        function tick(now) {
          if (last) { frames.push(now - last); if (now - last > 40) window.__slowClearFrames.push({ ms: now - last, phase: document.querySelector('.jelly-board-canvas').dataset.phase }); }
          last = now; if (frames.length < 150) requestAnimationFrame(tick); else resolve(frames);
        }
        requestAnimationFrame(tick);
      });
    });
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => !document.querySelector('[data-tool="coffee"]').disabled);
    const falling = await page.evaluate(() => window.__fallFrames);
    falling.sort((a, b) => a - b);
    measurement.clearP95Ms = falling[Math.floor(falling.length * .95)];
    measurement.clearMaxMs = falling.at(-1);
    measurement.slowFrames = await page.evaluate(() => window.__slowClearFrames);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('softie:calm-match:v1')));
    assert.equal(state.moves, 1); assert.equal(state.cleared, 30); assert.equal(state.best, 30);
    assert.equal(await page.locator('.selected').count(), 0);
    assert.equal(await page.locator('.jelly-board-canvas').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-tool="plaster"]').click(); await page.locator('[data-cell="0"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-tool="coffee"]').disabled);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('softie:calm-match:v1')).cleared), 31);
    for (const width of mobile ? [320, 844] : [1024, 1920]) {
      await page.setViewportSize({ width, height: mobile ? 740 : 1080 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no overflow at ${width}px`);
    }
    // Repeated real SPA exits must leave only the active tray and preserve progress.
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.locator('.game-back').click();
      assert.equal(await page.locator('.jelly-board-canvas').count(), 0);
      await page.locator('.calm-entry').click();
      await page.locator('.has-jelly-renderer').waitFor({ timeout: 60000 });
      assert.equal(await page.locator('.jelly-board-canvas').count(), 1);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('softie:calm-match:v1')).cleared), 31);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`artifacts/calm-performance${cpuRate === 1 ? '' : `-cpu${cpuRate}`}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (process.env.CALM_PERF_CHECK === '1') {
    for (const result of results) {
      assert.ok(result.p95Ms <= 34 && result.clearP95Ms <= 34, 'charged and clearing P95 stay within a 30fps frame budget');
      assert.ok(result.clearMaxMs <= 100, 'clearing has no single-frame stall exceeding 100ms');
    }
  }
  console.log('PASS: charge tiers, backtracking, 30-chain, repeat commit, blur, tool Escape, reduced motion');
} finally { await browser.close(); }
