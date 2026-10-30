import { Vector3, MathUtils } from 'three';

/** 使用與立方體相機一致的座標投影；背面及視野外的熱點不可點擊或取得焦點。 */
export function projectHotspot(hotspot, camera, width, height) {
  const yaw = MathUtils.degToRad(hotspot.yaw), pitch = MathUtils.degToRad(hotspot.pitch);
  const point = new Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camera.updateMatrixWorld();
  point.applyMatrix4(camera.matrixWorldInverse);
  if (point.z >= 0) return null;
  point.applyMatrix4(camera.projectionMatrix);
  if (Math.abs(point.x) > .9 || Math.abs(point.y) > .86) return null;
  return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
}

/** 將畫面點擊反投影成同一相機座標下的經緯角，避免手填角度定位。 */
export function hotspotFromScreen(x, y, width, height, camera) {
  camera.updateMatrixWorld();
  const ray = new Vector3(x / width * 2 - 1, 1 - y / height * 2, .5).unproject(camera).sub(camera.position).normalize();
  return { yaw: (MathUtils.radToDeg(Math.atan2(-ray.x, ray.z)) + 360) % 360, pitch: Math.max(-89, Math.min(89, MathUtils.radToDeg(Math.asin(ray.y)))) };
}
