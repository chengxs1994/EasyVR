import { uiText } from '../i18n.js';
import './home-view.css';
import { PanoramaViewer } from './viewer.js';
import { normalizeView } from './model.js';

const home = { yaw: 250, pitch: 0, fov: 62, ratio: '16:9' };
document.title = 'AI 住宅全景 · 客厅 | EasyVR';
document.getElementById('app').innerHTML = `<main class="home-tour"><div id="home-viewport"></div><header><div><span class="home-eyebrow"><span data-ui="EasyVR / 空间漫游">EasyVR / 空间漫游</span></span><h1><span data-ui="AI 住宅全景">AI 住宅全景</span><span><span data-ui="客厅">客厅</span></span></h1></div><div class="home-links"><a href="/?tour=ai-demo">AI 双点漫游 ↗</a><a href="/?editor=1&backdrop=home"><span data-ui="带入空间推演 ↗">带入空间推演 ↗</span></a><a href="/?panorama=1"><span data-ui="取景器">取景器</span></a></div></header><div id="home-status" role="status"><span data-ui="正在加载住宅全景…">正在加载住宅全景…</span></div><footer><p><span data-ui="拖拽环视 · 滚轮变焦">拖拽环视 · 滚轮变焦 </span><span><span data-ui="方向键微调">方向键微调</span></span></p><nav aria-label="全景浏览工具" data-ui-aria-label="全景浏览工具"><button id="zoom-in" aria-label="放大" data-ui-aria-label="放大">＋</button><button id="zoom-out" aria-label="缩小" data-ui-aria-label="缩小">−</button><button id="home-reset"><span data-ui="回到初始视角">回到初始视角</span></button><button id="home-fullscreen"><span data-ui="全屏">全屏</span></button></nav></footer></main>`;
const host = document.getElementById('home-viewport');
const status = document.getElementById('home-status');
let viewer, view = { ...home }, drag = null;
/** 更新浏览方向并约束视野，独立页面不写入编辑器工程。 */
function update(next) {
  view = normalizeView(next);
  viewer?.setView(view);
}
/** 加载默认住宅原图并安装全屏浏览交互。 */
async function initialize() {
  try {
    viewer = new PanoramaViewer(host, { fitViewport: true });
    const resize = () => viewer.resize(host.clientWidth, host.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize(); update(home);
    const response = await fetch('/panoramas/ai-living-room.png');
    if (!response.ok) throw new Error('住宅图片加载失败');
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const limit = Math.min(8192, viewer.renderer.capabilities.maxTextureSize);
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      viewer.setImage(canvas);
    } finally { bitmap.close(); }
    status.hidden = true;
    viewer.canvas.onpointerdown = e => {
      if (e.button !== 0 || drag) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, view: { ...view } };
      viewer.canvas.setPointerCapture(e.pointerId); viewer.canvas.focus();
    };
    viewer.canvas.onpointermove = e => {
      if (drag?.id !== e.pointerId) return;
      const scale = drag.view.fov / viewer.height;
      update({ ...drag.view, yaw: drag.view.yaw - (e.clientX - drag.x) * scale, pitch: drag.view.pitch + (e.clientY - drag.y) * scale });
    };
    viewer.canvas.onpointerup = viewer.canvas.onpointercancel = viewer.canvas.onlostpointercapture = e => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      if (viewer.canvas.hasPointerCapture(e.pointerId)) viewer.canvas.releasePointerCapture(e.pointerId);
    };
    viewer.canvas.addEventListener('wheel', e => {
      e.preventDefault(); update({ ...view, fov: view.fov + Math.sign(e.deltaY) * 3 });
    }, { passive: false });
    viewer.canvas.onkeydown = e => {
      const next = { ...view }, step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft') next.yaw -= step;
      else if (e.key === 'ArrowRight') next.yaw += step;
      else if (e.key === 'ArrowUp') next.pitch += step;
      else if (e.key === 'ArrowDown') next.pitch -= step;
      else return;
      e.preventDefault(); update(next);
    };
    document.getElementById('zoom-in').onclick = () => update({ ...view, fov: view.fov - 5 });
    document.getElementById('zoom-out').onclick = () => update({ ...view, fov: view.fov + 5 });
    document.getElementById('home-reset').onclick = () => update(home);
    document.getElementById('home-fullscreen').onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { status.hidden = false; status.innerHTML = uiText('当前浏览器不支持全屏，可放大预览窗口浏览。'); }
    };
    document.addEventListener('fullscreenchange', () => {
      document.getElementById('home-fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
    });
    window.addEventListener('pagehide', () => { observer.disconnect(); viewer.dispose(); });
    window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  } catch (error) { status.hidden = false; status.textContent = error.message + '，请刷新重试。'; }
}
void initialize();
