import test from 'node:test';
import assert from 'node:assert/strict';
import { approachHotspot, travelView } from '../src/tour/travel.js';
import { createSceneTransition } from '../src/tour/transition.js';

/** 用可控刷新時鐘測試前景、背景及錯誤收尾，不依賴真實等待。 */
function installFrameClock(t, { reduced = false, hidden = false } = {}) {
  const originals = new Map(), frames = new Map(), listeners = new Map();
  let id = 0;
  const doc = {
    hidden,
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: type => listeners.delete(type),
  };
  for (const [key, value] of Object.entries({
    document: doc,
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: frame => frames.delete(frame),
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  return {
    doc, frames, listeners,
    /** 推進到指定刷新時間，後續排程留給下一次測試時鐘。 */
    tick(time) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
  };
}

test('轉向限制大角度旋轉，保留視野與低頭姿態，避免推進前先縮放一次', () => {
  const start = { yaw: 0, pitch: -40, fov: 26 };
  const end = travelView(start, { yaw: 150, pitch: -80 }, 1);
  assert.deepEqual(end, { yaw: 28, pitch: -46, fov: 26 });
  assert.deepEqual(travelView(start, { yaw: 150, pitch: -80 }, -1), start);
});

test('轉向依刷新時間完成，背景分頁會取消等待並移除監聽', async t => {
  const clock = installFrameClock(t), updates = [];
  const promise = approachHotspot({ yaw: 350, pitch: 0, fov: 65 }, { yaw: 10, pitch: -10 }, view => updates.push(view));
  clock.tick(1000); clock.tick(1120); clock.tick(1240);
  await promise;
  assert.equal(updates[0].yaw, 350);
  assert.equal(updates.at(-1).yaw, 370);
  assert.equal(clock.frames.size, 0); assert.equal(clock.listeners.size, 0);
  const background = approachHotspot(updates[0], { yaw: 10, pitch: 0 }, () => {});
  clock.doc.hidden = true; clock.listeners.get('visibilitychange')();
  await background;
  assert.equal(clock.frames.size, 0); assert.equal(clock.listeners.size, 0);
});

test('減少動態效果時不排程動畫，也不修改出發視角', async t => {
  const clock = installFrameClock(t, { reduced: true });
  await approachHotspot({ yaw: 0, pitch: 0, fov: 65 }, { yaw: 30, pitch: 0 }, () => assert.fail('不應修改視角'));
  assert.equal(clock.frames.size, 0);
  const transition = createSceneTransition({}, {}, { forward: true });
  await transition.play(); transition.dispose();
});

test('相機更新失敗會拒絕並清理動畫，不會留下無法完成的切換', async t => {
  const clock = installFrameClock(t);
  const promise = approachHotspot({ yaw: 0, pitch: 0, fov: 65 }, { yaw: 30, pitch: 0 }, () => { throw new Error('render failed'); });
  const rejected = assert.rejects(promise, /render failed/);
  clock.tick(100); await rejected;
  assert.equal(clock.frames.size, 0); assert.equal(clock.listeners.size, 0);
});

test('過渡只淡出舊畫面，不改新畫面亮度，並完整釋放快照', async t => {
  const clock = installFrameClock(t);
  let removed = false, cancelled = false, recorded;
  const cover = {
    style: {}, setAttribute() {}, getContext: () => ({ drawImage() {} }),
    animate(keyframes, options) {
      recorded = { keyframes, options };
      return { finished: Promise.resolve(), cancel() { cancelled = true; }, finish() {} };
    },
    remove() { removed = true; },
  };
  clock.doc.createElement = () => cover;
  const canvas = { width: 2400, height: 1600, animate() { assert.fail('新畫面不可變暗或縮放'); } };
  const host = { clientWidth: 1200, append(node) { assert.equal(node, cover); } };
  const transition = createSceneTransition(host, canvas);
  assert.equal(cover.width, 1500);
  await transition.play();
  assert.equal(recorded.keyframes[0].opacity, 1);
  assert.equal(recorded.keyframes.at(-1).opacity, 0);
  assert.ok(recorded.keyframes.every(frame => frame.transform === undefined));
  assert.equal(recorded.options.duration, 520);
  assert.equal(clock.listeners.size, 0);
  transition.dispose();
  assert.ok(removed && cancelled); assert.equal(cover.width, 0);
});

test('熱點朝投影位置連續推進，先保留來源畫面再融合，目標畫面不被縮放', async t => {
  const clock = installFrameClock(t);
  let recorded;
  const cover = {
    style: {}, setAttribute() {}, getContext: () => ({ drawImage() {} }),
    animate(keyframes, options) {
      recorded = { keyframes, options };
      return { finished: Promise.resolve(), cancel() {}, finish() {} };
    },
    remove() {},
  };
  clock.doc.createElement = () => cover;
  const host = { clientWidth: 1200, clientHeight: 800, append() {} };
  const canvas = { width: 2400, height: 1600, animate() { assert.fail('目標機位不可因過渡改變'); } };
  const transition = createSceneTransition(host, canvas, { forward: true, origin: { x: 900, y: 480 } });
  await transition.play();
  assert.equal(cover.style.transformOrigin, '75% 60%');
  const frames = recorded.keyframes;
  assert.equal(frames[0].transform, 'scale(1)');
  assert.equal(frames[1].opacity, 1);
  assert.ok(frames[1].offset > .3, '淡出前必須有可辨識的推進階段');
  const scales = frames.map(frame => Number(frame.transform.slice(6, -1)));
  assert.ok(scales.every((scale, index) => index === 0 || scale > scales[index - 1]));
  assert.ok(scales[1] >= 1.3, '來源畫面淡出前已明顯靠近入口');
  assert.equal(scales.at(-1), 1.8);
  assert.equal(frames.at(-1).opacity, 0);
  assert.equal(recorded.options.duration, 1200);
  transition.dispose();
  assert.equal(clock.listeners.size, 0);
});
