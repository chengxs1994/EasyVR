import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createProject, createObject, validateProject } from '../src/project.js';
import { buildMannequin, buildStageLight, buildCameraMarker } from '../src/director/models.js';
import { createDirectorPlot, directorCode } from '../src/director/plot.js';

test('舞台模板保存灯光配置，旧场景继续兼容', () => {
  const stage=createProject('stage');
  assert.equal(stage.objects.filter(o=>o.type==='light').length,2);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(stage))),stage);
  const light=stage.objects.find(o=>o.type==='light');light.light.intensity=65;light.light.angle=45;
  assert.equal(validateProject(stage).objects.find(o=>o.id===light.id).light.intensity,65);
  light.light.angle=100;assert.throws(()=>validateProject(stage));
  const old=createProject('studio');assert.deepEqual(validateProject(old),old);
});

test('关节人偶保持米制比例、脚底原点与两侧走位节点', () => {
  const actor=createObject('actor','演员');const node=buildMannequin(actor);
  const bounds=new THREE.Box3().setFromObject(node),size=bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(bounds.min.y)<0.01);assert.ok(size.y>1.7&&size.y<1.9);
  assert.equal(node.userData.limbs.length,2);assert.equal(node.userData.objectId,actor.id);
  assert.ok(node.userData.limbs.every(l=>l.leg.isGroup&&l.arm.isGroup));
});
test('舞台灯包含独立可隐藏灯架与真实聚光灯，机位镜头朝向正确', () => {
  const node=buildStageLight(createObject('light','灯'));
  assert.ok(node.userData.light.isSpotLight);assert.ok(node.userData.fixture.isGroup);
  node.userData.fixture.visible=false;assert.equal(node.userData.light.visible,true);
  const camera={position:[4,2,5],target:[0,1,0]};const marker=buildCameraMarker(camera,'current');
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(marker.quaternion);
  assert.ok(forward.dot(new THREE.Vector3(...camera.target).sub(new THREE.Vector3(...camera.position)).normalize())>0.999);
});
test('调度图从同一工程输出稳定编号、走位与机位，并转义用户文本', () => {
  const scene=createProject('stage'),actor=scene.objects[0];
  actor.name='<script>&"';actor.motion={from:[0,0,0],to:[2,0,1],start:1,end:4};
  const code=directorCode(actor),svg=createDirectorPlot(scene);
  assert.ok(svg.includes(code));assert.ok(svg.includes('1–4s'));assert.ok(svg.includes('当前机位'));
  assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));
  scene.objects.reverse();assert.equal(directorCode(actor),code);
});

test('英文调度图翻译界面标注，保留用户创作名称', () => {
  const scene = createProject('stage');
  scene.name = '用户的舞台';
  scene.objects[0].name = '我的角色';
  const svg = createDirectorPlot(scene, 'en');
  assert.ok(svg.includes('Blocking plan'));
  assert.ok(svg.includes('Object index'));
  assert.ok(svg.includes('Current camera'));
  assert.ok(svg.includes('1 m grid'));
  assert.ok(svg.includes('用户的舞台'));
  assert.ok(svg.includes('我的角色'));
  assert.ok(!svg.includes('当前机位'));
});
