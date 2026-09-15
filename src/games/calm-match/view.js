import { RageMeter } from '../../rage-meter.js';
import { COLS, ROWS, TARGET, SAVE_KEY, newGame, validSave, ensureMove, findMove, extendPath, clearPath } from './model.js';
import { sound } from '../../sound.js';
import { chainTier, createFeedback } from './feedback.js';
import { toolTargets, useTool } from './model.js';
import { getCurrentLanguage, translate } from '../../i18n.js';

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
  const lang = getCurrentLanguage();
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  root.setAttribute('lang', lang);
  const t = key => translate(lang, key);
  const isEn = lang === 'en';
  const names = [t('cmJelly0'), t('cmJelly1'), t('cmJelly2'), t('cmJelly3')];
  const resumeBtnSrc = isEn ? '/games/calm-match/btn-resume-en.webp' : '/games/calm-match/btn-resume.webp';
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
    <header class="game-header"><a href="/" class="game-brand" aria-label="${t('cmBrandLabel')}"><img class="game-brand-img" src="/games/calm-match/logo.webp" alt="${t('cmBrandLabel')}" width="105" height="50" draggable="false"></a><div class="game-navigation"><a href="/" class="game-back" aria-label="${t('cmBackLabel')}" title="${t('cmBackLabel')}">${controlIcon('back')}</a><button class="game-menu" aria-haspopup="dialog" aria-label="${t('cmMenuLabel')}" title="${t('cmMenuTitle')}">${controlIcon('menu')}</button></div></header>
    <div class="game-layout">
      <section class="game-story"><p class="game-eyebrow">${t('cmStoryEyebrow')}</p><h1>${t('cmStoryTitle')}</h1><p class="game-intro">${t('cmStoryIntro')}</p><div class="game-companion">${jelly(0)}</div><p class="companion-quote"><span class="game-message" role="status" aria-live="polite"><span class="game-message-track"><span class="game-message-text">${t('cmQuoteCalm')}</span></span></span></p></section>
      <section class="game-center" aria-label="${t('cmBoardAria')}">
        <div class="game-board-heading"></div>
        <div class="match-stage"><div class="match-board-wrap"><div class="match-board" role="group" aria-label="${t('cmBoardDesc')}"></div><svg class="match-thread" viewBox="0 0 500 600" preserveAspectRatio="none" aria-hidden="true"><polyline /></svg><div class="match-board-veil" aria-hidden="true"><div class="veil-shimmer"></div><span class="veil-badge"><span class="veil-dot"></span><span>${t('cmSettingJellies')}</span></span></div></div></div>
        <p class="game-help">${t('cmHelp')}</p>
      </section>
      <aside class="game-sidebar"><p class="game-eyebrow"><img class="clock-icon" src="/games/calm-match/clock.webp" width="40" height="40" alt="" draggable="false"><span>${t('cmCountdown')}</span></p><div class="rage-meter-hud game-rage-hud" data-mood="max" aria-label="${t('rageMeterLabel')}" title="${t('rageTitle')}"><div class="rage-hud-avatar-wrap"><div class="rage-hud-avatar" data-state="max" aria-hidden="true"><svg class="rage-avatar-svg" viewBox="0 0 36 36" fill="none"><path class="rage-avatar-body" d="M18 4c-4.4 0-4.7 5.4-7.7 7.4C5.7 14 3.8 18.2 3.8 22.8c0 6.4 5.7 9.5 14.2 9.5s14.2-3.1 14.2-9.5c0-4.6-1.9-8.7-6.5-11.6C22.7 9.4 22.4 4 18 4Z" fill="currentColor" /><circle class="rage-avatar-blush" cx="10" cy="23" r="1.8" fill="#f472b6" opacity="0.65" /><circle class="rage-avatar-blush" cx="26" cy="23" r="1.8" fill="#f472b6" opacity="0.65" /><g class="rage-avatar-eyes"><circle class="rage-eye rage-eye-left" cx="13" cy="20" r="1.7" fill="#1c1917" /><circle class="rage-eye rage-eye-right" cx="23" cy="20" r="1.7" fill="#1c1917" /></g><path class="rage-avatar-mouth" d="M16 23.5q2 2 4 0" stroke="#1c1917" stroke-width="1.6" stroke-linecap="round" fill="none" /><path class="rage-avatar-cross" d="M22 10.5q2-1.5 2 2.5m-3-1q2.5 0 2.5 3m-2.5-3.5q1.5-2 3.5 0" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round" fill="none" /></svg></div></div><div class="rage-hud-track-wrap"><div class="rage-hud-header"><span class="rage-hud-badge">${t('cmRageMax')}</span><span class="rage-hud-percent">100%</span></div><div class="rage-hud-bar-capsule"><canvas class="rage-hud-canvas" width="240" height="32" aria-hidden="true"></canvas><div class="rage-hud-sparkles" aria-hidden="true"></div></div></div></div><div class="game-rage sr-only" hidden><strong>100%</strong><span>${t('rageTitle')}</span></div><progress class="sr-only" max="90" value="90" aria-label="${t('rageTitle')}" hidden></progress><p class="game-goal">${t('cmGoal')}</p><dl class="game-stats"><div><dt>${t('cmStatCleared')}</dt><dd class="stat-cleared"></dd></div><div><dt>${t('cmStatBest')}</dt><dd class="stat-best"></dd></div><div><dt>${t('cmStatMoves')}</dt><dd class="stat-moves"></dd></div></dl><div class="game-tools"><button class="game-hint" type="button" aria-label="${t('cmHintBtn')}"></button><button class="game-sound" type="button" aria-label="${t('cmSoundMuteAria')}"></button><button class="game-restart" type="button" aria-label="${t('cmRestart')}"><img class="game-tool-img" src="/games/calm-match/btn-restart.webp" width="48" height="48" alt="" draggable="false"><span class="game-tool-label">${t('cmRestart')}</span></button></div><p class="game-save-note">${t('cmSaveNote')}</p></aside>
    </div>
    <dialog class="game-win" lang="${lang}"><div>${jelly(0)}</div><p class="game-eyebrow">${t('cmStoryEyebrow')}</p><h2>${t('cmWinTitle')}</h2><p class="win-detail"></p><button class="game-again">${t('cmWinAgain')}</button><a href="/">${t('cmWinHome')}</a></dialog>
    <dialog class="game-confirm" lang="${lang}"><h2>${t('cmConfirmTitle')}</h2><p>${t('cmConfirmNote')}</p><button class="confirm-reset">${t('cmConfirmReset')}</button><button class="cancel-reset">${t('cmConfirmCancel')}</button></dialog>
    <dialog class="game-options" lang="${lang}" aria-label="${t('cmMenuTitle')}"><h2>${t('cmOptionsTitle')}</h2><p>${t('cmOptionsDesc')}</p><div class="options-content"></div><button class="close-options" type="button" aria-label="${t('cmResumeBtn')}"><img class="close-options-img" src="${resumeBtnSrc}" width="240" height="90" alt="${t('cmResumeBtn')}" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';"><span class="close-options-fallback" style="display:none;">${t('cmResumeBtn')}</span></button></dialog>`;
  const $ = s => root.querySelector(s);
  $('.game-hint').innerHTML = controlIcon('hint');
  $('.game-hint').setAttribute('aria-label', t('cmHintBtn'));
  $('.game-hint').title = t('cmHintTitle');
  $('.game-help').insertAdjacentHTML('afterend', `<div class="match-powerups" aria-label="${t('cmToolsAria')}"><button data-tool="coffee" aria-label="${t('cmToolCoffeeAria')}" aria-pressed="false"><img src="/games/calm-match/coffee.webp" width="160" height="160" alt="" draggable="false"><b class="tool-stock">1</b><span class="tool-name">${t('cmToolCoffee')}</span></button><button data-tool="plaster" aria-label="${t('cmToolPlasterAria')}" aria-pressed="false"><img src="/games/calm-match/plaster.webp" width="160" height="160" alt="" draggable="false"><b class="tool-stock">1</b><span class="tool-name">${t('cmToolPlaster')}</span></button><button data-tool="badge" aria-label="${t('cmToolBadgeAria')}" aria-pressed="false"><img src="/games/calm-match/badge.webp" width="160" height="160" alt="" draggable="false"><b class="tool-stock">1</b><span class="tool-name">${t('cmToolBadge')}</span></button></div>`);
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
      $('.game-hint').innerHTML = `<img class="game-tool-img" src="${controlImages.hint}" width="48" height="48" alt="" draggable="false"><span class="game-tool-label">${t('cmHintBtn')}</span>`;
    }
  }
  arrangeMenu(); listen(mobile, 'change', arrangeMenu);
  const rageContainer = $('.game-rage-hud');
  const rageMeter = new RageMeter({ containerId: rageContainer, showMaxPercent: false });
  function getBadgeText(anger) {
    if (anger >= 0.85) return t('cmRageMax');
    if (anger >= 0.50) return t('cmRageHot');
    if (anger >= 0.20) return t('cmRageAnnoyed');
    if (anger > 0) return t('cmRageAlmost');
    return t('cmRageCleared');
  }
  let currentAnger = Math.max(0, (TARGET - state.cleared) / TARGET);
  let currentMood = currentAnger >= 0.85 ? 'max' : currentAnger >= 0.50 ? 'rage' : currentAnger >= 0.20 ? 'annoyed' : 'chill';
  let badgeText = getBadgeText(currentAnger);
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
  let currentSpeech = t('cmQuoteCalm');

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
    const moodNames = { happy: t('cmMoodHappy'), excited: t('cmMoodExcited'), curious: t('cmMoodCurious'), relaxed: t('cmMoodRelaxed'), calm: t('cmMoodCalm') };
    companion.setAttribute('aria-label', `${t('cmMoodLabel')}${moodNames[mood]}`);
    mouth.setAttribute('d', mood === 'excited' ? 'M23 31a1 1.5 0 1 0 2 0a1 1.5 0 1 0-2 0' : 'M22 31q2 2.8 4 0');
    mouth.setAttribute('fill', 'none');
    const quote = { happy: t('cmQuoteHappy'), excited: t('cmQuoteExcited'), curious: t('cmQuoteCurious'), relaxed: t('cmQuoteRelaxed'), calm: t('cmQuoteCalm') };
    const speech = state.cleared === TARGET ? t('cmQuoteWin') : quote[mood];
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
    if (!disposed) message(t('cmMsgRendererFallback'));
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
      const cellLabel = isEn
        ? `Row ${Math.floor(i / COLS) + 1}, column ${i % COLS + 1}, ${names[c]}`
        : `第${Math.floor(i / COLS) + 1}行第${i % COLS + 1}列，${names[c]}`;
      cell.setAttribute('aria-label', cellLabel);
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
    currentMood = currentAnger >= 0.85 ? 'max' : currentAnger >= 0.50 ? 'rage' : currentAnger >= 0.20 ? 'annoyed' : 'chill';
    badgeText = getBadgeText(currentAnger);
    const rageStrong = $('.game-rage strong');
    if (rageStrong) rageStrong.textContent = `${Math.ceil(currentAnger * 100)}%`;
    const prog = $('progress');
    if (prog) prog.value = remaining;
    $('.stat-cleared').textContent = state.cleared;
    $('.stat-best').textContent = state.best;
    $('.stat-moves').textContent = state.moves;
    updateSound();
    if (state.cleared === TARGET) {
      $('.win-detail').textContent = isEn
        ? `Cleared in ${state.moves} moves! Max combo: ${state.best}. You crushed it today!`
        : `用了 ${state.moves} 次消除，最长连起 ${state.best} 只。今天辛苦啦。`;
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
      const toolName = activeTool === 'coffee' ? t('cmToolCoffee') : activeTool === 'plaster' ? t('cmToolPlaster') : (isEn ? 'ID Badge' : '工牌·打卡下班');
      const toolMsg = isEn ? `${toolName} · Release to clear ${path.length}, drag off-grid to cancel.` : `${toolName} · 松手清除 ${path.length} 只，移出棋盘取消。`;
      const linkMsg = path.length < 3
        ? (isEn ? `Linked ${path.length} — chain ${3 - path.length} more to pop!` : `连起 ${path.length} 只，再找一只同色的。`)
        : (isEn ? `Linked ${path.length} · Release to pop!` : `连起 ${path.length} 只 · 松手消消气！`);
      message(activeTool ? toolMsg : linkMsg);
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
    if (!result) { cancel(); message(t('cmMsgNoMatch')); return; }
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
      const popMsg = result.shuffled
        ? t('cmMsgShuffled')
        : tool === 'badge'
          ? (isEn ? `Clocked out! Popped all ${count} matching softies!` : `打卡下班！一键清空 ${count} 只同色软乎乎。`)
          : (isEn ? `Squish! Popped away ${count} stress points.` : `噗叽！消掉 ${count} 点怨气。`);
      message(popMsg);
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
    if (activeTool && cellAt(e.clientX, e.clientY) < 0) { cancel(); message(t('cmMsgToolCancel')); return; }
    commit();
  });
  listen(board, 'focusin', e => {
    const cell = e.target.closest('[data-cell]');
    if (cell) { focus = Number(cell.dataset.cell); board.querySelectorAll('button').forEach((button, i) => button.tabIndex = i === focus ? 0 : -1); }
  });
  listen(root, 'keydown', e => {
    if (e.key === 'Escape' && activeTool && !busy) { e.preventDefault(); cancel(); message(t('cmMsgToolCancel')); }
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
    message(t('cmMsgHintGuide'));
  });
  function updateSound() {
    const btn = $('.game-sound');
    if (!btn) return;
    const icon = sound.enabled ? '/games/calm-match/btn-sound-on.webp' : '/games/calm-match/btn-sound-off.webp';
    const label = sound.enabled ? t('cmSoundOn') : t('cmSoundOff');
    btn.innerHTML = `<img class="game-tool-img" src="${icon}" width="48" height="48" alt="" draggable="false"><span class="game-tool-label">${label}</span>`;
    btn.setAttribute('aria-label', sound.enabled ? t('cmSoundMuteAria') : t('cmSoundUnmuteAria'));
  }
  root.querySelectorAll('[data-tool]').forEach(button => listen(button, 'click', () => {
    if (busy || pointer !== null || state.cleared === TARGET || !state.tools[button.dataset.tool]) return;
    const next = activeTool === button.dataset.tool ? null : button.dataset.tool;
    cancel(); activeTool = next; toolsUI();
    const toolTips = {
      coffee: t('cmToolCoffeeTip'),
      plaster: t('cmToolPlasterTip'),
      badge: t('cmToolBadgeTip'),
    };
    const tipMsg = next
      ? (isEn ? `${toolTips[next]} (tap booster again to cancel).` : `${toolTips[next]}；再次点击道具取消。`)
      : t('cmMsgToolReady');
    message(tipMsg);
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
    badgeText = getBadgeText(currentAnger);
    rageMeter.reset();
    rageMeter.pulse(1.0);
    render();
    message(t('cmMsgNewGame'));
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
  render(); save(); message(restored ? t('cmMsgResumeSaved') : t('cmMsgStartFresh'));
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
