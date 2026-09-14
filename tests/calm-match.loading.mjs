import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const mode of ['late', 'exit', 'failed']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let release;
    const gate = new Promise(resolve => release = resolve);
    await page.route('**/src/games/calm-match/jelly-board.js*', async route => {
      if (mode === 'failed') return route.abort();
      await gate; await route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('softie:calm-match:v1', JSON.stringify({ version: 1, board: Array(30).fill(0), cleared: 0, moves: 0, best: 0 }));
    });
    await page.goto(`${base}/games/calm-match`, { waitUntil: 'domcontentloaded' });
    await page.locator('.match-cell').first().waitFor();
    if (mode === 'exit') {
      await page.locator('.game-back').click();
      release();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('.jelly-board-canvas').count(), 0);
      await page.locator('.calm-entry').click();
      await page.locator('.has-jelly-renderer').waitFor({ timeout: 60000 });
      assert.equal(await page.locator('.jelly-board-canvas').count(), 1);
    } else {
      for (const i of [0, 1, 2]) { await page.locator(`[data-cell="${i}"]`).focus(); await page.keyboard.press('Space'); }
      await page.keyboard.press('Enter');
      release();
      await page.waitForFunction(() => !document.querySelector('[data-tool="coffee"]').disabled);
      if (mode === 'late') await page.locator('.has-jelly-renderer').waitFor({ timeout: 60000 });
      assert.equal(await page.locator('.selected').count(), 0);
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('softie:calm-match:v1')));
      assert.equal(state.cleared, 3); assert.equal(state.moves, 1);
      const colors = await page.locator('.match-cell').evaluateAll(cells => cells.map(c => Number(c.dataset.color)));
      assert.deepEqual(colors, state.board);
      if (mode === 'failed') {
        assert.equal(await page.locator('.jelly-board-canvas').count(), 0);
        await page.locator('[data-tool="plaster"]').click(); await page.locator('[data-cell="0"]').click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('softie:calm-match:v1')).cleared === 4);
      }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS loading: ${mode}`);
    await context.close();
  }
} finally { await browser.close(); }
