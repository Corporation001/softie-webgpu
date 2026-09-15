import { RageMeter } from '../../rage-meter.js';
import { COLS, ROWS, TARGET, SAVE_KEY, newGame, validSave, ensureMove, findMove, extendPath, clearPath } from './model.js';
import { sound } from '../../sound.js';
import { chainTier, createFeedback } from './feedback.js';
import { toolTargets, useTool } from './model.js';

const names = ['草莓', '薄荷', '葡萄', '奶油'];
const marks = ['●', '◆', '✦', '♥'];
const controlImages = {
  back: '/games/calm-match/btn-back.webp',
  menu: '/games/calm-match/btn-menu.webp',
  hint: '/games/calm-match/btn-hint.webp',
};
const controlIcon = name => `<img class="game-control-img" src="${controlImages[name]}" width="44" height="44" alt="" draggable="false">`;
// Reuse Softie's authored silhouette, with lightweight CSS shading for 30 pieces.
export function jelly(color) {
  return `<span class="mini-jelly jelly-${color}" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 5c-5.9 0-6.3 7.2-10.3 9.8C7.6 18.7 5 24.2 5 30.3 5 38.8 12.6 43 24 43s19-4.2 19-12.7c0-6.1-2.6-11.6-8.7-15.5C30.3 12.2 29.9 5 24 5Z" fill="currentColor"/><ellipse cx="16" cy="19" rx="3" ry="5" fill="white" opacity=".55" transform="rotate(30 16 19)"/><circle cx="17.2" cy="28" r="2" fill="#332a30"/><circle cx="30.8" cy="28" r="2" fill="#332a30"/><path d="M21.2 32q2.8 3 5.6 0" fill="none" stroke="#332a30" stroke-width="1.6" stroke-linecap="round"/></svg><i>${marks[color]}</i></span>`;
}

export function mountGame(root) {
  const feedback = createFeedback();
  let state = newGame();
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (validSave(saved)) { state = saved; ensureMove(state.board); restored = true; }
  } catch { /* Corrupt or unavailable storage starts a fresh board. */ }
  state.tools = { coffee: 1, plaster: 1, badge: 1, ...(state.tools ?? {}) };
  let activeTool = null;
  let path = [], pointer = null, busy = false, disposed = false, focus = 0;
  let jellyBoard = null, pendingBoard = null, companionScene = null, finger = null;
  const timers = new Set();
  const events = new AbortController();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms); timers.add(id); };
  const listen = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Play still works without storage. */ } };
  root.innerHTML = `
    <header class="game-header"><a href="/" class="game-brand" aria-label="softie 消消气"><img class="game-brand-img" src="/games/calm-match/logo.webp" alt="softie 消消气" width="105" height="50" draggable="false"></a><div class="game-navigation"><a href="/" class="game-back" aria-label="返回软乎乎" title="返回软乎乎">${controlIcon('back')}</a><button class="game-menu" aria-haspopup="dialog" aria-label="打开游戏菜单" title="游戏菜单">${controlIcon('menu')}</button></div></header>
    <div class="game-layout">
      <section class="game-story"><p class="game-eyebrow">SOFTIE PLAYROOM · 01</p><h1>今天的气，<br>消掉就好。</h1><p class="game-intro">把同色的小情绪连起来，<br>给自己一个准点下班的理由。</p><div class="game-companion">${jelly(0)}</div><p class="companion-quote"><span class="game-message" role="status" aria-live="polite"><span class="game-message-track"><span class="game-message-text">不着急，我陪你慢慢消。</span></span></span></p></section>
      <section class="game-center" aria-label="消消气棋盘">
        <div class="game-board-heading"></div>
        <div class="match-stage"><div class="match-board-wrap"><div class="match-board" role="group" aria-label="五列六行棋盘；拖动连接同色，或方向键移动、空格选择、回车消除"></div><svg class="match-thread" viewBox="0 0 500 600" preserveAspectRatio="none" aria-hidden="true"><polyline /></svg><div class="match-board-veil" aria-hidden="true"><div class="veil-shimmer"></div><span class="veil-badge"><span class="veil-dot"></span><span>软乎乎凝固中…</span></span></div></div></div>
        <p class="game-help">同色连起来 · 斜着也可以 · 松手噗叽消除</p>
      </section>
      <aside class="game-sidebar"><p class="game-eyebrow"><img class="clock-icon" src="/games/calm-match/clock.webp" width="40" height="40" alt="" draggable="false"><span>下班倒计气</span></p><div class="rage-meter-hud game-rage-hud" data-mood="max" aria-label="打工怨气进度条" title="打工怨气槽"><div class="rage-hud-avatar-wrap"><div class="rage-hud-avatar" data-state="max" aria-hidden="true"><svg class="rage-avatar-svg" viewBox="0 0 36 36" fill="none"><path class="rage-avatar-body" d="M18 4c-4.4 0-4.7 5.4-7.7 7.4C5.7 14 3.8 18.2 3.8 22.8c0 6.4 5.7 9.5 14.2 9.5s14.2-3.1 14.2-9.5c0-4.6-1.9-8.7-6.5-11.6C22.7 9.4 22.4 4 18 4Z" fill="currentColor" /><circle class="rage-avatar-blush" cx="10" cy="23" r="1.8" fill="#f472b6" opacity="0.65" /><circle class="rage-avatar-blush" cx="26" cy="23" r="1.8" fill="#f472b6" opacity="0.65" /><g class="rage-avatar-eyes"><circle class="rage-eye rage-eye-left" cx="13" cy="20" r="1.7" fill="#1c1917" /><circle class="rage-eye rage-eye-right" cx="23" cy="20" r="1.7" fill="#1c1917" /></g><path class="rage-avatar-mouth" d="M16 23.5q2 2 4 0" stroke="#1c1917" stroke-width="1.6" stroke-linecap="round" fill="none" /><path class="rage-avatar-cross" d="M22 10.5q2-1.5 2 2.5m-3-1q2.5 0 2.5 3m-2.5-3.5q1.5-2 3.5 0" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round" fill="none" /></svg></div></div><div class="rage-hud-track-wrap"><div class="rage-hud-header"><span class="rage-hud-badge">MAX 怨气爆表!</span><span class="rage-hud-percent">100%</span></div><div class="rage-hud-bar-capsule"><canvas class="rage-hud-canvas" width="240" height="32" aria-hidden="true"></canvas><div class="rage-hud-sparkles" aria-hidden="true"></div></div></div></div><div class="game-rage sr-only" hidden><strong>100%</strong><span>怨气值</span></div><progress class="sr-only" max="90" value="90" aria-label="剩余怨气" hidden></progress><p class="game-goal">消除 90 只软乎乎，清空今日怨气。</p><dl class="game-stats"><div><dt>已消除</dt><dd class="stat-cleared"></dd></div><div><dt>最长连线</dt><dd class="stat-best"></dd></div><div><dt>消除次数</dt><dd class="stat-moves"></dd></div></dl><div class="game-tools"><button class="game-hint" type="button" aria-label="给点提示"></button><button class="game-sound" type="button" aria-label="切换音效"></button><button class="game-restart" type="button" aria-label="重新开始"><img class="game-tool-img" src="/games/calm-match/btn-restart.webp" width="48" height="48" alt="" draggable="false"><span class="game-tool-label">重新开始</span></button></div><p class="game-save-note">进度自动保存，随时回来。</p></aside>
    </div>
    <dialog class="game-win"><div>${jelly(0)}</div><p class="game-eyebrow">OFF DUTY. ON CLOUD NINE.</p><h2>怨气清空，下班！</h2><p class="win-detail"></p><button class="game-again">再消一局</button><a href="/">回去揉揉软乎乎 ↗</a></dialog>
    <dialog class="game-confirm"><h2>重新开始这一局？</h2><p>当前消除进度会重置。</p><button class="confirm-reset">重新开始</button><button class="cancel-reset">继续玩</button></dialog>
    <dialog class="game-options" aria-label="游戏菜单"><h2>歇一小会儿</h2><p>连起至少 3 只同色软乎乎，斜着也可以。<br>点选道具，再点棋盘使用；再点道具可取消。</p><div class="options-content"></div><button class="close-options" type="button" aria-label="继续消消气"><img class="close-options-img" src="/games/calm-match/btn-resume.webp" width="240" height="90" alt="继续消消气" draggable="false"></button></dialog>`;
  const $ = s => root.querySelector(s);
  $('.game-hint').innerHTML = controlIcon('hint');
  $('.game-hint').setAttribute('aria-label', '给点提示');
  $('.game-hint').title = '找一组可消除的软乎乎';
  $('.game-help').insertAdjacentHTML('afterend', '<div class="match-powerups" aria-label="每局各一次的解压道具"><button data-tool="coffee" aria-label="冰美式，清除一列" aria-pressed="false"><img src="/games/calm-match/coffee.webp" width="160" height="160" alt="" draggable="false"><b class="tool-stock">1</b><span class="tool-name">冰美式</span></button><button data-tool="plaster" aria-label="创可贴，清除一只" aria-pressed="false"><img src="/games/calm-match/plaster.webp" width="160" height="160" alt="" draggable="false"><b class="tool-stock">1</b><span class="tool-name">创可贴</span></button><button data-tool="badge" aria-label="工牌，同色全消" aria-pressed="false"><img src="/games/calm-match/badge.webp" width="160" height="160" alt="" draggable="false"><b class="tool-stock">1</b><span class="tool-name">工牌</span></button></div>');
  const mobile = matchMedia('(max-width: 899px)');
  const stats = $('.game-stats'), controls = $('.game-tools');
  function arrangeMenu() {
    if (!mobile.matches) $('.game-options').close();
    if (mobile.matches) {
      $('.options-content').append(stats, controls);
      $('.game-story').append($('.game-hint'));
      $('.game-hint').innerHTML = controlIcon('hint');
    } else {
      const note = $('.game-sidebar .game-save-note');
      if (note) note.before(stats, controls);
      else $('.game-sidebar').append(stats, controls);
      $('.game-tools').prepend($('.game-hint'));
      $('.game-hint').innerHTML = `<img class="game-tool-img" src="${controlImages.hint}" width="48" height="48" alt="" draggable="false"><span class="game-tool-label">给点提示</span>`;
    }
  }
  arrangeMenu(); listen(mobile, 'change', arrangeMenu);
  const rageContainer = $('.game-rage-hud');
  const rageMeter = new RageMeter({ containerId: rageContainer, showMaxPercent: false });
  let currentAnger = Math.max(0, (TARGET - state.cleared) / TARGET);
  let currentMood = currentAnger >= 0.85 ? 'max' : currentAnger >= 0.50 ? 'rage' : currentAnger >= 0.20 ? 'annoyed' : 'chill';
  let badgeText = currentAnger >= 0.85 ? 'MAX 怨气爆表!' : currentAnger >= 0.50 ? '暴怒升温' : currentAnger >= 0.20 ? '有点上火' : currentAnger > 0 ? '快消完啦' : '怨气已清空!';
  let rageAnimId = null;
  let lastRageTime = performance.now();

  function rageLoop(now) {
    if (disposed) return;
    const dt = Math.min((now - lastRageTime) / 1000, 0.1);
    lastRageTime = now;
    rageMeter.update(dt, currentAnger, currentMood, false);
    if (rageMeter.badge && rageMeter.badge.textContent !== badgeText) {
      rageMeter.badge.textContent = badgeText;
    }
    rageAnimId = requestAnimationFrame(rageLoop);
  }
  rageAnimId = requestAnimationFrame(rageLoop);
  const messageEl = $('.game-message');
  let currentSpeech = '不着急，我陪你慢慢消。';

  function updateMarquee() {
    if (!messageEl) return;
    const text = currentSpeech;
    if (!text) return;
    messageEl.classList.remove('is-marquee');
    messageEl.innerHTML = `<span class="game-message-track"><span class="game-message-text">${text}</span></span>`;
    const track = messageEl.querySelector('.game-message-track');
    const textEl = messageEl.querySelector('.game-message-text');
    if (!track || !textEl) return;
    const containerWidth = messageEl.clientWidth;
    const textWidth = textEl.getBoundingClientRect().width;
    if (textWidth > containerWidth + 2) {
      const spacerWidth = 48;
      const shift = Math.ceil(textWidth + spacerWidth);
      const duration = Math.min(14, Math.max(6, Math.round(shift / 32)));
      messageEl.innerHTML = `<span class="game-message-track"><span class="game-message-text">${text}</span><span class="game-message-spacer" aria-hidden="true"></span><span class="game-message-text" aria-hidden="true">${text}</span></span>`;
      messageEl.style.setProperty('--marquee-shift', `${shift}px`);
      messageEl.style.setProperty('--marquee-duration', `${duration}s`);
      void messageEl.offsetWidth;
      messageEl.classList.add('is-marquee');
    } else {
      messageEl.style.removeProperty('--marquee-shift');
      messageEl.style.removeProperty('--marquee-duration');
    }
  }

  const message = text => {
    currentSpeech = text;
    updateMarquee();
  };

  const onWindowResize = () => {
    rageMeter.resize();
    updateMarquee();
  };
  window.addEventListener('resize', onWindowResize);
  const board = $('.match-board'), line = $('.match-thread polyline'), win = $('.game-win');
  const companion = $('.game-companion');
  const face = companion.querySelector('svg');
  const eyes = [...face.querySelectorAll('circle')];
  const mouth = face.querySelector('path[stroke]');
  companion.setAttribute('role', 'img');
  function react(count = 0, celebrating = false) {
    const mood = celebrating || state.cleared === TARGET ? 'happy' : count >= 7 ? 'excited' : count >= 3 ? 'curious' : state.cleared >= 60 ? 'relaxed' : 'calm';
    companion.dataset.mood = mood;
    companion.setAttribute('aria-label', `陪伴你的软乎乎：${{ happy: '开心', excited: '期待', curious: '专注', relaxed: '放松', calm: '平静' }[mood]}`);
    mouth.setAttribute('d', mood === 'excited' ? 'M23 31a1 1.5 0 1 0 2 0a1 1.5 0 1 0-2 0' : 'M22 31q2 2.8 4 0');
    mouth.setAttribute('fill', 'none');
    const quote = { happy: '啵！又轻松了一点。', excited: '哇——这一大团，准备好了吗？', curious: '对对，就是这样，连起来！', relaxed: '气快消完啦，肩膀也放松一点。', calm: '不着急，我陪你慢慢消。' };
    const speech = state.cleared === TARGET ? '今天辛苦啦，下班！' : quote[mood];
    if (!path.length && !activeTool) message(speech);
    const last = path.at(-1);
    const gazeX = last === undefined ? 0 : (last % COLS - 2) * .45;
    const gazeY = last === undefined ? 0 : (Math.floor(last / COLS) - 2.5) * .25;
    eyes.forEach(eye => eye.setAttribute('transform', `translate(${gazeX} ${gazeY})`));
    companionScene?.react(mood, gazeX, -gazeY);
  }
  import('./companion.js').then(async ({ createCompanion }) => {
    if (disposed) return;
    const scene = await createCompanion(companion);
    if (disposed) { scene.dispose(); return; }
    companionScene = scene; react(path.length);
  }).catch(error => console.warn('[calm-match] companion:', error));
  function toolsUI() {
    root.querySelectorAll('[data-tool]').forEach(button => {
      button.disabled = busy || state.cleared === TARGET || state.tools[button.dataset.tool] === 0;
      button.setAttribute('aria-pressed', String(activeTool === button.dataset.tool));
      button.querySelector('b').textContent = state.tools[button.dataset.tool];
    });
  }
  import('./jelly-board.js').then(async ({ createJellyBoard }) => {
    if (disposed) return;
    const scene = await createJellyBoard(board, state.board);
    if (disposed) { scene.dispose(); return; }
    if (scene?.renderer?.backend?.device) {
      rageMeter.setDevice(scene.renderer.backend.device);
    }
    pendingBoard = scene;
    if (!busy) activateBoard();
  }).catch(error => {
    $('.match-board-wrap')?.classList.add('has-3d-ready');
    if (!disposed) message('果冻画质暂未启动，已保留轻量棋盘，可继续玩。');
    console.warn('[calm-match] jelly renderer:', error);
  });
  function activateBoard() {
    if (!pendingBoard) return;
    jellyBoard = pendingBoard; pendingBoard = null;
    jellyBoard.sync(state.board);
    jellyBoard.select(path, finger);
    jellyBoard.show();
    requestAnimationFrame(() => {
      $('.match-board-wrap')?.classList.add('has-3d-ready');
    });
  }
  function render(falls = []) {
    toolsUI();
    react();
    if (!board.children.length) board.innerHTML = state.board.map((c, i) => `<button class="match-cell" data-cell="${i}">${jelly(c)}</button>`).join('');
    state.board.forEach((c, i) => {
      const cell = board.children[i];
      cell.className = 'match-cell'; cell.dataset.color = c; cell.tabIndex = i === focus ? 0 : -1;
      cell.setAttribute('aria-label', `第${Math.floor(i / COLS) + 1}行第${i % COLS + 1}列，${names[c]}`);
      cell.setAttribute('aria-pressed', 'false'); cell.style.setProperty('--fall', falls[i] || 0);
      cell.firstElementChild.className = `mini-jelly jelly-${c}`;
      cell.querySelector('i').textContent = marks[c];
    });
    jellyBoard?.sync(state.board, falls);
    if (!jellyBoard && falls.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      board.querySelectorAll('.match-cell').forEach((cell, i) => {
        if (falls[i]) cell.animate([{ transform: `translateY(-${Math.min(falls[i], ROWS) * 100}%)`, opacity: 0 }, { transform: 'translateY(5%)', opacity: 1, offset: .8 }, { transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' });
      });
    }
        const remaining = Math.max(0, TARGET - state.cleared);
    currentAnger = remaining / TARGET;
    if (currentAnger >= 0.85) {
      currentMood = 'max';
      badgeText = 'MAX 怨气爆表!';
    } else if (currentAnger >= 0.50) {
      currentMood = 'rage';
      badgeText = '暴怒升温';
    } else if (currentAnger >= 0.20) {
      currentMood = 'annoyed';
      badgeText = '有点上火';
    } else if (currentAnger > 0) {
      currentMood = 'chill';
      badgeText = '快消完啦';
    } else {
      currentMood = 'chill';
      badgeText = '怨气已清空!';
    }
    const rageStrong = $('.game-rage strong');
    if (rageStrong) rageStrong.textContent = `${Math.ceil(currentAnger * 100)}%`;
    const prog = $('progress');
    if (prog) prog.value = remaining;
    $('.stat-cleared').textContent = state.cleared;
    $('.stat-best').textContent = state.best;
    $('.stat-moves').textContent = state.moves;
    updateSound();
    if (state.cleared === TARGET) {
      $('.win-detail').textContent = `用了 ${state.moves} 次消除，最长连起 ${state.best} 只。今天辛苦啦。`;
      openDialog(win);
    }
  }
  function highlight() {
    react(path.length);
    root.dataset.chainTier = chainTier(path.length);
    jellyBoard?.select(path, finger);
    line.classList.remove('hint-path');
    root.classList.toggle('game-linking', path.length >= 3);
    board.querySelectorAll('.match-cell').forEach((cell, i) => { cell.classList.toggle('selected', path.includes(i)); cell.setAttribute('aria-pressed', String(path.includes(i))); cell.classList.remove('hinted'); });
    line.setAttribute('points', path.map(i => `${i % COLS * 100 + 50},${Math.floor(i / COLS) * 100 + 50}`).join(' '));
    if (path.length) {
      const toolName = activeTool === 'coffee' ? '冰美式' : activeTool === 'plaster' ? '创可贴' : '工牌·打卡下班';
      message(activeTool ? `${toolName} · 松手清除 ${path.length} 只，移出棋盘取消。` : path.length < 3 ? `连起 ${path.length} 只，再找一只同色的。` : `连起 ${path.length} 只 · 松手消消气！`);
    }
  }
  function select(index) {
    if (activeTool) { path = toolTargets(activeTool, index, state.board); highlight(); return; }
    const next = extendPath(state.board, path, index);
    if (next !== path) { path = next; highlight(); feedback.step(path.length); }
  }
  function cancel() {
    activeTool = null; toolsUI();
    const id = pointer;
    pointer = null;
    finger = null;
    if (id !== null && board.hasPointerCapture(id)) board.releasePointerCapture(id);
    path = []; highlight();
  }
  function commit() {
    if (busy || disposed) return;
    const tool = activeTool;
    const result = tool ? useTool(state, tool, path[0]) : clearPath(state, path);
    if (!result) { cancel(); message('连起至少 3 只同色软乎乎，试试看。'); return; }
    const count = path.length;
    busy = true;
    activeTool = null; toolsUI();
    const keyboard = board.contains(document.activeElement);
    if (jellyBoard) jellyBoard.pop(path);
    else for (const i of path) board.children[i].classList.add('popping');
    line.setAttribute('points', '');
    state = result.state; save();
    sound.playSquish();
    rageMeter.pulse(count >= 6 ? 1.6 : count >= 4 ? 1.2 : 0.85);
    later(() => feedback.pop(count), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : jellyBoard ? 430 : 100);
    later(() => {
      path = []; finger = null; root.dataset.chainTier = 0; root.classList.remove('game-linking'); render(result.falls);
      react(0, true);
      if (keyboard && !win.open) board.children[focus].focus({ preventScroll: true });
      message(result.shuffled ? '帮你重新拌了拌，又有同色伙伴啦。' : tool === 'badge' ? `打卡下班！一键清空 ${count} 只同色软乎乎。` : `噗叽！消掉 ${count} 点怨气。`);
      later(() => { busy = false; toolsUI(); react(); activateBoard(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : jellyBoard ? 800 : 380);
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : jellyBoard ? 640 : 180);
  }
  function cellAt(x, y) {
    const cell = document.elementFromPoint(x, y)?.closest('[data-cell]');
    return cell && board.contains(cell) ? Number(cell.dataset.cell) : -1;
  }
  listen(board, 'pointerdown', e => {
    if (busy || pointer !== null || state.cleared === TARGET || e.button !== 0) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault(); sound.resume(); path = []; pointer = e.pointerId;
    finger = { x: e.clientX, y: e.clientY };
    board.setPointerCapture(pointer); select(i);
  });
  listen(board, 'pointermove', e => {
    if (e.pointerId !== pointer) return;
    e.preventDefault();
    finger = { x: e.clientX, y: e.clientY };
    jellyBoard?.select(path, finger);
    for (const point of e.getCoalescedEvents?.() || [e]) select(cellAt(point.clientX, point.clientY));
    select(cellAt(e.clientX, e.clientY));
  });
  listen(board, 'pointerup', e => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    if (board.hasPointerCapture(e.pointerId)) board.releasePointerCapture(e.pointerId);
    if (activeTool && cellAt(e.clientX, e.clientY) < 0) { cancel(); message('道具已收好，没有消耗次数。'); return; }
    commit();
  });
  listen(board, 'focusin', e => {
    const cell = e.target.closest('[data-cell]');
    if (cell) { focus = Number(cell.dataset.cell); board.querySelectorAll('button').forEach((button, i) => button.tabIndex = i === focus ? 0 : -1); }
  });
  listen(root, 'keydown', e => {
    if (e.key === 'Escape' && activeTool && !busy) { e.preventDefault(); cancel(); message('道具已收好，没有消耗次数。'); }
  });
  for (const type of ['pointercancel', 'lostpointercapture']) listen(board, type, e => { if (e.pointerId === pointer) cancel(); });
  listen(window, 'blur', () => { if (!busy && (pointer !== null || path.length)) cancel(); });
  listen(document, 'visibilitychange', () => { if (!busy && document.hidden && (pointer !== null || path.length)) cancel(); });
  listen(board, 'keydown', e => {
    if (busy || pointer !== null || state.cleared === TARGET) return;
    const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
    if (e.key in deltas) { e.preventDefault(); focus = Math.max(0, Math.min(29, focus + deltas[e.key])); board.querySelectorAll('button').forEach((b, i) => b.tabIndex = i === focus ? 0 : -1); board.children[focus].focus(); }
    else if (e.code === 'Space') { e.preventDefault(); sound.resume(); select(focus); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') cancel();
  });
  listen($('.game-hint'), 'click', () => {
    if (busy || pointer !== null) return;
    cancel();
    const hint = findMove(state.board);
    hint.forEach(i => board.children[i].classList.add('hinted'));
    line.classList.add('hint-path');
    line.setAttribute('points', hint.map(i => `${i % COLS * 100 + 50},${Math.floor(i / COLS) * 100 + 50}`).join(' '));
    message('沿金色虚线，连起光圈中的 3 只软乎乎。');
  });
  function updateSound() {
    const btn = $('.game-sound');
    if (!btn) return;
    const icon = sound.enabled ? '/games/calm-match/btn-sound-on.webp' : '/games/calm-match/btn-sound-off.webp';
    const label = sound.enabled ? '音效 开' : '音效 关';
    btn.innerHTML = `<img class="game-tool-img" src="${icon}" width="48" height="48" alt="" draggable="false"><span class="game-tool-label">${label}</span>`;
    btn.setAttribute('aria-label', sound.enabled ? '关闭音效' : '开启音效');
  }
  root.querySelectorAll('[data-tool]').forEach(button => listen(button, 'click', () => {
    if (busy || pointer !== null || state.cleared === TARGET || !state.tools[button.dataset.tool]) return;
    const next = activeTool === button.dataset.tool ? null : button.dataset.tool;
    cancel(); activeTool = next; toolsUI();
    const toolTips = {
      coffee: '冰美式：点选要清掉的一列',
      plaster: '创可贴：点选一只软乎乎',
      badge: '工牌：点选一只软乎乎，全场同色打卡下班',
    };
    message(next ? `${toolTips[next]}；再次点击道具取消。` : '道具已收好，继续连线吧。');
  }));
  function openDialog(dialog) {
    if (!dialog) return;
    dialog.classList.remove('is-closing');
    if (!dialog.open) dialog.showModal();
  }
  function closeDialog(dialog, onClosed) {
    if (!dialog || !dialog.open) { onClosed?.(); return; }
    if (dialog.classList.contains('is-closing') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.classList.remove('is-closing');
      dialog.close();
      onClosed?.();
      return;
    }
    dialog.classList.add('is-closing');
    let timer = null;
    const onEnd = e => {
      if (e && e.target !== dialog) return;
      clearTimeout(timer);
      dialog.removeEventListener('animationend', onEnd);
      dialog.classList.remove('is-closing');
      if (dialog.open) dialog.close();
      onClosed?.();
    };
    timer = setTimeout(onEnd, 260);
    dialog.addEventListener('animationend', onEnd);
  }
  listen($('.game-sound'), 'click', () => { sound.toggle(); updateSound(); });
  listen($('.game-menu'), 'click', () => { if (!busy) { cancel(); openDialog($('.game-options')); } });
  listen($('.close-options'), 'click', () => closeDialog($('.game-options')));
  function reset() {
    if (busy) return;
    cancel();
    state = newGame();
    save();
    closeDialog(win);
    closeDialog($('.game-confirm'));
    currentAnger = 1.0;
    currentMood = 'max';
    badgeText = 'MAX 怨气爆表!';
    rageMeter.reset();
    rageMeter.pulse(1.0);
    render();
    message('新的一局，慢慢来。');
  }
  listen($('.game-restart'), 'click', () => { if (!busy) { cancel(); closeDialog($('.game-options'), () => openDialog($('.game-confirm'))); } });
  listen($('.cancel-reset'), 'click', () => closeDialog($('.game-confirm')));
  listen($('.confirm-reset'), 'click', reset);
  listen($('.game-again'), 'click', reset);
  listen(win, 'cancel', e => e.preventDefault());
  for (const d of [$('.game-options'), $('.game-confirm')]) {
    listen(d, 'cancel', e => {
      e.preventDefault();
      closeDialog(d);
    });
  }
  render(); save(); message(restored ? '接着上次的进度，慢慢消。' : '从任意一只开始，连起 3 只同色伙伴。');
  return () => {
    disposed = true;
    cancel();
    save();
    cancelAnimationFrame(rageAnimId);
    window.removeEventListener('resize', onWindowResize);
    rageMeter.dispose();
    timers.forEach(clearTimeout);
    feedback.dispose();
    events.abort();
    jellyBoard?.dispose();
    pendingBoard?.dispose();
    companionScene?.dispose();
    root.replaceChildren();
  };
}
