import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { validateCalibration, panoramaEye, isGrounded, groundActor } from '../src/panorama/calibration.js';
import { lockPanoramaEye } from '../src/panorama/fixed-eye.js';
import { createResidentialScene } from '../src/panorama/spatial-scene.js';
import { validateProject } from '../src/project.js';

test('校准与贴地开关随工程往返保存，拒绝无效校准', () => {
  const p=createResidentialScene();
  p.environment.panoramaCalibration={eyeHeight:1.85,pitch:2,roll:-3};
  p.objects[0].groundLock=false;
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
  for(const input of [{eyeHeight:NaN,pitch:0,roll:0},{eyeHeight:8,pitch:0,roll:0},{eyeHeight:1.6,pitch:16,roll:0}]) assert.throws(()=>validateCalibration(input));
});
test('校准高度用于环视中心，重复旋转不丢失高度', () => {
  const p=createResidentialScene();p.environment.panoramaCalibration={eyeHeight:2,pitch:0,roll:0};
  const camera=new PerspectiveCamera(); const target=new Vector3(0,1,-4);
  lockPanoramaEye(camera,target,panoramaEye(p));
  assert.deepEqual(camera.position.toArray(),[0,2,0]);
});
test('贴地同时约束走位端点，明确解锁和已有悬空演员不自动落地', () => {
  const p=createResidentialScene(), actor=p.objects[0];
  assert.equal(isGrounded(p,actor),true);
  actor.position[1]=1;
  assert.equal(isGrounded(p,actor),false);
  actor.groundLock=true;
  actor.motion={from:[1,2,3],to:[2,3,4],start:0,end:2};
  groundActor(actor);
  assert.equal(actor.position[1],0);assert.equal(actor.motion.from[1],0);assert.equal(actor.motion.to[1],0);
  actor.groundLock=false;assert.equal(isGrounded(p,actor),false);
  delete p.environment.panorama;actor.groundLock=true;assert.equal(isGrounded(p,actor),false);
});
