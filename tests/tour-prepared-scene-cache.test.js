import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreparedSceneCache } from '../src/tour/prepared-scene-cache.js';

/** 手動控制載入完成時機，重現切換與關閉期間的非同步競爭。 */
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

/** 記錄紋理釋放次數，驗證快取不會提早或重複回收。 */
function preparedScene() {
  return {
    texture: {
      disposals: 0,
      /** 記錄每次回收，捕捉重複釋放。 */
      dispose() { this.disposals += 1; },
    },
    rotation: 0,
    size: 1024,
  };
}

test('相同素材共用進行中請求與完成快取', async () => {
  const cache = new PreparedSceneCache(), loading = deferred(), prepared = preparedScene();
  let loads = 0;
  const first = cache.prepare('room', () => { loads += 1; return loading.promise; });
  const second = cache.prepare('room', () => { throw new Error('不可重複載入'); });
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(loads, 1);
  loading.resolve(prepared);
  assert.equal(await first, prepared);
  assert.equal(await cache.prepare('room', () => { throw new Error('不可重複載入'); }), prepared);
  cache.dispose();
});

test('失敗請求會移除，下一次可重新準備', async () => {
  const cache = new PreparedSceneCache(), prepared = preparedScene();
  await assert.rejects(cache.prepare('room', () => Promise.reject(new Error('載入失敗'))), /載入失敗/);
  assert.equal(await cache.prepare('room', () => prepared), prepared);
  cache.activate(prepared);
  assert.equal(prepared.texture.disposals, 0);
  cache.dispose();
});

test('最多保留三組素材，淘汰最久未使用項目並保留目前背景', async () => {
  const cache = new PreparedSceneCache();
  const scenes = Array.from({ length: 5 }, preparedScene);
  await cache.prepare('current', () => scenes[0]);
  cache.activate(scenes[0]);
  await cache.prepare('nearby-a', () => scenes[1]);
  await cache.prepare('nearby-b', () => scenes[2]);
  await cache.prepare('nearby-a', () => { throw new Error('不可重複載入'); });
  await cache.prepare('nearby-c', () => scenes[3]);
  assert.deepEqual(scenes.slice(0, 4).map(scene => scene.texture.disposals), [0, 0, 1, 0]);
  assert.throws(() => cache.activate(scenes[2]), /素材已釋放/);

  cache.activate(scenes[3]);
  await cache.prepare('nearby-d', () => scenes[4]);
  assert.deepEqual(scenes.map(scene => scene.texture.disposals), [1, 0, 1, 0, 0]);
  cache.dispose();
  cache.dispose();
  assert.deepEqual(scenes.map(scene => scene.texture.disposals), [1, 1, 1, 1, 1]);
});

test('關閉快取後回收遲到素材，且拒絕後續準備和顯示', async () => {
  const cache = new PreparedSceneCache(), loading = deferred(), prepared = preparedScene();
  const pending = cache.prepare('room', () => loading.promise);
  await Promise.resolve();
  cache.dispose();
  loading.resolve(prepared);
  await assert.rejects(pending, /已關閉/);
  assert.equal(prepared.texture.disposals, 1);
  await assert.rejects(cache.prepare('room', () => prepared), /已關閉/);
  assert.throws(() => cache.activate(prepared), /已關閉/);
});
