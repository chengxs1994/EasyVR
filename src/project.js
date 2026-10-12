import { validPerformance, locomotionWindow } from './director/actions.js';
import { validateCalibration } from './panorama/calibration.js';
export const OBJECT_TYPES = ['actor', 'box', 'cylinder', 'wall', 'table', 'chair', 'stairs', 'plant', 'light', 'platform'];
export const TYPE_NAMES = {
  actor: '演员',
  light: '舞台灯',
  platform: '舞台地板',
  box: '方台',
  cylinder: '圆台',
  wall: '墙体',
  table: '桌子',
  chair: '长凳',
  stairs: '楼梯',
  plant: '绿植',
};

/** 创建具有稳定 ID 的独立场景对象；坐标采用米制和 Y 轴向上。 */
export function createObject(type, name, position = [0, 0, 0], color = '#bdc4be') {
  return {
    id: crypto.randomUUID(),
    type,
    name,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color,
    visible: true,
    motion: null,
    ...(type === 'light' ? {light:{intensity:35,angle:36}} : {}),
  };
}

/** 创建可直接编辑的模板，不依赖远程模型或生成接口。 */
export function createProject(template = 'studio') {
  const a = createObject('actor', '演员 A', [-1.3, 0, 0.4], '#d58b62');
  const b = createObject('actor', '演员 B', [1.3, 0, 0.1], '#7eaaa1');
  a.rotation[1] = Math.PI / 2;
  b.rotation[1] = -Math.PI / 2;
  const objects = [a, b];
  if (template === 'stage') {
    a.color = '#e77988'; b.color = '#69b8c5';
    const left = createObject('light','柔光 · 左',[-3,0,2],'#f0a5c9');
    const right = createObject('light','轮廓 · 右',[3,0,-2],'#8ccddd');
    left.rotation[1] = -0.65; right.rotation[1] = 2.4;
    objects.push(createObject('platform','舞台地板',[0,0,0],'#b6afc4'),left,right);
  } else if (template === 'studio') {
    const wall = createObject('wall', '背景墙', [0, 0, -3.2], '#d5cec0');
    wall.scale = [1.4, 1, 1];
    objects.push(
      wall,
      createObject('chair', '长凳', [-2, 0, -1.7], '#a99677'),
      createObject('cylinder', '圆形展台', [2.5, 0, -1.8], '#c4bcaa'),
      createObject('plant', '盆栽', [-3.3, 0, -2.2], '#788e67'),
    );
  } else if (template === 'classroom') {
    a.position = [-1, 0, -2.8];
    b.position = [1.4, 0, 1.8];
    const wall = createObject('wall', '黑板墙', [0, 0, -4.1], '#63746b');
    wall.scale = [1.5, 1, 1];
    objects.push(wall);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        objects.push(
          createObject(
            'table',
            `课桌 ${row * 3 + col + 1}`,
            [(col - 1) * 2.1, 0, row * 1.8 - 1.4],
            '#b9a47d',
          ),
        );
      }
  } else if (template === 'courtyard') {
    for (const x of [-3.5, 3.5])
      for (const z of [-2.5, 2.5]) {
        const pillar = createObject('box', '廊柱', [x, 0, z], '#d2c9b7');
        pillar.scale = [0.38, 3.5, 0.38];
        objects.push(pillar);
      }
    objects.push(
      createObject('chair', '庭院长凳', [0, 0, -2.8], '#9b8e78'),
      createObject('plant', '庭院绿植', [-2.6, 0, 2.7], '#788e67'),
    );
  }
  return {
    version: 1,
    name:
      { stage: '关节人偶 · 舞台', studio: '双人对话 · 摄影棚', classroom: '课堂 · 教室', courtyard: '庭院 · 外景', empty: '空白场景' }[
        template
      ] || '空间推演',
    template,
    objects,
    duration: 12,
    cameraLibrary: [],
    camera: { position: template === 'stage' ? [4, 1.65, 5] : [6, 3.4, 8], target: [0, 1, 0], focal: 35, aspect: '16:9', preset: '双人全景' },
    environment: { intensity: 2.8, azimuth: 40, grid: true },
  };
}

/** 校验数值向量，阻止损坏的工程污染渲染状态。 */
function vector(value, min, max) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max)
  );
}

/** 校验机位参数并复制，供活动摄影机与命名机位共用。 */
export function validateCamera(camera) {
  if (
    !camera ||
    !vector(camera.position, -1000, 1000) ||
    !vector(camera.target, -1000, 1000) ||
    !Number.isFinite(camera.focal) ||
    camera.focal < 18 ||
    camera.focal > 120 ||
    !['16:9', '9:16', '1:1', '2.35:1'].includes(camera.aspect)
  )
    throw new Error('机位参数无效');
  return {
    position: [...camera.position],
    target: [...camera.target],
    focal: camera.focal,
    aspect: camera.aspect,
    preset: typeof camera.preset === 'string' ? camera.preset.slice(0, 40) : '自定义机位',
  };
}
/** 校验命名机位库；旧工程缺少此字段时按空库迁移。 */
export function validateCameraLibrary(value = []) {
  if (!Array.isArray(value) || value.length > 16) throw new Error('每个场景最多保存 16 个机位');
  const ids = new Set();
  return value.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 40 ||
      typeof item.thumbnail !== 'string' ||
      item.thumbnail.length > 160000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.thumbnail)
    )
      throw new Error('机位名称、编号或预览图无效');
    ids.add(item.id);
    return { id: item.id, name: item.name, thumbnail: item.thumbnail, camera: validateCamera(item.camera) };
  });
}

/** 导入前完整验证白名单字段，并返回与输入分离的数据副本。 */
export function validateProject(p) {
  const fail = () => {
    throw new Error('工程格式无效：请导入 EasyVR 导出的 .json 工程文件。');
  };
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== 'string' ||
    p.name.length > 100 ||
    !Array.isArray(p.objects) ||
    p.objects.length > 200
  )
    fail();
  if (!Number.isFinite(p.duration) || p.duration < 1 || p.duration > 120) fail();
  if (
    !p.camera ||
    !vector(p.camera.position, -1000, 1000) ||
    !vector(p.camera.target, -1000, 1000) ||
    !Number.isFinite(p.camera.focal) ||
    p.camera.focal < 18 ||
    p.camera.focal > 120 ||
    !['16:9', '9:16', '1:1', '2.35:1'].includes(p.camera.aspect)
  )
    fail();
  if (
    !p.environment ||
    !Number.isFinite(p.environment.intensity) ||
    p.environment.intensity < 0 ||
    p.environment.intensity > 6 ||
    !Number.isFinite(p.environment.azimuth) ||
    p.environment.azimuth < 0 ||
    p.environment.azimuth > 360 ||
    typeof p.environment.grid !== 'boolean'
  )
    fail();
  if (p.environment.panorama === 'canvas-panorama' && (typeof p.environment.panoramaImage !== 'string' || p.environment.panoramaImage.length > 800000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.environment.panoramaImage))) fail();
  if (p.environment.panorama != null && !['residential-living-room', 'canvas-panorama'].includes(p.environment.panorama)) fail();
  const ids = new Set();
  const objects = p.objects.map((o) => {
    if (
      !o ||
      typeof o.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(o.id) ||
      ids.has(o.id) ||
      !OBJECT_TYPES.includes(o.type) ||
      typeof o.name !== 'string' ||
      o.name.length > 80 ||
      !/^#[0-9a-f]{6}$/i.test(o.color) ||
      typeof o.visible !== 'boolean' ||
      !vector(o.position, -100, 100) ||
      !vector(o.rotation, -1000, 1000) ||
      !vector(o.scale, 0.05, 20)
    )
      fail();
    if (o.groundLock !== undefined && typeof o.groundLock !== 'boolean') fail();
    if (o.type === 'light' && o.light && (!Number.isFinite(o.light.intensity) || o.light.intensity < 0 || o.light.intensity > 100 || !Number.isFinite(o.light.angle) || o.light.angle < 10 || o.light.angle > 80)) fail();
    if (!validPerformance(o, p.duration)) fail();
    ids.add(o.id);
    if (
      o.motion &&
      (o.type !== 'actor' ||
        !vector(o.motion.from, -100, 100) ||
        !vector(o.motion.to, -100, 100) ||
        !Number.isFinite(o.motion.start) ||
        !Number.isFinite(o.motion.end) ||
        o.motion.start < 0 ||
        o.motion.end <= o.motion.start ||
        o.motion.end > p.duration)
    )
      fail();
    return {
      id: o.id,
      type: o.type,
      name: o.name,
      position: [...o.position],
      rotation: [...o.rotation],
      scale: [...o.scale],
      color: o.color,
      visible: o.visible,
      ...(o.pose !== undefined ? {pose:o.pose} : {}),
      ...(o.action ? {action:{type:o.action.type,start:o.action.start,end:o.action.end}} : {}),
      ...(o.type === 'light' ? {light:{intensity:o.light?.intensity ?? 35,angle:o.light?.angle ?? 36}} : {}),
      ...(o.groundLock !== undefined ? { groundLock: o.groundLock } : {}),
      motion: o.motion
        ? { from: [...o.motion.from], to: [...o.motion.to], start: o.motion.start, end: o.motion.end }
        : null,
    };
  });
  return {
    version: 1,
    name: p.name,
    template: ['stage', 'studio', 'classroom', 'courtyard', 'empty'].includes(p.template) ? p.template : 'empty',
    objects,
    duration: p.duration,
    camera: {
      position: [...p.camera.position],
      target: [...p.camera.target],
      focal: p.camera.focal,
      aspect: p.camera.aspect,
      preset: typeof p.camera.preset === 'string' ? p.camera.preset.slice(0, 40) : '自定义机位',
    },
    cameraLibrary: validateCameraLibrary(p.cameraLibrary),
    environment: {
      intensity: p.environment.intensity,
      azimuth: p.environment.azimuth,
      grid: p.environment.grid,
      ...(p.environment.panoramaCalibration ? { panoramaCalibration: validateCalibration(p.environment.panoramaCalibration) } : {}),
      ...(p.environment.panorama ? { panorama: p.environment.panorama } : {}),
      ...(p.environment.panorama === 'canvas-panorama' ? { panoramaImage: p.environment.panoramaImage } : {}),
    },
  };
}

/** 按绝对时间采样走位；回放和拖动不会修改编辑状态。 */
export function sampleMotion(object, time) {
  if (!object.motion) return { position: [...object.position], yaw: object.rotation[1], walking: false };
  const { from, to, start, end } = object.motion;
  const transition = locomotionWindow(object)?.transition || 0;
  const moveStart = start + transition, moveEnd = end - transition;
  const alpha = Math.max(0, Math.min(1, (time - moveStart) / (moveEnd - moveStart)));
  const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
  return {
    position: from.map((v, i) => v + (to[i] - v) * alpha),
    yaw: distance > 0.001 ? Math.atan2(to[0] - from[0], to[2] - from[2]) : object.rotation[1],
    walking: time > moveStart && time < moveEnd && distance > 0.001,
  };
}

/** 使用有界快照保存跨对象、机位与模板操作的撤销记录。 */
export class History {
  /** 初始化历史，不持有调用方的可变引用。 */
  constructor(initial) {
    this.items = [structuredClone(initial)];
    this.index = 0;
  }
  /** 记录新操作并清除已经撤销的后续分支。 */
  push(value) {
    if (JSON.stringify(this.items[this.index]) === JSON.stringify(value)) return;
    this.items = this.items.slice(0, this.index + 1);
    this.items.push(structuredClone(value));
    if (this.items.length > 60) this.items.shift();
    this.index = this.items.length - 1;
  }
  /** 返回是否存在前一步。 */
  get canUndo() {
    return this.index > 0;
  }
  /** 返回是否存在被撤销的后续步骤。 */
  get canRedo() {
    return this.index < this.items.length - 1;
  }
  /** 撤销一步并返回可安全编辑的副本。 */
  undo() {
    if (this.canUndo) this.index--;
    return structuredClone(this.items[this.index]);
  }
  /** 重做一步并返回可安全编辑的副本。 */
  redo() {
    if (this.canRedo) this.index++;
    return structuredClone(this.items[this.index]);
  }
}
