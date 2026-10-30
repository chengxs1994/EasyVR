/** 先小幅朝向入口；視野保持不變，向前推進交給後續過渡連續完成。 */
export function travelView(start, hotspot, progress) {
  const delta = ((hotspot.yaw - start.yaw + 540) % 360) - 180;
  const turn = Math.max(-28, Math.min(28, delta));
  const tilt = Math.max(-6, Math.min(6, hotspot.pitch - start.pitch));
  const t = Math.max(0, Math.min(1, progress)), eased = t * t * (3 - 2 * t);
  return { yaw: start.yaw + turn * eased, pitch: start.pitch + tilt * eased, fov: start.fov };
}

/** 轉向與螢幕刷新同步；背景分頁及減少動態效果直接略過，避免卡住切換。 */
export async function approachHotspot(start, hotspot, update) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
  await new Promise((resolve, reject) => {
    let began = null, frame = null, finished = false;
    /** 完成或失敗均釋放動畫幀及可見性監聽，防止下一場景收到舊更新。 */
    function finish(error) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      if (error) reject(error); else resolve();
    }
    /** 依真實幀時間內插，首幀建立起點，避免排程延遲吞掉開頭動畫。 */
    function step(time) {
      if (finished) return;
      began ??= time;
      const progress = Math.min(1, (time - began) / 240);
      try { update(travelView(start, hotspot, progress)); }
      catch (error) { finish(error); return; }
      if (progress === 1) finish(); else frame = requestAnimationFrame(step);
    }
    /** 切到背景時保留當前視角，交由場景切換完成後設定目標視角。 */
    function onVisibility() { if (document.hidden) finish(); }
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(step);
  });
}
