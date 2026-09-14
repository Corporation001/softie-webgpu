import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { findMove } from '../src/games/calm-match/model.js';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'warning' || msg.type() === 'error') console.log(msg.text()); });
  await page.goto(`${base}/games/calm-match`, { waitUntil: 'networkidle' });
  await page.locator('.has-jelly-renderer').waitFor({ timeout: 60000 });
  await page.locator('.has-3d-companion').waitFor({ timeout: 60000 });
  for (const [width, height] of [[390, 844], [320, 568], [375, 667], [412, 915], [768, 1024], [844, 390], [568, 320], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `artifacts/calm-layout-${width}x${height}.png`, fullPage: true });
    const geometry = await page.evaluate(() => {
      const selectors = ['.game-header', '.game-companion', '.game-sidebar', '.game-message', '.match-board-wrap', '.match-powerups'];
      return { overflowX: document.documentElement.scrollWidth > innerWidth, overflowY: document.documentElement.scrollHeight > innerHeight,
        boxes: selectors.map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }) };
    });
    console.log(width, height, JSON.stringify(geometry));
    assert.equal(geometry.overflowX, false);
    const messageBox = geometry.boxes.find(r => r.selector === '.game-message');
    const boardBox = geometry.boxes.find(r => r.selector === '.match-board-wrap');
    if (height >= width) {
      assert.ok(messageBox.bottom <= boardBox.y, 'feedback stays above the board');
    }
    if (width < 900) {
      for (const [selector, label] of [['.game-back', '返回软乎乎'], ['.game-menu', '打开游戏菜单'], ['.game-hint', '给点提示']]) {
        const control = page.locator(selector);
        assert.equal(await control.getAttribute('aria-label'), label);
        assert.equal(await control.locator('img.game-control-img').count(), 1);
        assert.equal(await control.locator('img.game-control-img').evaluate(i => i.complete && i.naturalWidth > 0), true);
        assert.equal((await control.innerText()).trim(), '', 'icon-only visual control');
        const box = await control.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, 'preserves a 44px touch target');
      }
      assert.equal(geometry.overflowY, false, 'mobile game fills one viewport');
      for (const r of geometry.boxes) { assert.ok(r.x >= -1 && r.y >= -1 && r.right <= width + 1 && r.bottom <= height + 1, `${r.selector} remains fully on screen`); }
      await page.locator('.game-menu').click();
      assert.equal(await page.locator('.game-sound').isVisible(), true);
      assert.equal(await page.locator('.game-restart').isVisible(), true);
      assert.equal(await page.locator('.game-stats').isVisible(), true);
      await page.locator('.close-options').click();
    }
  }
  assert.equal(await page.locator('.companion-canvas').count(), 1);
  const path = findMove(await page.evaluate(() => JSON.parse(localStorage.getItem('softie:calm-match:v1')).board));
  for (const i of path) { await page.locator(`[data-cell="${i}"]`).focus(); await page.keyboard.press('Space'); }
  await page.keyboard.press('Enter');
  await page.locator('.game-companion[data-mood="happy"]').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('.game-companion').screenshot({ path: 'artifacts/calm-companion-happy.png' });
  assert.equal(await page.locator('.match-powerups img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth === 160)), true);
  assert.equal(await page.locator('[data-tool="coffee"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.deepEqual(errors, []);
  await context.close();
} finally { await browser.close(); }
