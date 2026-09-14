/**
 * softie 消消气 · 游戏资源预加载与状态检验机制
 */

export const CALM_MATCH_IMAGES = [
  '/games/calm-match/logo.webp',
  '/games/calm-match/clock.webp',
  '/games/calm-match/coffee.webp',
  '/games/calm-match/plaster.webp',
  '/games/calm-match/badge.webp',
  '/games/calm-match/btn-restart.webp',
  '/games/calm-match/btn-resume.webp',
  '/games/calm-match/btn-sound-on.webp',
  '/games/calm-match/btn-sound-off.webp',
  '/games/calm-match/dialog-panel.webp',
  '/games/calm-match/background-desktop.webp',
  '/games/calm-match/background-mobile.webp',
];

let imagePreloadPromise = null;
let modulePreloadPromise = null;

/**
 * 预加载单张图片资源，返回就绪状态
 */
function preloadImage(src) {
  if (typeof Image === 'undefined') {
    return Promise.resolve({ src, status: 'headless' });
  }
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ src, status: 'ok' });
    img.onerror = () => resolve({ src, status: 'error' });
    img.src = src;
    if (img.complete) {
      resolve({ src, status: 'cached' });
    }
  });
}

/**
 * 预加载所有核心静态图片资源，支持超时兜底
 */
export function preloadGameImages(timeoutMs = 3000) {
  if (imagePreloadPromise) return imagePreloadPromise;

  const loadAll = Promise.allSettled(CALM_MATCH_IMAGES.map(preloadImage));
  const timeout = new Promise(resolve => setTimeout(() => resolve([{ status: 'timeout' }]), timeoutMs));

  imagePreloadPromise = Promise.race([loadAll, timeout]);
  return imagePreloadPromise;
}

/**
 * 预热 3D 渲染核心代码模块
 */
export function preloadGameModules() {
  if (modulePreloadPromise) return modulePreloadPromise;
  modulePreloadPromise = Promise.allSettled([
    import('./companion.js'),
    import('./jelly-board.js'),
  ]);
  return modulePreloadPromise;
}

/**
 * 全量预加载检验（图片 + 模块）
 */
export async function preloadGameAssets(options = {}) {
  const { timeoutMs = 3000 } = options;
  const [images] = await Promise.all([
    preloadGameImages(timeoutMs),
    preloadGameModules(),
  ]);
  return { ready: true, images };
}

/**
 * 注册首页空闲预热（首页载入 1.2 秒后利用 requestIdleCallback 静默缓存）
 */
export function registerIdlePreload() {
  if (typeof window === 'undefined') return () => {};
  let timer = null;
  const run = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => preloadGameAssets({ timeoutMs: 5000 }), { timeout: 4000 });
    } else {
      preloadGameAssets({ timeoutMs: 5000 });
    }
  };
  timer = setTimeout(run, 1200);
  return () => clearTimeout(timer);
}
