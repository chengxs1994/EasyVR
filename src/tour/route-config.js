import { SCENES, TOUR_ID } from './scenes.js';
import { DEFAULT_TOUR } from './default-tour.js';
export const STORAGE_KEY = `easyvr.tour:${TOUR_ID}:routes:v1`;

/** 配置與房源綁定，拒絕未知點位與非法角度，避免匯入後產生無效入口。 */
export function validateConfig(value) {
  if (value?.version !== 1 || value.propertyId !== TOUR_ID || !value.routes || typeof value.routes !== 'object' || Array.isArray(value.routes)) throw new Error('配置版本或房源不匹配');
  const ids = SCENES.map(scene => scene.id), routes = {};
  if (Object.keys(value.routes).some(id => !ids.includes(id))) throw new Error('包含未知来源点位');
  for (const id of ids) {
    const links = value.routes[id];
    if (!Array.isArray(links) || links.length > 30) throw new Error('每个点位需提供数组，最多 30 个热点');
    routes[id] = links.map(link => {
      if (!link || !ids.includes(link.target) || link.target === id) throw new Error('热点目标无效，不能指向自身');
      // 舊版本配置缺少外觀欄位時套用圓環，不覆蓋既有位置與進入方向。
      const label = link.label ?? '', style = link.style ?? 'ring', color = link.color ?? '#ffffff', size = link.size ?? 42;
      if (typeof label !== 'string' || label.length > 24 || !['ring','arrow'].includes(style) || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color) || !Number.isFinite(size) || size < 24 || size > 80) throw new Error('热点名称或样式无效');
      const entryFov = link.entryFov ?? 65;
      if (!Number.isFinite(entryFov) || entryFov < 25 || entryFov > 95) throw new Error('切入视野需在 25–95 度之间');
      const result = { target: link.target, label, style, color, size, entryFov };
      for (const [key, min, max] of [['yaw',0,360],['pitch',-89,89],['entryYaw',0,360],['entryPitch',-89,89]]) {
        const n = link[key];
        if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${key} 角度超出范围`);
        result[key] = n;
      }
      return result;
    });
  }
  const annotations = {}, raw = value.annotations ?? {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(id => !ids.includes(id))) throw new Error('信息标签场景无效');
  for (const id of ids) {
    const items = raw[id] ?? [];
    if (!Array.isArray(items) || items.length > 30) throw new Error('每个房间最多 30 个信息标签');
    annotations[id] = items.map(item => {
      if (!item || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 40 || typeof item.body !== 'string' || item.body.length > 1000 || !Number.isFinite(item.yaw) || item.yaw < 0 || item.yaw > 360 || !Number.isFinite(item.pitch) || Math.abs(item.pitch) > 89) throw new Error('信息标签内容或位置无效');
      return { title: item.title.trim(), body: item.body, yaw: item.yaw, pitch: item.pitch };
    });
  }
  // 舊配置未設定房間視角時使用專案預設值，不沿用上一個訪客的瀏覽角度。
  const sceneViews = {}, rawViews = value.sceneViews ?? {};
  if (!rawViews || typeof rawViews !== 'object' || Array.isArray(rawViews) || Object.keys(rawViews).some(id => !ids.includes(id))) throw new Error('房间默认视角配置无效');
  for (const id of ids) {
    const view = rawViews[id] ?? DEFAULT_TOUR.sceneViews?.[id] ?? { yaw: 0, pitch: 0, fov: 65 };
    if (!view || !Number.isFinite(view.yaw) || view.yaw < 0 || view.yaw > 360 || !Number.isFinite(view.pitch) || Math.abs(view.pitch) > 89 || !Number.isFinite(view.fov) || view.fov < 25 || view.fov > 95) throw new Error('房间默认视角超出范围');
    sceneViews[id] = { yaw: view.yaw, pitch: view.pitch, fov: view.fov };
  }
  return { version: 1, propertyId: TOUR_ID, routes, annotations, sceneViews };
}

/** 回傳已校驗的獨立副本，編輯本機配置不改寫專案預設值。 */
export function defaultConfig() {
  return validateConfig(structuredClone(DEFAULT_TOUR));
}
