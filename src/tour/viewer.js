import * as THREE from 'three';
import { FACE_ORDER, normalizeView, validateFaces } from './view.js';
import { PreparedSceneCache } from './prepared-scene-cache.js';

/** 直接將六張原始 JPG 載入立方體紋理，完全不經過全景重投影。 */
export class TourViewer {
  /** 初始化固定拍攝點相機及按需渲染器。 */
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 10);
    this.view = normalizeView();
    this.preparedScenes = new PreparedSceneCache();
    this.disposed = false;
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', '全景視圖：拖曳環視，方向鍵調整，加減鍵縮放，Home 重置');
    host.append(this.canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
  }

  /** 僅準備指定場景；下載、解碼與 GPU 上傳都不會改動目前背景。 */
  prepareScene(scene) {
    const source = scene.panorama || scene.base;
    if (typeof source !== 'string' || !source) return Promise.reject(new Error('場景缺少素材來源'));
    const key = `${scene.panorama ? 'panorama' : 'cube'}:${source}`;
    return this.preparedScenes.prepare(key, () => this.prepareTexture(scene));
  }

  /** 解碼後驗證裝置尺寸限制，提前上傳紋理，避免在過渡中首次解碼。 */
  async prepareTexture(scene) {
    const panorama = Boolean(scene.panorama);
    const texture = await (panorama
      ? new THREE.TextureLoader().loadAsync(scene.panorama)
      : new THREE.CubeTextureLoader().loadAsync(FACE_ORDER.map(face => `${scene.base}/tablet_${face}.jpg`)));
    try {
      if (this.disposed) throw new Error('全景檢視器已關閉');
      const images = panorama ? [texture.image] : texture.images;
      await Promise.all(images.map(image => image.decode?.()));
      if (this.disposed) throw new Error('全景檢視器已關閉');
      const context = this.renderer.getContext();
      let size;
      if (panorama) {
        const width = texture.image.naturalWidth ?? texture.image.width;
        const height = texture.image.naturalHeight ?? texture.image.height;
        const maxSize = context.getParameter(context.MAX_TEXTURE_SIZE);
        if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= maxSize)) {
          throw new Error(`全景圖片尺寸無效或超出目前裝置的紋理限制 ${maxSize}`);
        }
        size = width;
        texture.mapping = THREE.EquirectangularReflectionMapping;
      } else {
        size = validateFaces(images, context.getParameter(context.MAX_CUBE_MAP_TEXTURE_SIZE));
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      this.renderer.initTexture(texture);
      // 球面圖中央維持 AI 導覽的預設 90 度方向，六面圖維持原始方向。
      return { texture, rotation: panorama ? Math.PI : 0, size };
    } catch (error) {
      texture.dispose();
      throw error;
    }
  }

  /** 同步顯示已準備素材，由快取保管舊紋理，供返回相鄰點位時重用。 */
  showPrepared(prepared) {
    this.preparedScenes.activate(prepared);
    this.scene.background = prepared.texture;
    this.scene.backgroundRotation.set(0, prepared.rotation, 0);
    this.render();
    return prepared.size;
  }

  /** 保留原六面載入介面，既有呼叫仍於素材就緒後切換並回傳尺寸。 */
  async load(base) {
    return this.showPrepared(await this.prepareScene({ base }));
  }

  /** 保留原球面載入介面，並共用解碼、驗證及有界快取。 */
  async loadPanorama(url) {
    return this.showPrepared(await this.prepareScene({ panorama: url }));
  }

  /** 同步視角；Three.js 立方體背景的 X 軸取樣翻轉由相機方向配合。 */
  setView(view) {
    this.view = normalizeView(view);
    const yaw = THREE.MathUtils.degToRad(this.view.yaw), pitch = THREE.MathUtils.degToRad(this.view.pitch);
    this.camera.fov = this.view.fov;
    this.camera.lookAt(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.camera.updateProjectionMatrix();
    this.render();
    return this.view;
  }

  /** 跟隨容器更新解析度，保持全屏與手機直向畫面的比例。 */
  resize() {
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight);
    this.camera.aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** 靜止時不啟動動畫循環，只有互動與尺寸變更才繪製。 */
  render() { this.renderer.render(this.scene, this.camera); this.onRender?.(); }

  /** 匯出與目前視窗相同比例的取景，最後恢復預覽尺寸與像素比。 */
  async capture() {
    const ratio = this.renderer.getPixelRatio(), aspect = this.camera.aspect;
    const width = aspect >= 1 ? 1920 : Math.round(1920 * aspect), height = aspect >= 1 ? Math.round(1920 / aspect) : 1920;
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.render();
      const blob = await new Promise((resolve, reject) => this.canvas.toBlob(value => value ? resolve(value) : reject(new Error('產生圖片失敗')), 'image/png'));
      return { blob, width, height };
    } finally {
      this.renderer.setPixelRatio(ratio);
      this.resize();
    }
  }

  /** 結束頁面時釋放觀察器、紋理與 GPU 資源。 */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.scene.background = null;
    this.preparedScenes.dispose();
    this.renderer.dispose();
  }
}
