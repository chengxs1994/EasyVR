import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { lockPanoramaEye, PANORAMA_EYE } from '../src/panorama/fixed-eye.js';

test('旋转后保留观察方向，但相机永远回到全景拍摄点', () => {
  const camera = new PerspectiveCamera();
  for (const position of [[6,4,2],[-4,.3,7],[0,12,-3]]) {
    camera.position.fromArray(position);
    const target = new Vector3(-3,1,1);
    const direction = target.clone().sub(camera.position).normalize();
    lockPanoramaEye(camera,target);
    assert.deepEqual(camera.position.toArray(),PANORAMA_EYE);
    assert.ok(camera.getWorldDirection(new Vector3()).distanceTo(direction)<1e-10);
    lockPanoramaEye(camera,target);
    assert.deepEqual(camera.position.toArray(),PANORAMA_EYE);
  }
});
test('目标与相机重合时使用有效观察方向', () => {
  const camera=new PerspectiveCamera(); const target=camera.position.clone();
  lockPanoramaEye(camera,target);
  assert.equal(target.distanceTo(camera.position),4);
  assert.ok(camera.quaternion.toArray().every(Number.isFinite));
});
