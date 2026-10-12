import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createProject, validateProject, sampleMotion } from '../src/project.js';
import { buildMannequin } from '../src/director/models.js';
import { POSES, ACTIONS, applyPerformance, samplePerformance } from '../src/director/actions.js';

test('动作持久化与旧工程兼容，并拒绝非法类型和时段', () => {
  const project=createProject();
  assert.deepEqual(validateProject(project),project);
  const actor=project.objects[0];actor.pose='sit';actor.action={type:'wave',start:1,end:5};
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))),project);
  for (const action of [{type:'bad',start:1,end:3},{type:'wave',start:3,end:2},{type:'wave',start:-1,end:2},{type:'wave',start:1,end:13},{type:'wave',start:NaN,end:5}]) {
    actor.action=action;assert.throws(()=>validateProject(project));
  }
  actor.action=null;actor.pose='constructor';assert.throws(()=>validateProject(project));
});
test('时段边界、编辑姿势、旧走位和显式动作优先级正确', () => {
  const actor=createProject().objects[0];actor.pose='sit';actor.action={type:'wave',start:2,end:4};
  assert.equal(samplePerformance(actor,1,true,true).type,'sit');
  assert.equal(samplePerformance(actor,2,true,true).type,'wave');
  assert.equal(samplePerformance(actor,4,true,true).type,'sit');
  assert.equal(samplePerformance(actor,3,false,true).type,'sit');
  delete actor.action;assert.equal(samplePerformance(actor,3,true,true).type,'walk');
});
test('各姿势和动作脚底贴地、重复采样不累积且不修改工程坐标', () => {
  const actor=createProject().objects[0];actor.position=[2,0,3];const node=buildMannequin(actor);
  const before=structuredClone(actor);
  for(const type of [...Object.keys(POSES),...Object.keys(ACTIONS)]) {
    const data=Object.hasOwn(POSES,type)?{...actor,pose:type}:{...actor,action:{type,start:0,end:5}};
    applyPerformance(node,data,1.3,true,false);
    const state=node.userData.rig.position.y;
    node.updateMatrixWorld(true);
    const bottoms=node.userData.limbs.map(({foot})=>new THREE.Box3().setFromObject(foot).min.y);
    assert.ok(Math.abs(Math.min(...bottoms))<0.001,`${type}: ${bottoms}`);
    applyPerformance(node,data,2.6,true,false);applyPerformance(node,data,1.3,true,false);
    assert.ok(Math.abs(node.userData.rig.position.y-state)<1e-8);
  }
  assert.deepEqual(actor,before);
  actor.motion={from:[0,0,0],to:[4,0,0],start:0,end:4};actor.action={type:'run',start:0,end:4};
  assert.deepEqual(sampleMotion(actor,2).position,[2,0,0]);
  applyPerformance(node,actor,2,true,true);applyPerformance(node,actor,0,false,false);
  assert.equal(node.userData.limbs[0].knee.rotation.x,0);
});

test('坐姿与蹲姿挥手、指向只改变手臂，动作边界连续', () => {
  for (const pose of ['sit','crouch']) for (const type of ['wave','point']) {
    const actor={...createProject().objects[0],pose};const node=buildMannequin(actor);
    applyPerformance(node,actor,0,false,false);
    const height=node.userData.rig.position.y, leg=node.userData.limbs[1].leg.rotation.x, knee=node.userData.limbs[1].knee.rotation.x;
    actor.action={type,start:1,end:4};
    for (const t of [0,1,1.1,2,3.9,4,5]) {
      applyPerformance(node,actor,t,true,false);
      assert.ok(Math.abs(node.userData.rig.position.y-height)<1e-9);
      assert.equal(node.userData.limbs[1].leg.rotation.x,leg);
      assert.equal(node.userData.limbs[1].knee.rotation.x,knee);
    }
    applyPerformance(node,actor,2,true,false);
    assert.ok(Math.abs(node.userData.limbs[1].arm.rotation.x+0.3)>0.1 || node.userData.limbs[1].arm.rotation.z>1);
    applyPerformance(node,actor,4-1e-6,true,false);
    assert.ok(Math.abs(node.userData.limbs[1].arm.rotation.x+0.3)<1e-6);
  }
});
test('坐姿走位先起身、后移动、停止后坐回，短片段与随机回放稳定', () => {
  for (const duration of [0.2,4]) {
    const actor={...createProject().objects[0],pose:'sit',motion:{from:[0,0,0],to:[4,0,0],start:1,end:1+duration}};
    const node=buildMannequin(actor),transition=Math.min(0.6,duration/4);
    assert.deepEqual(sampleMotion(actor,1+transition/2).position,[0,0,0]);
    assert.deepEqual(sampleMotion(actor,1+duration-transition/2).position,[4,0,0]);
    assert.ok(Math.abs(sampleMotion(actor,1+duration/2).position[0]-2)<1e-9);
    applyPerformance(node,actor,1+transition/2,true,false);
    assert.ok(node.userData.limbs[0].knee.rotation.x>0 && node.userData.limbs[0].knee.rotation.x<Math.PI/2);
    applyPerformance(node,actor,1+transition,true,false);
    assert.ok(Math.abs(node.userData.limbs[0].knee.rotation.x)<1e-9);
    applyPerformance(node,actor,1+duration,true,false);
    assert.equal(node.userData.limbs[0].knee.rotation.x,Math.PI/2);
    applyPerformance(node,actor,1,true,false);
    assert.equal(node.userData.limbs[0].knee.rotation.x,Math.PI/2);
    assert.equal(actor.position[1],0);
  }
});

test('坐姿起身时髋部前移，站立小腿离开起点座面范围', () => {
  const actor={...createProject().objects[0],pose:'sit',action:{type:'walk',start:1,end:6}};
  const node=buildMannequin(actor);
  applyPerformance(node,actor,0,true,false);assert.equal(node.userData.rig.position.z,0);
  applyPerformance(node,actor,1.3,true,false);
  assert.ok(node.userData.rig.position.z>0.1 && node.userData.rig.position.z<0.32);
  applyPerformance(node,actor,1.6,true,false);
  assert.ok(Math.abs(node.userData.rig.position.z-0.42)<1e-9);
  node.updateMatrixWorld(true);
  for (const {knee} of node.userData.limbs) {
    const lowerLeg=new THREE.Box3().setFromObject(knee);
    assert.ok(lowerLeg.min.z>0.28,'小腿应移出默认座面前缘');
  }
  applyPerformance(node,actor,6,true,false);assert.equal(node.userData.rig.position.z,0);
  assert.deepEqual(actor.position,[-1.3,0,0.4]);
});

test('演示座椅离座后的前两秒，小腿和脚掌不会扫入座板', () => {
  const actor={...createProject().objects[0],pose:'sit',motion:{from:[0,0,0],to:[0,0,4],start:1,end:11},action:{type:'walk',start:1,end:11}};
  const node=buildMannequin(actor);
  const seat=new THREE.Box3(new THREE.Vector3(-0.54,0.308,-0.31),new THREE.Vector3(0.54,0.4004,0.11));
  for(let time=1;time<3;time+=0.02) {
    node.position.fromArray(sampleMotion(actor,time).position);
    applyPerformance(node,actor,time,true,true);node.updateMatrixWorld(true);
    for(const {knee} of node.userData.limbs) knee.traverse(part=>{
      if(part.isMesh) assert.ok(!new THREE.Box3().setFromObject(part).intersectsBox(seat),`座板相交：${time}`);
    });
  }
});
