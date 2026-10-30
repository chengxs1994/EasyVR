/** 熱點以入口為中心推進後淡出，縮圖僅淡出；新背景保持不透明，避免黑閃。 */
export function createSceneTransition(host, canvas, { forward = false, origin = null } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return { play: async () => {}, dispose: () => {} };
  const cover = document.createElement('canvas');
  // 快照只供短暫過渡，限制高 DPI 複製成本，不影響原始全景與匯出解析度。
  const ratio = Math.min(1, (host.clientWidth || canvas.width) * 1.25 / canvas.width);
  cover.width = Math.max(1, Math.round(canvas.width * ratio));
  cover.height = Math.max(1, Math.round(canvas.height * ratio));
  cover.className = 'scene-transition'; cover.setAttribute('aria-hidden', 'true');
  // 推進中心沿用轉向後的熱點投影，避免點擊側邊入口卻朝畫面正中放大。
  cover.style.transformOrigin = '50% 50%';
  if (forward && Number.isFinite(origin?.x) && Number.isFinite(origin?.y) && host.clientWidth > 0 && host.clientHeight > 0) {
    const x = Math.max(0, Math.min(100, origin.x / host.clientWidth * 100));
    const y = Math.max(0, Math.min(100, origin.y / host.clientHeight * 100));
    cover.style.transformOrigin = `${x}% ${y}%`;
  }
  const context = cover.getContext('2d');
  if (!context) return { play: async () => {}, dispose: () => {} };
  context.drawImage(canvas, 0, 0, cover.width, cover.height);
  host.append(cover);
  let animation = null;
  /** 分頁隱藏時直接完成過渡，不等待被瀏覽器暫停的動畫時鐘。 */
  function onVisibility() { if (document.hidden) animation?.finish(); }
  return {
    /** 前段保留來源畫面形成靠近感，後段持續推進並融合目標，不在交接處停住。 */
    async play() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
      animation = cover.animate(
        forward ? [
          { opacity: 1, transform: 'scale(1)', offset: 0 },
          { opacity: 1, transform: 'scale(1.32)', offset: .4 },
          { opacity: .32, transform: 'scale(1.6)', offset: .75 },
          { opacity: 0, transform: 'scale(1.8)', offset: 1 },
        ] : [{ opacity: 1 }, { opacity: 0 }],
        { duration: forward ? 1200 : 520, easing: forward ? 'cubic-bezier(.42,0,.58,1)' : 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
      );
      document.addEventListener('visibilitychange', onVisibility);
      try { await animation.finished; }
      catch { /* 取消動畫時仍由 finally 清理資源。 */ }
      finally { document.removeEventListener('visibilitychange', onVisibility); }
    },
    /** 成功、失敗或取消均移除快照與樣式，下一次互動不受過渡影響。 */
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      animation?.cancel(); cover.remove(); cover.width = cover.height = 0;
    },
  };
}
