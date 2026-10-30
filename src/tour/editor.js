import { ConfigHistory } from './history.js';
import { SCENES, TOUR_ID } from './scenes.js';
import { STORAGE_KEY, validateConfig, defaultConfig } from './route-config.js';

/** 管理本機路線設定；只有成功寫入儲存後才替換生效配置。 */
export function createEditor({ getScene, getView, change, stop, toast, locate, aim, navigate }) {
  let config = defaultConfig(), selected = -1, picking = false, preview = null;
  const $ = id => document.getElementById(id);
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) config = validateConfig(JSON.parse(raw)); }
  catch { setTimeout(() => toast('本机配置无法读取，已使用项目默认配置'), 500); }

  const history = new ConfigHistory(config, next => localStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
  let selectedInfo = -1;

  /** 先校驗並持久化，儲存失敗時保留原配置與編輯表單。 */
  function commit(next) {
    const checked = validateConfig(next);
    history.commit(checked);
    config = history.value; change(); refresh();
  }
  /** 切換來源場景後重建清單，未儲存的表單不跨場景套用。 */
  function refresh() {
    if (preview) return;
    const scene = getScene(); if (!scene) return;
    selected = -1;
    if (picking) cancelPick();
    $('editor-source').textContent = scene.name;
    const view = config.sceneViews[scene.id];
    $('scene-view-summary').textContent = `方向 ${view.yaw.toFixed(1)}° · 俯仰 ${view.pitch.toFixed(1)}° · 视野 ${view.fov.toFixed(1)}°`;
    $('hotspot-list').replaceChildren(new Option('新增热点', '-1'));
    config.routes[scene.id].forEach((link, i) => $('hotspot-list').add(new Option(`${i + 1}. ${link.label || '前往' + SCENES.find(s => s.id === link.target).name}`, String(i))));
    $('hotspot-target').replaceChildren(...SCENES.filter(s => s.id !== scene.id).map(s => new Option(s.name, s.id)));
    $('hotspot-form').reset();
    $('info-list').replaceChildren(new Option('新增信息标签', '-1'));
    config.annotations[scene.id].forEach((item, i) => $('info-list').add(new Option(item.title, String(i))));
    selectedInfo = -1; $('info-form').reset();
    syncControls();
  }
  /** 載入既有熱點供定位、改目標或刪除，不立即修改生效資料。 */
  function select() {
    selected = Number($('hotspot-list').value);
    const link = config.routes[getScene().id][selected];
    syncControls();
    if (!link) { $('hotspot-form').reset(); return; }
    $('hotspot-target').value = link.target;
    $('hotspot-label').value = link.label;
    $('hotspot-style').value = link.style;
    $('hotspot-color').value = link.color;
    $('hotspot-size').value = link.size;
    for (const key of ['yaw','pitch','entryYaw','entryPitch','entryFov']) $(key).value = link[key];
  }
  /** 同步模式入口文案，明示編輯時點位只供選取，完成後才用於跳轉。 */
  function setEditorOpen(open) {
    $('editor').hidden = !open;
    $('editor-toggle').setAttribute('aria-expanded', String(open));
    $('editor-toggle').textContent = open ? '完成編輯・開始漫遊' : '＋ 自訂點位';
  }
  /** 點選既有標記直接編輯，定位模式則只消耗下一次畫面點擊。 */
  function edit(index) {
    stop(); setEditorOpen(true);
    $('hotspot-list').value = String(index); select();
  }
  /** 取消取點時保留尚未儲存的表單。 */
  function cancelPick() {
    picking = false; $('placement-help').hidden = true; $('app').classList.remove('placing');
    $('editor').hidden = false;
  }
  $('pick-position').onclick = () => {
    stop(); picking = 'route'; $('editor').hidden = true; $('placement-help').hidden = false; $('app').classList.add('placing');
  };
  $('cancel-placement').onclick = cancelPick;
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && picking) cancelPick(); });
  $('locate-hotspot').onclick = () => {
    if (!$('yaw').checkValidity() || !$('pitch').checkValidity()) return;
    stop(); aim({ yaw: Number($('yaw').value), pitch: Number($('pitch').value) });
  };
  /** 目標機位調整保留來源表單；返回成功後才套用取景，避免寫入錯誤來源。 */
  async function finishPreview(apply) {
    if (!preview) return;
    stop();
    const view = { ...getView() }, source = preview;
    await navigate(source.scene, source.view);
    if (getScene().id !== source.scene.id) { toast('返回来源失败，请重试'); return; }
    preview = null; $('entry-preview').hidden = true; $('app').classList.remove('entry-previewing');
    $('editor').hidden = false;
    if (apply) {
      $('entryYaw').value = view.yaw.toFixed(1);
      $('entryPitch').value = Math.max(-89, Math.min(89, view.pitch)).toFixed(1);
      $('entryFov').value = view.fov.toFixed(1);
      toast('已取切入机位，点击保存热点后生效');
    }
  }
  $('preview-entry').onclick = async () => {
    if (!['entryYaw','entryPitch','entryFov'].every(key => $(key).reportValidity())) return;
    const target = SCENES.find(scene => scene.id === $('hotspot-target').value);
    if (!target || preview) return;
    stop(); preview = { scene: getScene(), view: { ...getView() } };
    $('editor').hidden = true; $('app').classList.add('entry-previewing');
    $('entry-preview-name').textContent = target.name;
    await navigate(target, { yaw: Number($('entryYaw').value), pitch: Number($('entryPitch').value), fov: Number($('entryFov').value) });
    if (getScene().id !== target.id) {
      preview = null; $('editor').hidden = false; $('app').classList.remove('entry-previewing'); return;
    }
    $('entry-preview').hidden = false;
  };
  $('entry-apply').onclick = () => finishPreview(true);
  $('entry-cancel').onclick = () => finishPreview(false);
  $('editor-toggle').onclick = () => {
    if (preview) return;
    if (picking) { cancelPick(); return; }
    const opening = $('editor').hidden;
    setEditorOpen(opening);
    if (opening) { stop(); refresh(); }
  };
  $('editor-close').onclick = () => { setEditorOpen(false); $('editor-toggle').focus(); };
  $('hotspot-list').onchange = select;
  $('use-center').onclick = () => {
    stop(); const view = getView();
    $('yaw').value = view.yaw.toFixed(1);
    $('pitch').value = Math.max(-89, Math.min(89, view.pitch)).toFixed(1);
    toast('已取画面中心位置，点击保存后生效');
  };
  $('hotspot-form').onsubmit = event => {
    event.preventDefault();
    try {
      const link = { target: $('hotspot-target').value, label: $('hotspot-label').value.trim(), style: $('hotspot-style').value, color: $('hotspot-color').value, size: Number($('hotspot-size').value) };
      for (const key of ['yaw','pitch','entryYaw','entryPitch','entryFov']) link[key] = Number($(key).value);
      const next = structuredClone(config), links = next.routes[getScene().id];
      if (selected < 0) links.push(link); else links[selected] = link;
      commit(next); toast('熱點已儲存；點「完成編輯・開始漫遊」後可點擊跳轉');
    } catch (error) { toast(`保存失败：${error.message}`); }
  };
  $('hotspot-delete').onclick = () => {
    if (selected < 0) return;
    try { const next = structuredClone(config); next.routes[getScene().id].splice(selected,1); commit(next); toast('热点已删除'); }
    catch (error) { toast(`删除失败：${error.message}`); }
  };
  /** 統一更新可操作狀態，避免場景載入結束後啟用無效按鈕。 */
  function syncControls() {
    $('hotspot-delete').disabled = selected < 0;
    $('hotspot-copy').disabled = selected < 0;
    $('hotspot-return').disabled = selected < 0;
    $('info-delete').disabled = selectedInfo < 0;
    $('undo').disabled = !history.past.length;
    $('redo').disabled = !history.future.length;
  }
  /** 套用歷史快照前先保存，失敗不移動歷史游標。 */
  function restore(direction) {
    try { history[direction](); config = history.value; change(); refresh(); toast(direction === 'undo' ? '已撤销上次保存操作' : '已重做'); }
    catch (error) { toast(`操作失败：${error.message}`); }
  }
  $('undo').onclick = () => restore('undo');
  $('redo').onclick = () => restore('redo');
  $('hotspot-copy').onclick = () => {
    if (selected < 0) return;
    selected = -1; $('hotspot-list').value = '-1';
    $('hotspot-label').value = ($('hotspot-label').value || '跳转点').slice(0, 21) + '副本';
    syncControls(); toast('已复制到草稿，请调整位置后保存');
  };
  $('hotspot-return').onclick = async () => {
    if (selected < 0) return;
    const source = getScene(), sourceView = { ...getView() }, link = config.routes[source.id][selected];
    const target = SCENES.find(scene => scene.id === link.target);
    await navigate(target, { yaw: link.entryYaw, pitch: link.entryPitch, fov: link.entryFov });
    if (getScene().id !== target.id) return;
    $('hotspot-target').value = source.id;
    $('hotspot-label').value = `返回${source.name}`;
    $('entryYaw').value = sourceView.yaw.toFixed(1); $('entryPitch').value = Math.max(-89, Math.min(89, sourceView.pitch)).toFixed(1); $('entryFov').value = sourceView.fov.toFixed(1);
    toast('返回入口草稿已准备，请在画面选位置并保存');
  };
  /** 標籤內容視為純文字，顯示端不解析 HTML。 */
  function editInfo(index) {
    stop(); setEditorOpen(true);
    $('info-section').open = true; selectedInfo = index; $('info-list').value = String(index);
    const item = config.annotations[getScene().id][index];
    if (item) { $('info-title').value = item.title; $('info-body').value = item.body; $('info-yaw').value = item.yaw; $('info-pitch').value = item.pitch; }
    else $('info-form').reset();
    syncControls();
  }
  $('info-list').onchange = () => editInfo(Number($('info-list').value));
  $('info-pick').onclick = () => { stop(); picking = 'info'; $('editor').hidden = true; $('placement-help').hidden = false; $('app').classList.add('placing'); };
  $('info-form').onsubmit = event => {
    event.preventDefault();
    try {
      const next = structuredClone(config), items = next.annotations[getScene().id];
      const item = { title: $('info-title').value.trim(), body: $('info-body').value.trim(), yaw: Number($('info-yaw').value), pitch: Number($('info-pitch').value) };
      if (selectedInfo < 0) items.push(item); else items[selectedInfo] = item;
      commit(next); toast('信息标签已保存');
    } catch (error) { toast(`保存失败：${error.message}`); }
  };
  $('info-delete').onclick = () => {
    if (selectedInfo < 0) return;
    try { const next = structuredClone(config); next.annotations[getScene().id].splice(selectedInfo,1); commit(next); toast('信息标签已删除'); }
    catch (error) { toast(`删除失败：${error.message}`); }
  };
  $('scene-view-save').onclick = () => {
    try {
      stop(); const view = getView(), next = structuredClone(config);
      next.sceneViews[getScene().id] = { yaw: Number(view.yaw.toFixed(1)), pitch: Number(Math.max(-89, Math.min(89, view.pitch)).toFixed(1)), fov: Number(view.fov.toFixed(1)) };
      commit(next); toast('已保存房间默认视角，首次进入及底部切换均使用它');
    } catch (error) { toast(`保存失败：${error.message}`); }
  };
  $('scene-view-preview').onclick = () => { stop(); aim(config.sceneViews[getScene().id]); };
  $('route-export').onclick = () => {
    $('route-json').value = JSON.stringify(config, null, 2);
    const url = URL.createObjectURL(new Blob([$('route-json').value], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${TOUR_ID}-routes.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000); toast('配置已导出，也可复制下方 JSON');
  };
  $('route-import').onclick = () => {
    try { if ($('route-json').value.length > 100000) throw new Error('配置过大'); commit(JSON.parse($('route-json').value)); toast('配置已导入并保存至本机'); }
    catch (error) { toast(`导入失败：${error.message}`); }
  };
  return {
    sceneView: id => ({ ...config.sceneViews[id] }), routes: () => config.routes, annotations: () => config.annotations, refresh, syncControls, editInfo,
    editing: () => !$('editor').hidden,
    edit,
    /** 拖動結束只保存位置，取消拖動時由顯示端恢復原座標。 */
    move(index, point, kind) {
      try {
        const next = structuredClone(config), items = kind === 'info' ? next.annotations[getScene().id] : next.routes[getScene().id];
        Object.assign(items[index], { yaw: Number(point.yaw.toFixed(1)), pitch: Number(point.pitch.toFixed(1)) });
        commit(next); toast('位置已保存，可撤销');
      } catch (error) { change(); toast(`移动失败：${error.message}`); }
    },
    /** 取點後僅填入表單，明確保存才寫入本機。 */
    place(event) {
      if (!picking) return false;
      const point = locate(event);
      const prefix = picking === 'info' ? 'info-' : '';
      $(prefix + 'yaw').value = point.yaw.toFixed(1); $(prefix + 'pitch').value = point.pitch.toFixed(1);
      cancelPick(); toast('位置已选定，可设置名称和样式后保存');
      return true;
    },
  };
}
