import test from 'node:test';
import assert from 'node:assert/strict';
import { chainFrequency, chainTier, createFeedback } from '../src/games/calm-match/feedback.js';
import { sound } from '../src/sound.js';
import { newGame, useTool, toolTargets, validSave } from '../src/games/calm-match/model.js';

test('chain feedback rises through pentatonic octaves with a bounded pitch', () => {
  for (let i = 1; i < 15; i++) assert.ok(chainFrequency(i + 1) > chainFrequency(i));
  assert.equal(chainFrequency(30), chainFrequency(15));
  assert.deepEqual([3, 4, 5, 6, 7, 30].map(chainTier), [0, 0, 1, 1, 2, 2]);
});

test('tools consume exactly once, preserve chain record and refill the board', () => {
  const state = newGame();
  const coffee = useTool(state, 'coffee', 12);
  assert.deepEqual(coffee.targets, [2, 7, 12, 17, 22, 27]);
  assert.deepEqual(coffee.targets.map(i => coffee.falls[i]), [6, 6, 6, 6, 6, 6]);
  assert.deepEqual(coffee.targets.map(i => Math.floor(i / 5) - coffee.falls[i]), [-6, -5, -4, -3, -2, -1], 'new pieces start separated above the tray');
  assert.equal(coffee.state.cleared, 6);
  assert.equal(coffee.state.best, 0);
  assert.equal(coffee.state.board.length, 30);
  assert.equal(state.tools.coffee, 1);
  assert.equal(useTool(coffee.state, 'coffee', 0), null);
  const plaster = useTool(coffee.state, 'plaster', 0);
  assert.equal(plaster.state.cleared, 7);
  assert.equal(plaster.state.tools.plaster, 0);
  assert.equal(plaster.state.tools.badge, 1);
  assert.ok(validSave(plaster.state));
  const targetColor = plaster.state.board[5];
  const expectedBadgeTargets = plaster.state.board.flatMap((c, i) => c === targetColor ? [i] : []);
  const badge = useTool(plaster.state, 'badge', 5);
  assert.deepEqual(badge.targets, expectedBadgeTargets);
  assert.equal(badge.state.tools.badge, 0);
  assert.equal(badge.state.cleared, 7 + expectedBadgeTargets.length);
  assert.ok(validSave(badge.state));
});

test('tool validation handles old saves, invalid targets and completed games', () => {
  const state = newGame(); delete state.tools;
  assert.ok(validSave(state));
  assert.equal(useTool(state, 'plaster', 3).state.tools.plaster, 0);
  assert.deepEqual(toolTargets('coffee', -1), []);
  assert.equal(useTool(state, 'unknown', 0), null);
  assert.equal(useTool({ ...state, cleared: 90 }, 'plaster', 0), null);
  assert.equal(validSave({ ...state, tools: { coffee: -1, plaster: 1 } }), false);
});

test('game audio bounds overlapping voices, respects mute and disconnects on disposal', () => {
  const previous = { ctx: sound.ctx, filter: sound.filter, enabled: sound.enabled, matchMedia: globalThis.matchMedia };
  const nodes = [];
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  function node() { const n = { frequency: param, gain: param, connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop() { this.stopped = true; } }; nodes.push(n); return n; }
  globalThis.matchMedia = () => ({ matches: false });
  sound.ctx = { currentTime: 0, state: 'running', createOscillator: node, createGain: node };
  sound.filter = {}; sound.enabled = true;
  const feedback = createFeedback();
  try {
    for (let i = 0; i < 20; i++) feedback.pop(30);
    assert.equal(nodes.length, 24, 'at most 12 oscillator/gain pairs');
    nodes[0].onended();
    assert.ok(nodes[0].disconnected && nodes[1].disconnected);
    sound.enabled = false;
    feedback.pop(7);
    assert.equal(nodes.length, 24, 'mute creates no new nodes');
    feedback.dispose();
    assert.ok(nodes.every(n => n.disconnected), 'all nodes released on route exit');
    assert.doesNotThrow(() => feedback.dispose());
  } finally {
    sound.ctx = previous.ctx; sound.filter = previous.filter; sound.enabled = previous.enabled;
    if (previous.matchMedia === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = previous.matchMedia;
  }
});
