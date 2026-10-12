import * as THREE from 'three';

export const POSES = { stand: '站立', sit: '坐下', crouch: '蹲下', raise: '抬手', point: '指向' };
export const ACTIONS = { walk: '行走', run: '跑步', wave: '挥手', point: '指向', turn: '转身' };

/** 验证人物表演字段；缺省字段兼容旧工程，时段不可超出工程时长。 */
export function validPerformance(object, duration) {
  if (object.pose !== undefined && (object.type !== 'actor' || !Object.hasOwn(POSES, object.pose))) return false;
  const action = object.action;
  return action == null || (object.type === 'actor' && Object.hasOwn(ACTIONS, action.type)
    && Number.isFinite(action.start) && Number.isFinite(action.end)
    && action.start >= 0 && action.end > action.start && action.end <= duration);
}

/** 按绝对时间决定动作，优先显式时段；未指定动作的走位保留默认步态。 */
export function samplePerformance(object, time, preview, walking) {
  const action = object.action;
  if (preview && action && time >= action.start && time < action.end)
    return { type: action.type, elapsed: time - action.start, progress: (time - action.start) / (action.end - action.start) };
  return { type: preview && !action && walking ? 'walk' : (object.pose || 'stand'), elapsed: time, progress: 0 };
}

/** 平滑插值的权重，确保起止时刻没有姿势跳变。 */
function ease(value) {
  const t = Math.max(0, Math.min(1, value));
  return t*t*(3-2*t);
}

/** 坐姿与蹲姿走位预留起身、坐回时间；短片段按比例压缩。 */
export function locomotionWindow(object) {
  const clip = object.motion || (['walk','run'].includes(object.action?.type) ? object.action : null);
  if (!clip) return null;
  const transition = ['sit','crouch'].includes(object.pose) ? Math.min(0.6,(clip.end-clip.start)/4) : 0;
  return { start:clip.start, end:clip.end, transition };
}

/** 获取动作时段的淡入淡出权重，短动作也保持连续。 */
function clipWeight(time, start, end, duration = 0.25) {
  const fade = Math.min(duration,(end-start)/4);
  return ease((time-start)/fade)*ease((end-time)/fade);
}

/** 从基础姿势叠加上下半身动作，绝对时间采样可重复回放和拖动。 */
export function applyPerformance(node, object, time, preview, walking) {
  const rig = node.userData.rig;
  if (!rig) return;
  const pose = object.pose || 'stand';
  const seated = pose === 'sit' || pose === 'crouch';
  const action = preview ? object.action : null;
  const weight = action ? clipWeight(time,action.start,action.end) : 0;
  const window = preview ? locomotionWindow(object) : null;
  const rise = window && seated ? clipWeight(time,window.start,window.end,window.transition) : 0;
  const movingStart = window ? window.start+window.transition : 0;
  const movingEnd = window ? window.end-window.transition : 0;
  const gait = window ? clipWeight(time,movingStart,movingEnd,seated ? 0.9 : 0.25) : (preview && walking ? 1 : 0);
  const running = action?.type === 'run' && time >= action.start && time < action.end;
  const elapsed = time-movingStart;
  rig.position.set(0,0,0); rig.rotation.set(0,0,0);
  for (const { leg, arm, knee, elbow, side } of node.userData.limbs) {
    leg.rotation.set(0,0,0); knee.rotation.set(0,0,0);
    arm.rotation.set(0,0,side*0.07); elbow.rotation.set(0,0,0);
    if (seated) {
      leg.rotation.x = (pose === 'sit' ? -Math.PI/2 : -1.05)*(1-rise);
      knee.rotation.x = (pose === 'sit' ? Math.PI/2 : 2.1)*(1-rise);
      arm.rotation.x = -0.3*(1-rise); elbow.rotation.x = -0.35*(1-rise);
    }
    if (pose === 'raise' && side === 1) { arm.rotation.z=2.55; elbow.rotation.z=0.15; }
    if (pose === 'point' && side === 1) arm.rotation.x=-Math.PI/2;
    if (gait > 0) {
      const phase = Math.sin(elapsed*(running ? 12 : 8))*side;
      leg.rotation.x += phase*(running ? 0.8 : 0.42)*gait;
      knee.rotation.x += Math.max(0,phase)*(running ? 1.1 : 0.5)*gait;
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x,-phase*0.65,gait);
      elbow.rotation.x = THREE.MathUtils.lerp(elbow.rotation.x,running ? -1.2 : -0.12,gait);
    }
    // 上半身动作只覆盖手臂，坐姿和蹲姿的髋、膝及身体高度保持不变。
    if (weight > 0 && side === 1 && ['wave','point'].includes(action.type)) {
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x,action.type === 'point' ? -Math.PI/2 : 0,weight);
      arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z,action.type === 'wave' ? 2.55 : side*0.07,weight);
      elbow.rotation.x *= 1-weight;
      elbow.rotation.z = action.type === 'wave' ? Math.sin((time-action.start)*9)*0.4*weight : 0;
    }
  }
  // 坐姿膝盖在髋部前方 0.42m；起身时髋部前移到脚掌上方，避免直立小腿扫过座面。
  // 偏移留在内部骨架，保持工程根坐标及走位起止点兼容。
  if (pose === 'sit') rig.position.z = 0.42*rise;
  if (weight > 0 && action.type === 'turn') {
    rig.rotation.y = Math.PI*ease((time-action.start)/(action.end-action.start))*weight;
  }
  // 在根节点局部空间测量脚掌底部，缩放与全景贴地不会重复叠加高度。
  node.updateWorldMatrix(true,true);
  const inverse = node.matrixWorld.clone().invert();
  let lowest = Infinity;
  for (const { foot } of node.userData.limbs) {
    foot.geometry.computeBoundingBox();
    const box = foot.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,foot.matrixWorld));
    lowest = Math.min(lowest,box.min.y);
  }
  rig.position.y = -lowest;
}
