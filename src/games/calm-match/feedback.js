import { sound } from '../../sound.js';

export const chainTier = count => count >= 7 ? 2 : count >= 5 ? 1 : 0;
export function chainFrequency(count) {
  const step = Math.max(0, Math.min(14, count - 1));
  return 261.63 * 2 ** (([0, 2, 4, 7, 9][step % 5] + Math.floor(step / 5) * 12) / 12);
}

// Share the homepage's mute/volume bus; bound voices and dispose on route exit.
export function createFeedback() {
  const voices = new Set();
  let last = -Infinity;
  function tone(frequency, delay = 0, duration = .16, volume = .2) {
    if (!sound.enabled) return;
    const ctx = sound.init();
    if (!ctx || voices.size >= 12) return;
    sound.resume();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(frequency * .8, t);
    osc.frequency.exponentialRampToValueAtTime(frequency, t + .025);
    gain.gain.setValueAtTime(.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + .008);
    gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(gain); gain.connect(sound.filter);
    const voice = { osc, gain };
    voices.add(voice);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); voices.delete(voice); };
    osc.start(t); osc.stop(t + duration + .01);
  }
  function vibrate(pattern) {
    if (!matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { navigator.vibrate?.(pattern); } catch { /* Unsupported devices keep audio/visual feedback. */ }
  }
  return {
    step(count) {
      const now = performance.now();
      if (now - last < 35) return;
      last = now;
      tone(chainFrequency(count));
      vibrate(count >= 7 ? [18, 16, 18] : 18);
    },
    pop(count) {
      tone(180, 0, .22, .3);
      for (let i = 0; i <= chainTier(count); i++) tone([523.25, 659.25, 783.99][i], .025 + i * .035, .2, .12);
      vibrate(count >= 7 ? [24, 30, 24] : 22);
    },
    dispose() {
      for (const { osc, gain } of voices) { osc.onended = null; osc.stop(); osc.disconnect(); gain.disconnect(); }
      voices.clear();
      try { navigator.vibrate?.(0); } catch { /* Optional haptics. */ }
    },
  };
}
