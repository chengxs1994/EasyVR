import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, validateConfig, STORAGE_KEY } from '../src/tour/route-config.js';
import { SCENES } from '../src/tour/scenes.js';

test('EasyVR 双向默认入口保留已确认的位置、外观与进入机位', () => {
  const config = defaultConfig();
  assert.deepEqual(SCENES.map(scene => scene.id), ['living', 'dining']);
  assert.equal(STORAGE_KEY, 'easyvr.tour:ai-demo:routes:v1');
  assert.deepEqual(config.routes.living[0], {
    target: 'dining', label: '', style: 'ring', color: '#ffffff', size: 42,
    entryFov: 95, yaw: 171.2, pitch: -13.7, entryYaw: 89.7, entryPitch: -21.4,
  });
  assert.equal(config.routes.dining[0].target, 'living');
  assert.equal(config.routes.dining[0].yaw, 202.5);
  assert.equal(config.routes.dining[0].entryYaw, 72.4);
  assert.deepEqual(config.sceneViews.living, { yaw: 93.2, pitch: -35.4, fov: 95 });
  assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(config))), config);
});

test('修改本机副本不污染默认值，导入保留用户已调整的机位', () => {
  const config = defaultConfig();
  config.routes.living[0].size = 56;
  config.routes.living[0].entryFov = 75;
  const imported = validateConfig(config);
  assert.equal(imported.routes.living[0].size, 56);
  assert.equal(imported.routes.living[0].entryFov, 75);
  assert.equal(defaultConfig().routes.living[0].size, 42);
});

test('拒绝无效路由与角度，旧配置补齐默认外观', () => {
  const config = defaultConfig();
  delete config.routes.living[0].style;
  assert.equal(validateConfig(config).routes.living[0].style, 'ring');
  config.routes.living[0].target = 'missing';
  assert.throws(() => validateConfig(config));
  config.routes.living[0].target = 'dining';
  config.routes.living[0].entryFov = 200;
  assert.throws(() => validateConfig(config));
});
