import test from 'node:test';
import assert from 'node:assert/strict';
import { createResidentialScene } from '../src/panorama/spatial-scene.js';
import { createProject, validateProject } from '../src/project.js';

test('住宅工程导入导出保留背景、演员与机位，默认工程不受影响', () => {
  const scene = createResidentialScene();
  const copy = validateProject(JSON.parse(JSON.stringify(scene)));
  assert.deepEqual(copy, scene);
  assert.equal(copy.objects.length, 2);
  assert.equal(copy.environment.panorama, 'residential-living-room');
  assert.equal(createProject().environment.panorama, undefined);
});
test('全景背景拒绝任意地址和未知资产引用', () => {
  const scene = createResidentialScene();
  scene.environment.panorama = 'https://example.com/image.jpg';
  assert.throws(() => validateProject(scene));
});
