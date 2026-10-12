import { validateProject, validateCamera } from './project.js';

/** 保存或更新当前机位，机位仅保存摄影机参数，不复制场景对象。 */
export function saveNamedCamera(scene, name, thumbnail, id = '') {
  const next = validateProject(scene);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40)
    throw new Error('请输入 1–40 字的机位名称');
  const existing = next.cameraLibrary.find((c) => c.id === id);
  if (id && !existing) throw new Error('这个机位已不存在');
  const entry = {
    id: id || crypto.randomUUID(),
    name: name.trim(),
    thumbnail,
    camera: validateCamera(next.camera),
  };
  entry.camera.preset = entry.name;
  if (existing) next.cameraLibrary[next.cameraLibrary.indexOf(existing)] = entry;
  else next.cameraLibrary.push(entry);
  return { scene: validateProject(next), id: entry.id };
}
/** 将选中机位应用到当前场景，演员站位与其他对象不变。 */
export function activateNamedCamera(scene, id) {
  const next = validateProject(scene),
    entry = next.cameraLibrary.find((c) => c.id === id);
  if (!entry) throw new Error('这个机位已不存在');
  next.camera = structuredClone(entry.camera);
  return next;
}
