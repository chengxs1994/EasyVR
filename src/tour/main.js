import './style.css';
import { TourViewer } from './viewer.js';
import { FACE_VIEWS } from './view.js';
import { SCENES, TOUR_ID, IS_AI_TOUR } from './scenes.js';
import { projectHotspot, hotspotFromScreen } from './hotspots.js';
import { createEditor } from './editor.js';
import { approachHotspot } from './travel.js';
import { createSceneTransition } from './transition.js';
const $ = id => document.getElementById(id);
let viewer, ready = false, rotating = false, frame = 0, previousTime = 0, toastTimer, capturing = false;
const pointers = new Map();
let pinch = 0;
let activeScene = null, requestedScene = SCENES[0], switching = false, preloadTimer, preloadPromise = null;

/** 為目前點位建立可鍵盤操作的場景入口，與背景拖曳區分離以免誤觸。 */
function renderHotspots(scene) {
  $('hotspots').replaceChildren();
  for (const [index, hotspot] of (editor.routes()[scene.id] ?? []).entries()) {
    const target = SCENES.find(item => item.id === hotspot.target);
    if (!target) continue;
    const button = document.createElement('button');
    button.className = `hotspot hotspot--${hotspot.style}`;
    button.style.setProperty('--point-color', hotspot.color);
    button.style.setProperty('--point-size', `${hotspot.size}px`);
    button.setAttribute('aria-label', `${hotspot.label || '前往' + target.name}（跳转点）`);
    const arrow = document.createElement('span');
    arrow.className = 'hotspot-marker'; arrow.textContent = hotspot.style === 'arrow' ? '⌃' : ''; arrow.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = hotspot.label || `前往${target.name}`;
    button.append(arrow, label);
    button.onclick = () => editor.editing() ? editor.edit(index) : load(target, { yaw: hotspot.entryYaw, pitch: hotspot.entryPitch, fov: hotspot.entryFov }, hotspot);
    enableMarkerDrag(button, index, 'route');
    button.hotspot = hotspot;
    $('hotspots').append(button);
  }
  for (const [index, item] of editor.annotations()[scene.id].entries()) {
    const button = document.createElement('button'); button.className = 'info-marker';
    button.textContent = 'i'; button.setAttribute('aria-label', `信息：${item.title}`);
    button.hotspot = item;
    button.onclick = () => {
      if (editor.editing()) { editor.editInfo(index); return; }
      setRotate(false); $('info-title-view').textContent = item.title; $('info-body-view').textContent = item.body || '暂无补充说明';
      $('info-dialog').showModal();
    };
    enableMarkerDrag(button, index, 'info'); $('hotspots').append(button);
  }
}

/** 編輯模式拖曳標記與全景拖曳互斥；取消不落盤，完成可撤銷。 */
function enableMarkerDrag(button, index, kind) {
  let drag = null, suppressClick = false;
  button.addEventListener('pointerdown', event => {
    if (!ready || !editor.editing() || event.button !== 0) return;
    stopDragRotation();
    drag = { x: event.clientX, y: event.clientY, original: button.hotspot, moved: false };
    button.setPointerCapture(event.pointerId); event.stopPropagation();
  });
  button.addEventListener('pointermove', event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    const box = viewer.host.getBoundingClientRect();
    button.hotspot = { ...drag.original, ...hotspotFromScreen(event.clientX - box.left, event.clientY - box.top, box.width, box.height, viewer.camera) };
    positionHotspots();
  });
  /** 結束拖曳先釋放狀態，避免失去捕獲事件重複提交。 */
  function finish(event) {
    if (!drag) return;
    const previous = drag; drag = null;
    suppressClick = previous.moved;
    if (event.type === 'pointerup' && previous.moved) editor.move(index, button.hotspot, kind);
    else { button.hotspot = previous.original; positionHotspots(); }
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, finish);
  button.addEventListener('click', event => { if (suppressClick) { event.stopImmediatePropagation(); suppressClick = false; } }, true);
}

/** 編輯拖曳開始時停止自動環視，確保定位基準穩定。 */
function stopDragRotation() { setRotate(false); pointers.clear(); }


/** 每次相機渲染後同步熱點位置，縮放與容器尺寸變更亦使用同一投影。 */
function positionHotspots() {
  for (const button of $('hotspots').children) {
    const point = projectHotspot(button.hotspot, viewer.camera, viewer.host.clientWidth, viewer.host.clientHeight);
    button.hidden = !point;
    if (point) { button.style.left = `${point.x}px`; button.style.top = `${point.y}px`; }
  }
}

/** 以可鍵盤操作的縮圖按鈕建立點位導覽，圖片只用作預覽。 */
function renderSceneNav() {
  const nav = $('scene-nav');
  for (const [index, scene] of SCENES.entries()) {
    const button = document.createElement('button');
    button.className = 'scene-option';
    button.dataset.scene = scene.id;
    button.setAttribute('aria-label', `切换到${scene.name}`);
    button.setAttribute('aria-pressed', 'false');
    const image = document.createElement('img');
    image.src = scene.panorama ?? `${scene.base}/tablet_f.jpg`; image.alt = '';
    const label = document.createElement('span'); label.textContent = scene.name;
    const number = document.createElement('small'); number.textContent = String(index + 1).padStart(2, '0');
    button.append(image, number, label);
    button.onclick = () => load(scene);
    nav.append(button);
  }
}

/** 僅在素材成功替換後更新名稱與選中狀態，避免標題與實景錯配。 */
function showScene(scene) {
  document.querySelector('.scene-title h1').textContent = scene.title;
  $('scene-name').textContent = scene.name;
  $('scene-card-name').textContent = scene.name;
  $('scene-card-label').textContent = `${String(SCENES.indexOf(scene) + 1).padStart(2, '0')} / ${scene.label}`;
  $('scene-card-image').src = scene.panorama ?? `${scene.base}/tablet_f.jpg`;
  $('scene-card-image').alt = `${scene.name}前方预览`;
  document.title = `${scene.name} · EasyVR · 全景漫游`;
  renderHotspots(scene);
  document.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === scene.id)));
}

/** 透過可存取的狀態區回報操作結果。 */
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
/** 保持讀取器與方向指示的視角一致。 */
function update(change = {}) {
  const view = viewer.setView({ ...viewer.view, ...change });
  $('heading').textContent = `${String(Math.round(view.yaw) % 360).padStart(3, '0')}°`;
  $('fov-value').textContent = `${Math.round(view.fov)}° 视野`;
  $('needle').style.transform = `rotate(${-view.yaw}deg)`;
  document.querySelectorAll('[data-face]').forEach(button => {
    const [yaw, pitch] = FACE_VIEWS[button.dataset.face];
    const active = pitch ? Math.abs(view.pitch - pitch) < 10 : Math.abs(view.pitch) < 45 && Math.abs(((view.yaw - yaw + 540) % 360) - 180) < 45;
    button.setAttribute('aria-pressed', String(active));
  });
}
/** 自動環視按真實經過時間計算，避免不同刷新率造成速度差異。 */
function animate(time) {
  if (!rotating) return;
  if (previousTime) update({ yaw: viewer.view.yaw + Math.min(time - previousTime, 100) * 0.006 });
  previousTime = time;
  frame = requestAnimationFrame(animate);
}
/** 手動互動或隱藏分頁時停止自動旋轉。 */
function setRotate(value) {
  rotating = value && ready;
  cancelAnimationFrame(frame); previousTime = 0;
  $('rotate').setAttribute('aria-pressed', String(rotating));
  $('rotate').innerHTML = rotating ? 'Ⅱ <span>暂停环视</span>' : '↻ <span>自动环视</span>';
  if (rotating) frame = requestAnimationFrame(animate);
}
/** 僅預備第一個可達入口；有界快取避免一次下載整套房源。 */
function prepareNeighbor(scene) {
  clearTimeout(preloadTimer);
  const targetId = editor.routes()[scene.id]?.[0]?.target;
  const target = SCENES.find(item => item.id === targetId);
  if (!target || target.id === scene.id || preloadPromise) return;
  preloadTimer = setTimeout(() => {
    // 全頁最多一個進行中的預載，避免多個遲到結果淘汰正等待顯示的目標。
    if (!switching && activeScene?.id === scene.id && !preloadPromise) {
      preloadPromise = viewer.prepareScene(target).catch(() => {}).finally(() => { preloadPromise = null; });
    }
  }, 250);
}

/** 串行切換六面素材；熱點優先採用設定的進入視角，首次進入與縮圖採用房間預設視角，失敗保留原場景。 */
async function load(scene = requestedScene, entryView = null, departure = null) {
  if (switching || capturing) return;
  // 底部再次點選目前房間也回到預設視角；入口預覽仍可明確指定取景。
  if (ready && activeScene?.id === scene.id) { setRotate(false); update(entryView ?? editor.sceneView(scene.id)); return; }
  clearTimeout(preloadTimer);
  switching = true; requestedScene = scene;
  const departureView = activeScene ? { ...viewer.view } : null;
  setRotate(false); pointers.clear();
  $('hotspots').hidden = true;
  ready = false; $('loading').hidden = Boolean(activeScene); $('error').hidden = true;
  // 快取命中時不閃現載入提示；慢速下載仍保留舊畫面並顯示進度。
  const loadingTimer = activeScene ? setTimeout(() => { $('loading').hidden = false; }, 700) : null;
  let transition;
  $('loading').classList.toggle('scene-switching', Boolean(activeScene));
  $('loading-title').textContent = `正在前往${scene.name}`;
  document.querySelectorAll('button:not(#retry)').forEach(button => button.disabled = true);
  try {
    viewer ??= new TourViewer($('viewport'));
    viewer.onRender = positionHotspots;
    // 素材下載與轉向同時進行；兩者完成才換背景，失敗先等轉向停止再還原。
    const [asset, approach] = await Promise.allSettled([
      viewer.prepareScene(scene),
      departure ? approachHotspot(departureView, departure, update) : Promise.resolve(),
    ]);
    if (asset.status === 'rejected') throw asset.reason;
    if (approach.status === 'rejected') throw approach.reason;
    if (activeScene) {
      const host = $('viewport');
      // 轉向完成後重新投影入口，讓快照朝實際點位推進；縮圖及機位預覽只淡出。
      transition = createSceneTransition(host, viewer.canvas, {
        forward: Boolean(departure),
        origin: departure ? projectHotspot(departure, viewer.camera, host.clientWidth, host.clientHeight) : null,
      });
    }
    viewer.showPrepared(asset.value);
    activeScene = scene; showScene(scene); editor.refresh();
    update(entryView ?? editor.sceneView(scene.id));
    clearTimeout(loadingTimer); $('loading').hidden = true;
    await transition?.play();
    ready = true; $('connection').textContent = IS_AI_TOUR ? 'AI 场景已就绪' : '实景已就绪';
  } catch (error) {
    console.error('场景切换失败', scene.id, error);
    if (activeScene) {
      if (departureView) update(departureView);
      ready = true; toast(`${scene.name}加载失败，已保留${activeScene.name}，可点击缩略图重试。`);
    } else {
      $('error-text').textContent = error.message || '请检查图片文件和浏览器 WebGL 支持，然后重试。';
      $('error').hidden = false; $('connection').textContent = '加载未完成';
    }
  } finally {
    clearTimeout(loadingTimer); transition?.dispose();
    switching = false; $('loading').hidden = true;
    $('hotspots').hidden = !ready;
    document.querySelectorAll('button:not(#retry)').forEach(button => button.disabled = !ready && !button.dataset.scene);
    if (ready) { editor.syncControls(); prepareNeighbor(activeScene); }
  }
}
/** 兩指距離用於縮放；剩餘單指仍可平順接續拖動。 */
function distance() { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
$('viewport').addEventListener('pointerdown', event => {
  if (!ready) return;
  if (editor.place(event)) { event.preventDefault(); return; }
  setRotate(false); viewer.canvas.focus();
  $('viewport').setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) pinch = distance();
});
$('viewport').addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId) || !ready) return;
  const old = pointers.get(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const next = distance(); if (next > 0 && pinch > 0) update({ fov: viewer.view.fov * pinch / next }); pinch = next;
  } else if (pointers.size === 1) update({ yaw: viewer.view.yaw - (event.clientX - old.x) * viewer.view.fov / innerHeight, pitch: viewer.view.pitch + (event.clientY - old.y) * viewer.view.fov / innerHeight });
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('viewport').addEventListener(name, event => pointers.delete(event.pointerId));
$('viewport').addEventListener('wheel', event => { if (!ready) return; event.preventDefault(); setRotate(false); update({ fov: viewer.view.fov + Math.sign(event.deltaY) * 3 }); }, { passive: false });
$('viewport').addEventListener('keydown', event => {
  if (!ready) return;
  const actions = { ArrowLeft: { yaw: viewer.view.yaw - 3 }, ArrowRight: { yaw: viewer.view.yaw + 3 }, ArrowUp: { pitch: viewer.view.pitch + 3 }, ArrowDown: { pitch: viewer.view.pitch - 3 }, '+': { fov: viewer.view.fov - 3 }, '=': { fov: viewer.view.fov - 3 }, '-': { fov: viewer.view.fov + 3 }, Home: editor.sceneView(activeScene.id) };
  if (actions[event.key]) { event.preventDefault(); setRotate(false); update(actions[event.key]); }
});
document.querySelectorAll('[data-face]').forEach(button => button.onclick = () => { setRotate(false); const [yaw, pitch] = FACE_VIEWS[button.dataset.face]; update({ yaw, pitch }); });
$('rotate').onclick = () => setRotate(!rotating);
$('in').onclick = () => update({ fov: viewer.view.fov - 8 });
$('out').onclick = () => update({ fov: viewer.view.fov + 8 });
$('reset').onclick = () => { setRotate(false); update(editor.sceneView(activeScene.id)); };
$('retry').onclick = () => load();
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('app').requestFullscreen(); }
  catch { toast('当前浏览器不支持全屏，可使用窗口最大化浏览。'); }
};
$('capture').onclick = async () => {
  if (!ready || capturing) return;
  capturing = true; $('capture').disabled = true; setRotate(false);
  try {
    const { blob, width, height } = await viewer.capture();
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${TOUR_ID}-${activeScene.id}-${activeScene.name}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`取景已生成 · ${width} × ${height} PNG`);
  } catch (error) { toast(`无法保存取景：${error.message}`); }
  finally { capturing = false; $('capture').disabled = false; }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) setRotate(false); });
window.addEventListener('pagehide', () => { clearTimeout(preloadTimer); setRotate(false); viewer?.dispose(); });
const editor = createEditor({
  getScene: () => activeScene,
  getView: () => viewer.view,
  change: () => { if (activeScene) { renderHotspots(activeScene); positionHotspots(); } },
  stop: () => setRotate(false), toast, aim: update, navigate: load,
  locate: event => {
    const box = viewer.host.getBoundingClientRect();
    return hotspotFromScreen(event.clientX - box.left, event.clientY - box.top, box.width, box.height, viewer.camera);
  },
});
$('info-close').onclick = () => $('info-dialog').close();
renderSceneNav();
load();

if (IS_AI_TOUR) {
 document.querySelector('.scene-title > p').textContent = 'AI 生成空间 / DEMO';
 document.querySelector('.route-note').textContent = 'AI 草稿 · 空间连接待校准';
 document.querySelector('#loading p').textContent = '正在读取全景素材…';
 document.querySelector('.scene-card span').textContent = '2 个机位 · 可自定义跳转';
}
