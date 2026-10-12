import { normalizeView } from './model.js';

/** 创建独立位置，取景与热点均归属于该位置。 */
export function createScene(source = null, name = '方位演示全景') {
  return {
    id: crypto.randomUUID(),
    source,
    name,
    view: normalizeView(),
    arrival: normalizeView(),
    shots: [],
    hotspots: [],
  };
}
/** 将原来的单全景存档迁移为多位置漫游，保留图片与取景。 */
export function restoreTour(saved) {
  if (saved?.scenes?.length) {
    const scenes = saved.scenes.map((scene) => ({
      ...scene,
      view: normalizeView(scene.view),
      arrival: normalizeView(scene.arrival),
      hotspots: scene.hotspots || [],
    }));
    return { scenes, activeId: scenes.some((s) => s.id === saved.activeId) ? saved.activeId : scenes[0].id };
  }
  const scene = { ...createScene(), ...(saved?.view && Array.isArray(saved.shots) ? saved : {}) };
  return { scenes: [scene], activeId: scene.id };
}
/** 删除位置同时清理指向它的热点，保留至少一个可进入的位置。 */
export function removeScene(tour, id) {
  if (tour.scenes.length <= 1) return false;
  tour.scenes = tour.scenes.filter((s) => s.id !== id);
  for (const scene of tour.scenes) scene.hotspots = scene.hotspots.filter((h) => h.targetId !== id);
  if (tour.activeId === id) tour.activeId = tour.scenes[0].id;
  return true;
}
