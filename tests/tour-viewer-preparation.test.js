import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TourViewer } from '../src/tour/viewer.js';
import { PreparedSceneCache } from '../src/tour/prepared-scene-cache.js';

/** 控制影像解碼或下載完成時機，確認準備階段不會切換背景。 */
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

/** 以最小渲染器替身驗證載入流程，避免 Node 測試依賴 WebGL 視窗。 */
function viewerHarness() {
  const context = { MAX_TEXTURE_SIZE: 1, MAX_CUBE_MAP_TEXTURE_SIZE: 2, getParameter: () => 4096 };
  const calls = { uploads: [], renders: 0, disposals: 0, disconnects: 0 };
  const viewer = Object.assign(Object.create(TourViewer.prototype), {
    scene: new THREE.Scene(), camera: {}, preparedScenes: new PreparedSceneCache(), disposed: false,
    renderer: {
      getContext: () => context,
      initTexture: texture => calls.uploads.push(texture),
      render: () => { calls.renders += 1; },
      dispose: () => { calls.disposals += 1; },
    },
    observer: { disconnect: () => { calls.disconnects += 1; } },
  });
  return { viewer, calls };
}

/** 建立有效六面素材並保留解碼替身，以驗證上傳發生於解碼之後。 */
function cubeTexture(decode = () => Promise.resolve()) {
  return new THREE.CubeTexture(Array.from({ length: 6 }, () => ({ naturalWidth: 1024, naturalHeight: 1024, decode })));
}

test('六面先完成解碼與 GPU 上傳，只有同步顯示介面會改動畫面', async t => {
  const { viewer, calls } = viewerHarness(), decoding = deferred(), texture = cubeTexture(() => decoding.promise);
  const original = { texture: new THREE.Texture(), rotation: Math.PI, size: 2048 };
  await viewer.preparedScenes.prepare('original', () => original);
  viewer.showPrepared(original);
  const dispose = t.mock.method(original.texture, 'dispose');
  const load = t.mock.method(THREE.CubeTextureLoader.prototype, 'loadAsync', async urls => {
    assert.deepEqual(urls, ['r', 'l', 'u', 'd', 'f', 'b'].map(face => `/room/tablet_${face}.jpg`));
    return texture;
  });

  const pending = viewer.prepareScene({ base: '/room' });
  assert.equal(viewer.prepareScene({ base: '/room' }), pending);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(viewer.scene.background, original.texture);
  assert.equal(calls.uploads.length, 0);
  decoding.resolve();
  const prepared = await pending;
  assert.equal(load.mock.callCount(), 1);
  assert.deepEqual(calls.uploads, [texture]);
  assert.equal(viewer.scene.background, original.texture);
  assert.equal(calls.renders, 1);
  assert.equal(prepared.size, 1024);
  assert.equal(prepared.rotation, 0);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(viewer.showPrepared(prepared), 1024);
  assert.equal(viewer.scene.background, texture);
  assert.equal(calls.renders, 2);
  assert.equal(dispose.mock.callCount(), 0);
  viewer.dispose();
});

test('球面準備與兼容載入保留尺寸、映射及旋轉方向', async t => {
  const { viewer, calls } = viewerHarness();
  const texture = new THREE.Texture({ naturalWidth: 2048, naturalHeight: 1024, decode: async () => {} });
  const load = t.mock.method(THREE.TextureLoader.prototype, 'loadAsync', async () => texture);
  const prepared = await viewer.prepareScene({ panorama: '/room.jpg' });
  assert.equal(viewer.scene.background, null);
  assert.equal(prepared.size, 2048);
  assert.equal(prepared.rotation, Math.PI);
  assert.equal(texture.mapping, THREE.EquirectangularReflectionMapping);
  assert.deepEqual(calls.uploads, [texture]);
  assert.equal(await viewer.loadPanorama('/room.jpg'), 2048);
  assert.equal(viewer.scene.background, texture);
  assert.equal(viewer.scene.backgroundRotation.y, Math.PI);
  assert.equal(load.mock.callCount(), 1);
  viewer.dispose();
});

test('球面超出裝置限制時釋放素材且允許重試', async t => {
  const { viewer, calls } = viewerHarness();
  const invalid = new THREE.Texture({ naturalWidth: 8192, naturalHeight: 4096 });
  const valid = new THREE.Texture({ naturalWidth: 2048, naturalHeight: 1024 });
  const dispose = t.mock.method(invalid, 'dispose');
  let attempts = 0;
  t.mock.method(THREE.TextureLoader.prototype, 'loadAsync', async () => ++attempts === 1 ? invalid : valid);
  await assert.rejects(viewer.prepareScene({ panorama: '/room.jpg' }), /紋理限制/);
  assert.equal(dispose.mock.callCount(), 1);
  assert.equal(viewer.scene.background, null);
  assert.equal(calls.uploads.length, 0);
  assert.equal((await viewer.prepareScene({ panorama: '/room.jpg' })).texture, valid);
  assert.equal(attempts, 2);
  viewer.dispose();
});

test('解碼或 GPU 上傳失敗時釋放素材並保留原背景', async t => {
  const { viewer, calls } = viewerHarness();
  const original = { texture: new THREE.Texture(), rotation: 0, size: 1024 };
  await viewer.preparedScenes.prepare('original', () => original);
  viewer.showPrepared(original);
  const texture = cubeTexture(async () => { throw new Error('解碼失敗'); });
  const dispose = t.mock.method(texture, 'dispose');
  t.mock.method(THREE.CubeTextureLoader.prototype, 'loadAsync', async () => texture);
  await assert.rejects(viewer.prepareScene({ base: '/room' }), /解碼失敗/);
  assert.equal(dispose.mock.callCount(), 1);
  assert.equal(viewer.scene.background, original.texture);
  assert.equal(calls.uploads.length, 0);

  const second = cubeTexture(), secondDispose = t.mock.method(second, 'dispose');
  t.mock.method(THREE.CubeTextureLoader.prototype, 'loadAsync', async () => second);
  viewer.renderer.initTexture = () => { throw new Error('上傳失敗'); };
  await assert.rejects(viewer.prepareScene({ base: '/room' }), /上傳失敗/);
  assert.equal(secondDispose.mock.callCount(), 1);
  assert.equal(viewer.scene.background, original.texture);
  viewer.dispose();
});

test('關閉 viewer 後遲到素材不再上傳，且只釋放一次', async t => {
  const { viewer, calls } = viewerHarness(), loading = deferred(), texture = cubeTexture();
  const dispose = t.mock.method(texture, 'dispose');
  t.mock.method(THREE.CubeTextureLoader.prototype, 'loadAsync', () => loading.promise);
  const pending = viewer.prepareScene({ base: '/room' });
  await Promise.resolve();
  viewer.dispose();
  viewer.dispose();
  loading.resolve(texture);
  await assert.rejects(pending, /已關閉/);
  assert.equal(dispose.mock.callCount(), 1);
  assert.equal(calls.uploads.length, 0);
  assert.equal(calls.disposals, 1);
  assert.equal(calls.disconnects, 1);
  assert.equal(viewer.scene.background, null);
});
