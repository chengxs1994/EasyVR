import { createProject } from '../project.js';

/** 为住宅全景创建独立推演工程，演员位置与默认客厅观察方向对齐。 */
export function createResidentialScene() {
  const scene = createProject('empty');
  scene.name = '住宅全景 · 人物站位';
  scene.environment.panorama = 'residential-living-room';
  scene.environment.grid = false;
  const yaw = 250 * Math.PI / 180;
  const forward = [Math.sin(yaw), -Math.cos(yaw)];
  const right = [Math.cos(yaw), Math.sin(yaw)];
  scene.objects.forEach((actor, index) => {
    const offset = index ? 1 : -1;
    actor.position = [forward[0] * 4 + right[0] * offset, 0, forward[1] * 4 + right[1] * offset];
    actor.rotation[1] = yaw + Math.PI;
  });
  scene.camera = { position: [0,1.6,0], target: [forward[0]*4,1.4,forward[1]*4], focal: 20, aspect: '16:9', preset: '住宅全景机位' };
  return scene;
}
