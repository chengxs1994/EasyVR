import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, validateProject, sampleMotion, History } from '../src/project.js';

test('工程序列化往返保留场景、机位和演员数据', () => {
  const project = createProject('studio');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))), project);
  assert.equal(project.objects.filter((o) => o.type === 'actor').length, 2);
});

test('导入非法数字、重复 ID、超量对象和不支持的版本时拒绝整个工程', () => {
  const p = createProject('studio');
  p.objects[0].position[0] = Infinity;
  assert.throws(() => validateProject(p));
  const duplicate = createProject('studio');
  duplicate.objects.push(structuredClone(duplicate.objects[0]));
  assert.throws(() => validateProject(duplicate));
  assert.throws(() => validateProject({ ...createProject('studio'), version: 9 }));
  assert.throws(() => validateProject({ ...createProject('studio'), objects: Array(201).fill({}) }));
});

test('导入拒绝可破坏 HTML 属性的 ID 和越界走位', () => {
  const p = createProject('studio');
  p.objects[0].id = '\" onclick=alert(1)';
  assert.throws(() => validateProject(p));
  const motion = createProject('studio');
  motion.objects[0].motion = { from: [0, 0, 0], to: [2, 0, 0], start: 4, end: 3 };
  assert.throws(() => validateProject(motion));
  motion.objects[0].motion.end = 13;
  assert.throws(() => validateProject(motion));
});

test('走位按绝对时间计算，拖动时间轴可逆，且不会修改原始坐标', () => {
  const object = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    motion: { from: [0, 0, 0], to: [4, 0, 0], start: 2, end: 6 },
  };
  assert.deepEqual(sampleMotion(object, 0).position, [0, 0, 0]);
  assert.deepEqual(sampleMotion(object, 4).position, [2, 0, 0]);
  assert.deepEqual(sampleMotion(object, 9).position, [4, 0, 0]);
  assert.deepEqual(sampleMotion(object, 4).position, [2, 0, 0]);
  assert.deepEqual(object.position, [0, 0, 0]);
});

test('撤销和重做保存独立快照，撤销后新操作清除重做记录', () => {
  const h = new History({ value: 0 });
  const next = { value: 1 };
  h.push(next);
  next.value = 99;
  assert.deepEqual(h.undo(), { value: 0 });
  assert.deepEqual(h.redo(), { value: 1 });
  h.undo();
  h.push({ value: 2 });
  assert.equal(h.canRedo, false);
});
