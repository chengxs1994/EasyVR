import * as THREE from 'three';

/** 创建带阴影的部件并加入父节点，局部坐标以米计。 */
function mesh(parent, geometry, material, position, scale = [1,1,1]) {
  const node = new THREE.Mesh(geometry, material);
  node.position.fromArray(position); node.scale.fromArray(scale);
  node.castShadow = true; node.receiveShadow = true; parent.add(node); return node;
}
/** 为可编辑模型记录稳定身份与重建签名。 */
function identify(group, data) {
  group.userData.objectId = data.id;
  group.userData.signature = `${data.type}:${data.color}`;
  return group;
}
/** 构建自然比例的关节人偶，保留既有步态驱动所需的腿、臂旋转节点。 */
export function buildMannequin(data) {
  const root = new THREE.Group();
  const group = new THREE.Group(); root.add(group); root.userData.rig = group;
  const body = new THREE.MeshStandardMaterial({color:data.color,roughness:0.48,metalness:0.05});
  const joint = new THREE.MeshStandardMaterial({color:new THREE.Color(data.color).multiplyScalar(0.72),roughness:0.65});
  /** 椭球表现胸廓、骨盆与肌肉体块，避免胶囊轮廓过于粗重。 */
  function oval(parent, pos, size, mat = body) { return mesh(parent,new THREE.SphereGeometry(1,24,16),mat,pos,size); }
  oval(group,[0,1.29,0],[0.225,0.24,0.115]);
  oval(group,[0,1.075,0],[0.13,0.12,0.095],joint);
  oval(group,[0,0.96,0],[0.18,0.13,0.115]);
  mesh(group,new THREE.CylinderGeometry(0.052,0.063,0.1,16),joint,[0,1.53,0]);
  oval(group,[0,1.685,0],[0.112,0.148,0.112]);
  oval(group,[0,1.63,0.045],[0.083,0.07,0.087]);
  group.userData.limbs=[];
  for(const side of [-1,1]) {
    const leg=new THREE.Group();leg.position.set(side*0.102,0.95,0);group.add(leg);
    oval(leg,[0,-0.035,0],[0.084,0.084,0.084],joint);
    oval(leg,[0,-0.215,0],[0.088,0.205,0.089]);
    oval(leg,[0,-0.42,0.005],[0.065,0.065,0.065],joint);
    const knee=new THREE.Group(); knee.position.set(0,-0.42,0); leg.add(knee);
    oval(knee,[0,-0.205,-0.012],[0.061,0.185,0.067]);
    oval(knee,[0,-0.4,0],[0.042,0.055,0.045],joint);
    const foot=oval(knee,[0,-0.475,0.055],[0.064,0.055,0.125]);
    const arm=new THREE.Group();arm.position.set(side*0.245,1.425,0);group.add(arm);
    arm.rotation.z=side*0.07;
    oval(arm,[0,0,0],[0.074,0.074,0.074],joint);
    oval(arm,[side*0.015,-0.15,0],[0.059,0.132,0.062]);
    oval(arm,[side*0.023,-0.29,0],[0.046,0.046,0.046],joint);
    const elbow=new THREE.Group(); elbow.position.set(side*0.023,-0.29,0); arm.add(elbow);
    oval(elbow,[side*0.005,-0.115,0.005],[0.047,0.113,0.05]);
    oval(elbow,[side*0.005,-0.24,0.005],[0.03,0.032,0.03],joint);
    oval(elbow,[side*0.004,-0.305,0.016],[0.041,0.069,0.026]);
    oval(elbow,[side*-0.037,-0.289,0.032],[0.016,0.04,0.018]);
    group.userData.limbs.push({leg,arm,knee,elbow,foot,side});
  }
  root.userData.limbs=group.userData.limbs;
  return identify(root,data);
}
/** 创建可移动、旋转的舞台聚光灯，灯架只在导演视图出现，光照进入成片。 */
export function buildStageLight(data) {
  const group=new THREE.Group(), fixture=new THREE.Group();group.add(fixture);
  const material=new THREE.MeshStandardMaterial({color:data.color,roughness:0.4});
  mesh(fixture,new THREE.CylinderGeometry(0.035,0.045,2.5,16),material,[0,1.25,0]);
  mesh(fixture,new THREE.CylinderGeometry(0.22,0.25,0.06,24),material,[0,0.03,0]);
  const arm=mesh(fixture,new THREE.CylinderGeometry(0.03,0.03,0.48,12),material,[0,2.48,-0.22]);arm.rotation.x=Math.PI/2;
  mesh(fixture,new THREE.SphereGeometry(0.16,24,16),material,[0,2.48,-0.48]);
  const light=new THREE.SpotLight(data.color,35,20,Math.PI/5,0.55,1);
  light.position.set(0,2.48,-0.48);light.target.position.set(0,0.8,-4);
  group.add(light,light.target);
  group.userData.fixture=fixture;group.userData.light=light;
  return identify(group,data);
}
/** 以金色摄影机图标显示真实机位，镜头朝向局部负 Z。 */
export function buildCameraMarker(camera, id) {
  const group=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:id==='current'?'#edbd54':'#a998c6',roughness:0.55});
  mesh(group,new THREE.BoxGeometry(0.36,0.25,0.25),mat,[0,0,0]);
  const lens=mesh(group,new THREE.CylinderGeometry(0.095,0.07,0.17,20),mat,[0,0,-0.2]);lens.rotation.x=Math.PI/2;
  for(const x of [-0.09,0.09]) {const reel=mesh(group,new THREE.CylinderGeometry(0.085,0.085,0.05,20),mat,[x,0.18,0]);reel.rotation.x=Math.PI/2;}
  group.position.fromArray(camera.position);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(...camera.position),new THREE.Vector3(...camera.target),new THREE.Vector3(0,1,0)));
  group.userData.cameraId=id;
  return group;
}
