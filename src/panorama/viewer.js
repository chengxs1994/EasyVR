import * as THREE from 'three';
import { RATIOS, normalizeView, frameSize } from './model.js';

/** 创建不依赖网络素材的方位演示全景，明确表示这不是生成的真实场景。 */
export function demoPanorama() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 1024);
  sky.addColorStop(0, '#111423');
  sky.addColorStop(0.48, '#5f777d');
  sky.addColorStop(0.5, '#89978c');
  sky.addColorStop(0.51, '#384043');
  sky.addColorStop(1, '#131018');
  x.fillStyle = sky;
  x.fillRect(0, 0, 2048, 1024);
  x.strokeStyle = '#ffffff20';
  x.lineWidth = 2;
  for (let a = 0; a < 2048; a += 128) {
    x.beginPath();
    x.moveTo(a, 0);
    x.lineTo(a, 1024);
    x.stroke();
  }
  for (let y = 128; y < 1024; y += 128) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(2048, y);
    x.stroke();
  }
  x.textAlign = 'center';
  x.fillStyle = '#edf0e8';
  x.font = '48px sans-serif';
  ['WEST / 西', 'NORTH / 北', 'EAST / 东', 'SOUTH / 南'].forEach((name, i) => {
    x.fillText(name, 256 + i * 512, 465);
    x.fillStyle = '#b89add';
    x.fillRect(250 + i * 512, 495, 12, 34);
    x.fillStyle = '#edf0e8';
  });
  x.font = '24px sans-serif';
  x.fillStyle = '#e1ddd7';
  x.fillText('全景方位演示 · 上传你的场景开始取景', 1024, 600);
  return c;
}
/** 使用内向球面呈现等距柱状全景；相机只旋转，不移动到场景中的其他位置。 */
export class PanoramaViewer {
  constructor(host, { fitViewport = false } = {}) {
    this.fitViewport = fitViewport;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 20);
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(10, 96, 64).scale(-1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    this.scene.add(this.mesh);
    this.view = normalizeView();
    host.append(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', '全景取景，拖动环视、滚轮变焦，方向键微调');
  }
  /** 替换贴图时释放旧纹理，维持颜色空间与正确的内部球面映射。 */
  setImage(image) {
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh.material.map?.dispose();
    this.mesh.material.map = texture;
    this.mesh.material.needsUpdate = true;
    this.render();
  }
  /** 同步已校验的相机参数，FOV 使用垂直视野角。 */
  setView(view) {
    this.view = normalizeView(view);
    this.render();
  }
  /** 按实际取景框大小绘制，不让界面缩放改变输出构图。 */
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height);
    this.render();
  }
  /** 以相机方向重新绘制，全景静止时不持续占用动画帧。 */
  render() {
    const v = this.view;
    this.camera.fov = v.fov;
    this.camera.aspect = this.fitViewport && this.width && this.height ? this.width / this.height : RATIOS[v.ratio];
    this.camera.updateProjectionMatrix();
    const yaw = THREE.MathUtils.degToRad(v.yaw),
      pitch = THREE.MathUtils.degToRad(v.pitch);
    this.camera.lookAt(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this.renderer.render(this.scene, this.camera);
  }
  /** 在选定分辨率渲染无辅助线画面，再恢复界面尺寸。 */
  async capture(longEdge) {
    const { width, height } = frameSize(this.view.ratio, longEdge),
      ratio = this.renderer.getPixelRatio();
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.render();
      copy.getContext('2d').drawImage(this.canvas, 0, 0);
    } finally {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(this.width, this.height);
      this.render();
    }
    return new Promise((resolve, reject) =>
      copy.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('画面导出失败'))), 'image/png'),
    );
  }
  /** 将球面热点投影到屏幕，背面与画框外的热点不显示。 */
  projectHotspot(hotspot) {
    const yaw = THREE.MathUtils.degToRad(hotspot.yaw);
    const pitch = THREE.MathUtils.degToRad(hotspot.pitch);
    const point = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    this.camera.updateMatrixWorld();
    const front = point.dot(this.camera.getWorldDirection(new THREE.Vector3())) > 0;
    point.project(this.camera);
    return {
      visible: front && Math.abs(point.x) < 0.92 && Math.abs(point.y) < 0.9,
      x: (point.x + 1) * 50,
      y: (1 - point.y) * 50,
    };
  }
  /** 页面退出时释放 GPU 资源。 */
  dispose() {
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
    this.renderer.dispose();
  }
}
