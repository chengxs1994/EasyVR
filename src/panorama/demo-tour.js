import * as THREE from 'three';
import { createScene } from './tour.js';

/** 在同一套简化住宅中烘焙三个观察位置，生成无需网络的演示全景。 */
export async function createDemoTour() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(2048, 1024);
  const house = new THREE.Scene();
  house.background = new THREE.Color('#c7d4dd');
  house.add(new THREE.HemisphereLight(0xffffff, 0xa99980, 2.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-3, 8, 4); house.add(sun);
  const resources = [];
  /** 添加彩色家具或建筑体块，并登记待释放的 GPU 资源。 */
  function box(size, position, color) {
    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshLambertMaterial({color});
    resources.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); house.add(mesh);
  }
  /** 生成房间，前后墙留出通向相邻空间的门洞。 */
  function room(width, depth, z, color, frontDoor, backDoor) {
    box([width,.12,depth],[0,-.06,z],'#ad8f6c');
    box([width,.1,depth],[0,3.1,z],'#eee9df');
    for (const x of [-width/2,width/2]) box([.12,3.1,depth],[x,1.55,z],color);
    for (const [wallZ,door] of [[z-depth/2,frontDoor],[z+depth/2,backDoor]]) {
      if (!door) box([width,3.1,.12],[0,1.55,wallZ],color);
      else {
        for(const sign of [-1,1]) box([(width-1.8)/2,3.1,.12],[sign*(width+1.8)/4,1.55,wallZ],color);
        box([1.8,.6,.16],[0,2.8,wallZ],color);
      }
    }
    for (let x=-width/2+.5;x<width/2;x+=.5) box([.012,.005,depth],[x,.004,z],'#8e7558');
  }
  room(8,8,3,'#d3c9b7',true,false);
  room(2.4,7,-4.5,'#b5c6bd',true,true);
  room(7,6,-11,'#aebcca',false,true);
  // 客厅：沙发、地毯、茶几、电视与落地窗。
  box([2.7,.55,1.1],[-2.3,.45,2.3],'#77968a');
  box([2.7,.65,.2],[-2.3,.95,2.8],'#567e6b');
  box([3.2,.025,2.8],[-1.6,.03,.9],'#dfd8c5');
  box([1.5,.12,.85],[-1.5,.55,.5],'#624c3c');
  for(const x of [-2,-1]) box([.08,.5,.6],[x,.26,.5],'#43372e');
  box([.14,1.25,2.1],[3.85,1.55,1.5],'#253540');
  box([.05,1.8,2.5],[-3.92,1.8,4.8],'#b5dae4');
  // 走廊：墙画、灯带与入口地垫。
  for(const z of [-2.7,-5.8]) {
    box([.04,.9,.7],[-1.12,1.7,z],'#846c54');
    box([.05,.7,.5],[-1.08,1.7,z],'#e4c38f');
    box([.8,.025,.3],[0,3.02,z],'#fff2cb');
  }
  box([1.5,.02,2],[0,.02,-4.5],'#6b887d');
  // 书房：书架、书桌与座椅。
  box([.45,2.4,3],[-3.2,1.2,-11],'#6d5543');
  for (let level=0;level<4;level++) for(let book=0;book<9;book++)
    box([.5,.38,.17],[-3.12,.35+level*.55,-12.2+book*.28],['#69858d','#c0976f','#877492'][book%3]);
  box([2.3,.12,1.1],[1, .8,-12.6],'#c1a17a');
  for(const x of [0,2]) box([.12,.75,.8],[x,.38,-12.6],'#594a3f');
  box([.9,.6,.08],[1,1.2,-12.8],'#33424b');
  box([.65,.15,.65],[1,.5,-11.5],'#816b97');
  box([.65,.8,.1],[1,.8,-11.2],'#65517b');
  const target = new THREE.WebGLCubeRenderTarget(512);
  const camera = new THREE.CubeCamera(.05,60,target);
  const quadScene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2,2);
  const material = new THREE.ShaderMaterial({
    uniforms: { panorama: {value:target.texture} },
    vertexShader: 'varying vec2 uvOut; void main(){uvOut=uv; gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform samplerCube panorama; varying vec2 uvOut;
      void main(){float phi=uvOut.x*6.283185307; float theta=(1.-uvOut.y)*3.141592654;
        vec3 direction=vec3(cos(phi)*sin(theta),cos(theta),sin(phi)*sin(theta));
        gl_FragColor=textureCube(panorama,direction);
        #include <colorspace_fragment>
      }`,
  });
  quadScene.add(new THREE.Mesh(geometry,material));
  try {
    const scenes=[];
    for (const [name,z] of [['演示 · 客厅',3],['演示 · 走廊',-4.5],['演示 · 书房',-11]]) {
      camera.position.set(0,1.6,z); camera.update(renderer,house);
      renderer.setRenderTarget(null); renderer.render(quadScene,new THREE.Camera());
      const blob = await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('演示全景生成失败')),'image/png'));
      const scene=createScene(blob,name); scene.demoKey='home-tour-v1';
      scene.view.pitch=-8; scene.arrival.pitch=-8;
      scenes.push(scene);
    }
    // 书房进入后面朝来路，方便直接体验返回热点。
    scenes[2].view.yaw=scenes[2].arrival.yaw=180;
    for(const [from,to,yaw] of [[0,1,0],[1,2,0],[1,0,180],[2,1,180]])
      scenes[from].hotspots.push({id:crypto.randomUUID(),targetId:scenes[to].id,yaw,pitch:-17});
    return scenes;
  } finally {
    for(const resource of resources) resource.dispose();
    geometry.dispose(); material.dispose(); target.dispose(); renderer.dispose();
  }
}
