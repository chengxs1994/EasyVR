export const RATIOS = { '16:9': 16 / 9, '9:16': 9 / 16, '3:4': 3 / 4, '1:1': 1 };
/** 统一相机角度与视野边界，避免旋转溢出或越过球体极点。 */
export function normalizeView(view = {}) {
  const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return {
    yaw: ((finite(view.yaw, 0) % 360) + 360) % 360,
    pitch: Math.max(-85, Math.min(85, finite(view.pitch, 0))),
    fov: Math.max(20, Math.min(100, finite(view.fov, 65))),
    ratio: Object.hasOwn(RATIOS, view.ratio) ? view.ratio : '16:9',
  };
}
/** 以长边限制导出分辨率，横竖画幅均不会超出所选规格。 */
export function frameSize(ratio, longEdge = 1920) {
  const aspect = RATIOS[ratio] || RATIOS['16:9'];
  return aspect >= 1
    ? { width: longEdge, height: Math.round(longEdge / aspect) }
    : { width: Math.round(longEdge * aspect), height: longEdge };
}
/** 将固定比例取景框完整放入可用视口，不裁掉导出的画面。 */
export function fitFrame(width, height, ratio) {
  const aspect = RATIOS[ratio] || RATIOS['16:9'];
  return width / height > aspect
    ? { width: Math.floor(height * aspect), height: Math.floor(height) }
    : { width: Math.floor(width), height: Math.floor(width / aspect) };
}
