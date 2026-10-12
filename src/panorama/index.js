import { uiText } from '../i18n.js';
import './style.css';
import { createScene, restoreTour, removeScene } from './tour.js';
import { PanoramaViewer, demoPanorama } from './viewer.js';
import { normalizeView, fitFrame, frameSize } from './model.js';
import { openPanoramaStore } from './store.js';

const root = document.getElementById('app');
document.title = '全景场景取景器 · EasyVR';
root.innerHTML = `<div class="pano-app"><header><a href="/" class="pano-brand">EasyVR <small><span data-ui="全景">全景</span></small></a><span class="pano-divider"></span><strong><span data-ui="全景场景取景器">全景场景取景器</span></strong><span class="pano-tag"><span data-ui="独立模块">独立模块</span></span><a href="/?tour=home"><span data-ui="住宅实景全屏浏览 ↗">住宅实景全屏浏览 ↗</span></a><a href="/?editor=1&backdrop=home"><span data-ui="住宅实景空间推演 ↗">住宅实景空间推演 ↗</span></a><span id="save-state"><span data-ui="正在读取本机存档">正在读取本机存档</span></span><a href="/"><span data-ui="全景首页 ↗">全景首页 ↗</span></a></header><div class="pano-layout"><aside class="pano-settings"><p class="eyebrow"><span data-ui="01 / 场景素材">01 / 场景素材</span></p><h1><span data-ui="换一个角度">换一个角度</span><br><span data-ui="发现下一个镜头。">发现下一个镜头。</span></h1><label class="upload-area"><span data-ui="＋ 添加全景位置">＋ 添加全景位置</span><input id="upload" type="file" accept="image/png,image/jpeg,image/webp" hidden><small><span data-ui="PNG / JPG / WebP · 最大 30 MB">PNG / JPG / WebP · 最大 30 MB</span></small></label><label><span data-ui="当前位置">当前位置</span><select id="scene-select"></select></label><input id="scene-name" aria-label="位置名称" data-ui-aria-label="位置名称" maxlength="60"><button id="delete-scene"><span data-ui="删除此位置">删除此位置</span></button><strong id="source-name"><span data-ui="方位演示全景">方位演示全景</span></strong><p class="muted" id="source-info"><span data-ui="建议使用 2:1 等距柱状全景图。">建议使用 2:1 等距柱状全景图。</span></p><button id="demo"><span data-ui="添加演示位置">添加演示位置</span></button><hr><p class="eyebrow"><span data-ui="位置连接 / 漫游热点">位置连接 / 漫游热点</span></p><label><span data-ui="前往位置">前往位置</span><select id="target-scene"></select></label><button id="add-hotspot"><span data-ui="＋ 在画面中心添加热点">＋ 在画面中心添加热点</span></button><button id="arrival"><span data-ui="设为此位置的到达视角">设为此位置的到达视角</span></button><p class="muted"><span data-ui="先对准门口或通道，再添加热点。点击画面中的箭头即可前往。">先对准门口或通道，再添加热点。点击画面中的箭头即可前往。</span></p><div id="hotspot-list"></div><hr><p class="eyebrow"><span data-ui="02 / 取景参数">02 / 取景参数</span></p><label><span data-ui="输出画幅">输出画幅</span><select id="ratio"><option>16:9</option><option>9:16</option><option>3:4</option><option>1:1</option></select></label><label><span data-ui="水平角度">水平角度 </span><output id="yaw-value"></output><input id="yaw" type="range" min="0" max="359" step="1"></label><label><span data-ui="俯仰角度">俯仰角度 </span><output id="pitch-value"></output><input id="pitch" type="range" min="-85" max="85" step="1"></label><label><span data-ui="垂直视野">垂直视野 </span><output id="fov-value"></output><input id="fov" type="range" min="20" max="100" step="1"></label><button id="reset"><span data-ui="重置视角">重置视角</span></button><label class="check"><input id="guides" type="checkbox" checked><span data-ui="显示三分构图线">显示三分构图线</span></label><hr><p class="eyebrow"><span data-ui="03 / 输出画面">03 / 输出画面</span></p><label><span data-ui="输出长边">输出长边</span><select id="resolution"><option value="1920">1920 px</option><option value="3840">3840 px</option></select></label><p class="muted"><span data-ui="高分辨率导出不会增加原图细节。取景图片不包含辅助线。">高分辨率导出不会增加原图细节。取景图片不包含辅助线。</span></p></aside><main class="pano-stage"><div class="stage-top"><button id="demo-tour"><span data-ui="体验三点漫游">体验三点漫游</span></button><span><i></i><span data-ui="PANORAMA / 环视取景"> PANORAMA / 环视取景</span></span><span id="frame-spec">16:9</span></div><div id="viewport"><div id="frame"><div id="render-host"></div><div id="hotspots"></div><div id="grid"><i></i><i></i><i></i><i></i></div><span class="frame-corner tl"></span><span class="frame-corner tr"></span><span class="frame-corner bl"></span><span class="frame-corner br"></span></div></div><div class="stage-bottom"><p><span data-ui="拖拽环视 · 滚轮变焦 · 聚焦画面后方向键微调">拖拽环视 · 滚轮变焦 · 聚焦画面后方向键微调</span></p><div><button id="download"><span data-ui="导出当前画面">导出当前画面</span></button><button id="capture" class="primary"><span data-ui="＋ 保存取景">＋ 保存取景</span></button></div></div><p id="message" role="status"><span data-ui="图片仅保存在本机浏览器，不会上传至服务器。">图片仅保存在本机浏览器，不会上传至服务器。</span></p></main><aside class="pano-library"><div class="library-heading"><div><p class="eyebrow">SHOT COLLECTION</p><h2><span data-ui="取景库">取景库 </span><span id="count">00</span></h2></div></div><p class="muted"><span data-ui="点击画面恢复角度。最多保存 20 个取景。">点击画面恢复角度。最多保存 20 个取景。</span></p><div id="shots"></div></aside></div></div>`;
const $ = (id) => document.getElementById(id);
let tour = restoreTour(null);
let viewer,
  store,
  state = tour.scenes[0],
  busy = true,
  pending = Promise.resolve(),
  timer,
  revision = 0;
const urls = new Set();
/** 状态反馈保留错误信息，避免未保存时误显示成功。 */
function message(text) {
  $('message').textContent = text;
}
/** 串行保存完整会话，旧事务完成时不覆盖新的待保存提示。 */
function persist() {
  clearTimeout(timer);
  const rev = ++revision,
    snapshot = structuredClone(tour);
  $('save-state').innerHTML = uiText('保存中…');
  pending = pending
    .catch(() => {})
    .then(async () => {
      if (!store) throw new Error('本机存储不可用');
      await store.save(snapshot);
      if (rev === revision) $('save-state').innerHTML = uiText('已保存到本机');
    })
    .catch(() => {
      $('save-state').innerHTML = uiText('未保存');
      message('本机保存失败，请先导出重要取景；刷新页面可能丢失未保存内容。');
    });
  return pending;
}
/** 将画幅完整放入中央工作区。 */
function resize() {
  if (!viewer) return;
  const box = $('viewport').getBoundingClientRect(),
    size = fitFrame(Math.max(1, box.width - 48), Math.max(1, box.height - 48), state.view.ratio);
  $('frame').style.width = size.width + 'px';
  $('frame').style.height = size.height + 'px';
  viewer.resize(size.width, size.height);
  positionHotspots();
}
/** 相机调整同步到滑杆与存档，持久化延后以减少拖动写入。 */
function updateView(view) {
  state.view = normalizeView(view);
  viewer.setView(state.view);
  for (const key of ['yaw', 'pitch', 'fov']) {
    $(key).value = state.view[key];
    $(key + '-value').textContent = Math.round(state.view[key]) + '°';
  }
  $('ratio').value = state.view.ratio;
  const size = frameSize(state.view.ratio, +$('resolution').value);
  $('frame-spec').textContent = `${state.view.ratio} / ${size.width} × ${size.height}`;
  resize();
  $('save-state').innerHTML = uiText('待保存');
  clearTimeout(timer);
  timer = setTimeout(persist, 250);
}
/** 释放旧预览 URL 后重建本机取景库，文本通过 DOM 写入。 */
function renderShots() {
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
  $('shots').replaceChildren();
  $('count').textContent = String(state.shots.length).padStart(2, '0');
  if (!state.shots.length) {
    const p = document.createElement('p');
    p.className = 'empty-library';
    p.innerHTML = uiText('让一个角度，成为一个镜头。\n点击“保存取景”开始收集。');
    $('shots').append(p);
  }
  for (const shot of state.shots) {
    const card = document.createElement('article');
    card.className = 'shot';
    const url = URL.createObjectURL(shot.image);
    urls.add(url);
    const preview = document.createElement('button');
    preview.className = 'shot-preview';
    preview.ariaLabel = '恢复取景 ' + shot.name;
    const img = document.createElement('img');
    img.src = url;
    img.alt = shot.name;
    preview.append(img);
    preview.onclick = () => {
      if (!busy) updateView(shot.view);
    };
    const name = document.createElement('input');
    name.value = shot.name;
    name.maxLength = 60;
    name.ariaLabel = '取景名称';
    name.onchange = () => {
      shot.name = name.value.trim() || '未命名取景';
      name.value = shot.name;
      persist();
    };
    const info = document.createElement('small');
    info.textContent = `${shot.view.ratio} · ${Math.round(shot.view.yaw)}° / ${Math.round(shot.view.pitch)}° · FOV ${Math.round(shot.view.fov)}°`;
    const row = document.createElement('div');
    const download = document.createElement('button');
    download.innerHTML = uiText('下载 PNG');
    download.onclick = () => saveBlob(shot.image, shot.name);
    const remove = document.createElement('button');
    remove.innerHTML = uiText('删除');
    remove.onclick = () => {
      state.shots = state.shots.filter((s) => s.id !== shot.id);
      renderShots();
      persist();
    };
    row.append(download, remove);
    card.append(preview, name, info, row);
    $('shots').append(card);
  }
}
/** 触发本地下载并在浏览器消费链接后释放地址。 */
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = (name.replace(/[\\/:*?"<>|]/g, '-') || '全景取景') + '.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** 解码本地图片并限制 GPU 纹理大小，原始文件继续保存在独立会话中。 */
async function loadSource(blob) {
  if (!blob) {
    viewer.setImage(demoPanorama());
    $('source-info').innerHTML = uiText('方位演示图 · 2:1 等距柱状投影');
    return;
  }
  if (blob.size > 30 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
    throw new Error('请选择 30 MB 内的 PNG、JPEG 或 WebP 图片');
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 64000000) throw new Error('图片超过 6400 万像素，请先缩小后上传');
    const max = Math.min(8192, viewer.renderer.capabilities.maxTextureSize),
      scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    viewer.setImage(c);
    $('source-info').textContent =
      `${bitmap.width} × ${bitmap.height}${Math.abs(bitmap.width / bitmap.height - 2) > 0.1 ? ' · 非 2:1 图片，环视可能拉伸或出现接缝。' : ' · 等距柱状投影'}${scale < 1 ? ' · 预览已缩小' : ''}`;
  } finally {
    bitmap.close();
  }
}
/** 更新热点在当前视角中的位置；热点只存在于界面，不进入导出图片。 */
function positionHotspots() {
  for (const button of $('hotspots').children) {
    const hotspot = state.hotspots.find((h) => h.id === button.dataset.id);
    if (!hotspot) continue;
    const point = viewer.projectHotspot(hotspot);
    button.hidden = !point.visible;
    button.style.left = point.x + '%';
    button.style.top = point.y + '%';
  }
}
/** 重建位置选择与热点列表，目标名称始终跟随位置名称更新。 */
function renderTour() {
  for (const id of ['scene-select', 'target-scene']) {
    $(id).replaceChildren();
    for (const scene of tour.scenes) {
      if (id === 'target-scene' && scene.id === state.id) continue;
      $(id).add(new Option(scene.name, scene.id));
    }
  }
  $('scene-select').value = state.id;
  $('scene-name').value = state.name;
  $('source-name').textContent = state.name;
  $('delete-scene').disabled = tour.scenes.length < 2;
  $('add-hotspot').disabled = tour.scenes.length < 2;
  $('hotspots').replaceChildren();
  $('hotspot-list').replaceChildren();
  for (const hotspot of state.hotspots) {
    const target = tour.scenes.find((s) => s.id === hotspot.targetId);
    if (!target) continue;
    const button = document.createElement('button');
    button.className = 'tour-hotspot';
    button.dataset.id = hotspot.id;
    button.textContent = '➜ ' + target.name;
    button.title = '前往 ' + target.name;
    button.onclick = () => switchScene(target.id, true);
    $('hotspots').append(button);
    const row = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = '→ ' + target.name;
    const remove = document.createElement('button');
    remove.innerHTML = uiText('删除');
    remove.onclick = () => {
      if (busy) return;
      state.hotspots = state.hotspots.filter((h) => h.id !== hotspot.id);
      renderTour();
      persist();
    };
    row.append(label, remove);
    $('hotspot-list').append(row);
  }
  positionHotspots();
}
/** 解码完成后进入目标位置，失败时继续保留原来的场景和取景。 */
async function switchScene(id, arrival = false) {
  if (busy) return false;
  const next = tour.scenes.find((s) => s.id === id);
  if (!next) return false;
  busy = true;
  $('frame').classList.add('traveling');
  try {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      await new Promise(resolve => setTimeout(resolve, 180));
    await loadSource(next.source);
    state = next;
    tour.activeId = next.id;
    updateView(arrival ? { ...next.arrival, ratio: next.view.ratio } : next.view);
    renderTour();
    renderShots();
    await persist();
    message('已到达：' + state.name);
    return true;
  } catch (e) {
    message('无法进入位置：' + e.message);
    return false;
  } finally {
    busy = false;
    $('frame').classList.remove('traveling');
    $('scene-select').value = state.id;
  }
}
/** 新图成功解码后添加位置，已有位置和取景全部保留。 */
async function replaceSource(blob, name) {
  if (busy) return;
  if (tour.scenes.length >= 20) return message('最多添加 20 个位置，请先删除不需要的位置。');
  busy = true;
  try {
    await loadSource(blob);
    state = createScene(blob, name);
    tour.scenes.push(state);
    tour.activeId = state.id;
    updateView(state.view);
    renderTour();
    renderShots();
    await persist();
    message('位置已添加。切回上一个位置，添加指向这里的热点即可连接。');
  } catch (e) {
    message(e.message);
  } finally {
    busy = false;
    $('upload').value = '';
  }
}
$('scene-select').onchange = () => switchScene($('scene-select').value);
$('scene-name').onchange = () => {
  if (busy) return;
  state.name = $('scene-name').value.trim() || '未命名位置';
  renderTour();
  persist();
};
$('arrival').onclick = () => {
  if (busy) return;
  state.arrival = { ...state.view };
  persist();
  message('到达视角已保存，点击热点进入此位置时使用。');
};
$('add-hotspot').onclick = () => {
  const targetId = $('target-scene').value;
  if (busy || !targetId) return;
  if (state.hotspots.length >= 20) return message('此位置最多添加 20 个热点。');
  state.hotspots.push({ id: crypto.randomUUID(), targetId, yaw: state.view.yaw, pitch: state.view.pitch });
  renderTour();
  persist();
  message('热点已添加。点击画面上的箭头前往目标位置；返回热点需在目标位置另行添加。');
};
$('delete-scene').onclick = async () => {
  if (busy || tour.scenes.length < 2 || !confirm('删除此位置及其取景，并移除指向它的热点？')) return;
  const id = state.id;
  const next = tour.scenes.find((s) => s.id !== id);
  if (await switchScene(next.id)) {
    removeScene(tour, id);
    renderTour();
    persist();
  }
};
/** 将当前构图保存为无辅助线 PNG，拍摄期间阻止视角变化。 */
async function capture(downloadOnly) {
  if (busy) return;
  if (!downloadOnly && state.shots.length >= 20) return message('取景库已满，请先下载并删除部分取景。');
  busy = true;
  $('capture').disabled = $('download').disabled = true;
  try {
    const view = { ...state.view },
      blob = await viewer.capture(+$('resolution').value);
    if (downloadOnly) saveBlob(blob, '全景-' + view.ratio.replace(':', 'x'));
    else {
      state.shots.unshift({
        id: crypto.randomUUID(),
        name: '取景 ' + String(state.shots.length + 1).padStart(2, '0'),
        view,
        image: blob,
      });
      renderShots();
      await persist();
    }
  } catch (e) {
    message(e.message);
  } finally {
    busy = false;
    $('capture').disabled = $('download').disabled = false;
  }
}
$('upload').onchange = (e) => {
  if (e.target.files[0]) replaceSource(e.target.files[0], e.target.files[0].name);
};
$('demo').onclick = () => replaceSource(null, '方位演示全景');
/** 追加完整演示路线；重复点击直接返回已有示例，避免污染用户位置。 */
async function startDemoTour() {
  if (busy) return;
  const existing = tour.scenes.filter(s => s.demoKey === 'home-tour-v1');
  if (existing.length === 3) return switchScene(existing[0].id, true);
  if (tour.scenes.length > 17) return message('演示需要 3 个空余位置，请先整理位置后再体验。');
  busy = true;
  $('demo-tour').disabled = true;
  message('正在本机生成客厅、走廊、书房三个演示点位…');
  try {
    const { createDemoTour } = await import('./demo-tour.js');
    const scenes = await createDemoTour();
    await loadSource(scenes[0].source);
    tour.scenes.push(...scenes); state = scenes[0]; tour.activeId = state.id;
    updateView(state.view); renderTour(); renderShots(); await persist();
    message('简化住宅演示：点击箭头前往走廊，再进入书房；拖拽转身可找到返回热点。');
  } catch (e) { message('演示加载失败：' + e.message); }
  finally { busy = false; $('demo-tour').disabled = false; }
}
$('demo-tour').onclick = startDemoTour;
for (const key of ['yaw', 'pitch', 'fov', 'ratio'])
  $(key).oninput = () => {
    if (!busy) updateView({ ...state.view, [key]: key === 'ratio' ? $(key).value : +$(key).value });
  };
for (const key of ['yaw', 'pitch', 'fov', 'ratio'])
  $(key).onchange = () => {
    if (!busy) persist();
  };
$('resolution').onchange = () => {
  if (!busy) updateView(state.view);
};
$('reset').onclick = () => {
  if (!busy) updateView({ ...normalizeView(), ratio: state.view.ratio });
};
$('guides').onchange = () => {
  $('grid').hidden = !$('guides').checked;
};
$('capture').onclick = () => capture(false);
$('download').onclick = () => capture(true);
/** 初始化独立取景器并恢复上次本机会话。 */
async function initialize() {
  try {
    viewer = new PanoramaViewer($('render-host'));
    try {
      store = await openPanoramaStore();
      const saved = await store.load();
      tour = restoreTour(saved);
      state = tour.scenes.find((s) => s.id === tour.activeId);
    } catch {
      message('本机存储不可用，仍可取景和下载；关闭页面不会保留内容。');
    }
    await loadSource(state.source);
    $('source-name').textContent = state.name;
    renderShots();
    renderTour();
    updateView(state.view);
    busy = false;
    const observer = new ResizeObserver(resize);
    observer.observe($('viewport'));
    let drag = null;
    viewer.canvas.onpointerdown = (e) => {
      if (busy || e.button !== 0 || drag) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, view: { ...state.view } };
      viewer.canvas.setPointerCapture(e.pointerId);
      viewer.canvas.focus();
    };
    viewer.canvas.onpointermove = (e) => {
      if (!drag || e.pointerId !== drag.id || busy) return;
      const scale = state.view.fov / viewer.height;
      updateView({
        ...drag.view,
        yaw: drag.view.yaw - (e.clientX - drag.x) * scale,
        pitch: drag.view.pitch + (e.clientY - drag.y) * scale,
      });
    };
    viewer.canvas.onpointerup = viewer.canvas.onpointercancel = (e) => {
      if (drag?.id === e.pointerId) {
        drag = null;
        if (viewer.canvas.hasPointerCapture(e.pointerId)) viewer.canvas.releasePointerCapture(e.pointerId);
        persist();
      }
    };
    viewer.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!busy) updateView({ ...state.view, fov: state.view.fov + Math.sign(e.deltaY) * 3 });
      },
      { passive: false },
    );
    viewer.canvas.onkeydown = (e) => {
      if (busy) return;
      const v = { ...state.view },
        step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft') v.yaw -= step;
      else if (e.key === 'ArrowRight') v.yaw += step;
      else if (e.key === 'ArrowUp') v.pitch += step;
      else if (e.key === 'ArrowDown') v.pitch -= step;
      else if (['+', '='].includes(e.key)) v.fov -= step;
      else if (e.key === '-') v.fov += step;
      else return;
      e.preventDefault();
      updateView(v);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) location.reload();
    });
    window.addEventListener('pagehide', () => {
      observer.disconnect();
      viewer.dispose();
      for (const url of urls) URL.revokeObjectURL(url);
    });
  } catch (e) {
    message('无法初始化全景视口：' + e.message);
    $('capture').disabled = $('download').disabled = true;
  }
}
void initialize();
