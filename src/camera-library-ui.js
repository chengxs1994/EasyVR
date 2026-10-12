import { saveNamedCamera, activateNamedCamera } from './camera-library.js';
import { compressImage } from './media.js';

/** 将机位标题安全插入表单和预览列表。 */
function escape(value = '') {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
/** 建立机位库控件，保存操作失败时保留场景和表单。 */
export function mountCameraLibrary(host, { getScene, applyScene, capture, notify, beforeEdit }) {
  let selected = '',
    busy = false,
    signature = '';
  host.innerHTML =
    "<h3><span data-ui=\"机位库\">机位库 </span><small><span data-ui=\"最多 16 个\">最多 16 个</span></small></h3><div data-camera-list></div><label><span data-ui=\"机位名称\">机位名称</span><input data-camera-name maxlength=\"40\" placeholder=\"例如：小林特写\" data-ui-placeholder=\"例如：小林特写\"></label><div class=\"camera-library-actions\"><button data-camera-action=\"new\"><span data-ui=\"保存新机位\">保存新机位</span></button><button data-camera-action=\"update\"><span data-ui=\"更新选中机位\">更新选中机位</span></button><button data-camera-action=\"delete\"><span data-ui=\"删除\">删除</span></button></div><small><span data-ui=\"切换机位保留当前人物站位。预览图为上次保存时的画面。\">切换机位保留当前人物站位。预览图为上次保存时的画面。</span></small>";
  /** 同步机位列表和按钮状态，不在每次渲染时清空名称输入。 */
  function render() {
    const entries = getScene().cameraLibrary || [];
    if (!entries.some((e) => e.id === selected)) selected = '';
    const next = JSON.stringify(entries) + selected;
    if (next !== signature) {
      signature = next;
      host.querySelector('[data-camera-list]').innerHTML =
        entries
          .map(
            (e) =>
              `<button data-camera-id="${e.id}" class="${e.id === selected ? 'active' : ''}" aria-pressed="${e.id === selected}"><img src="${e.thumbnail}" alt="${escape(e.name)}"><span>${escape(e.name)}</span></button>`,
          )
          .join('') || "<p><span data-ui=\"保存当前摄影机，开始建立机位库。\">保存当前摄影机，开始建立机位库。</span></p>";
    }
    for (const b of host.querySelectorAll('button'))
      b.disabled = busy || (['update', 'delete', 'assign'].includes(b.dataset.cameraAction) && !selected);
  }
  /** 截取当前摄影机并压缩，缩略图与分镜参考图使用各自大小。 */
  async function picture(size) {
    return compressImage(await (await fetch(capture())).blob(), size);
  }
  host.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button || busy) return;
    const id = button.dataset.cameraId,
      action = button.dataset.cameraAction;
    try {
      beforeEdit();
      if (id) {
        selected = id;
        applyScene(activateNamedCamera(getScene(), id));
        host.querySelector('input').value = getScene().cameraLibrary.find((c) => c.id === id).name;
        return;
      }
      if (action === 'delete') {
        const next = structuredClone(getScene());
        next.cameraLibrary = next.cameraLibrary.filter((c) => c.id !== selected);
        applyScene(next);
        selected = '';
        return;
      }
      if (action === 'new' || action === 'update') {
        busy = true;
        render();
        const scene = structuredClone(getScene()),
          name = host.querySelector('input').value || scene.camera.preset;
        const thumbnail = await picture(240);
        if (JSON.stringify(scene) !== JSON.stringify(getScene()))
          throw new Error('场景已变化，请重新保存机位');
        const result = saveNamedCamera(scene, name, thumbnail, action === 'update' ? selected : '');
        applyScene(result.scene);
        selected = result.id;
        notify('机位已保存');
      }
    } catch (error) {
      notify(error.message);
    } finally {
      busy = false;
      render();
    }
  });
  render();
  return { render };
}
