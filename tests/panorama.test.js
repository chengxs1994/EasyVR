import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeView, frameSize, fitFrame } from '../src/panorama/model.js';
test('全景角度归一化，极点和视野边界受限，非法画幅回退',()=>{
  assert.deepEqual(normalizeView({yaw:-10,pitch:99,fov:1,ratio:'bad'}),{yaw:350,pitch:85,fov:20,ratio:'16:9'});
  assert.equal(normalizeView({yaw:Infinity,fov:NaN}).yaw,0);
  assert.equal(normalizeView({yaw:725,fov:200}).fov,100);
});
test('横竖画幅按长边输出，视口完整容纳相同比例构图',()=>{
  assert.deepEqual(frameSize('16:9'),{width:1920,height:1080});
  assert.deepEqual(frameSize('9:16',3840),{width:2160,height:3840});
  assert.deepEqual(frameSize('3:4'),{width:1440,height:1920});
  const frame=fitFrame(1000,500,'9:16');assert.equal(frame.height,500);assert.ok(frame.width<=1000);
  assert.ok(Math.abs(frame.width/frame.height-9/16)<.002);
});
