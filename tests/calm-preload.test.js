import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CALM_MATCH_IMAGES,
  preloadGameImages,
  preloadGameModules,
  preloadGameAssets,
} from '../src/games/calm-match/preload.js';

test('preload manifest covers all required visual game assets on disk', () => {
  assert.ok(CALM_MATCH_IMAGES.length >= 10, 'contains all essential match assets');
  for (const assetPath of CALM_MATCH_IMAGES) {
    const diskPath = path.resolve('public', assetPath.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `asset file exists on disk: ${assetPath}`);
    const stat = fs.statSync(diskPath);
    assert.ok(stat.size > 0, `asset file is non-empty: ${assetPath}`);
  }
});

test('preload handles headless environment without hanging and deduplicates requests', async () => {
  const p1 = preloadGameImages(500);
  const p2 = preloadGameImages(500);
  assert.equal(p1, p2, 'returns the same cached promise');

  const results = await p1;
  assert.ok(Array.isArray(results), 'resolves array of results in headless mode');

  const m1 = preloadGameModules();
  const m2 = preloadGameModules();
  assert.equal(m1, m2, 'deduplicates module preload');

  const assets = await preloadGameAssets({ timeoutMs: 500 });
  assert.equal(assets.ready, true, 'preloadGameAssets returns ready status');
});
