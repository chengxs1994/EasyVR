import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, restoreTour, removeScene } from '../src/panorama/tour.js';

test('单场景迁移保留原图和取景，独立初始化热点', () => {
  const old = { source: new Blob(['image']), name: '旧位置', view: { yaw: 91 }, shots: [{name: '已存镜头'}] };
  const tour = restoreTour(old);
  assert.equal(tour.scenes[0].source, old.source);
  assert.deepEqual(tour.scenes[0].shots, old.shots);
  assert.deepEqual(tour.scenes[0].hotspots, []);
  assert.equal(tour.activeId, tour.scenes[0].id);
});
test('删除场景清除入站连接并防止删除最后一个位置', () => {
  const a = createScene(null, 'A'), b = createScene(null, 'B');
  a.hotspots.push({targetId:b.id});
  const tour = {scenes:[a,b],activeId:b.id};
  assert.equal(removeScene(tour,b.id),true);
  assert.equal(tour.activeId,a.id);
  assert.equal(a.hotspots.length,0);
  assert.equal(removeScene(tour,a.id),false);
});
