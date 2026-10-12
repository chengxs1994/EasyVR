import { Vector3 } from 'three';
export const PANORAMA_EYE = [0, 1.6, 0];

/** 将绕目标旋转产生的相机位移还原为原地环视，保留新的观察方向与目标距离。 */
export function lockPanoramaEye(camera, target, eye = PANORAMA_EYE) {
  const direction = new Vector3().subVectors(target, camera.position);
  if (direction.lengthSq() < 0.000001) direction.set(0, 0, -4);
  camera.position.fromArray(eye);
  target.copy(camera.position).add(direction);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
