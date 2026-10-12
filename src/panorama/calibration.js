export const DEFAULT_CALIBRATION = { eyeHeight: 1.6, pitch: 0, roll: 0 };

/** 校验全景校准值，避免损坏的高度或倾斜参数进入相机与背景。 */
export function validateCalibration(value = DEFAULT_CALIBRATION) {
  if (!value || !Number.isFinite(value.eyeHeight) || value.eyeHeight < 0.8 || value.eyeHeight > 2.5
    || !Number.isFinite(value.pitch) || Math.abs(value.pitch) > 15
    || !Number.isFinite(value.roll) || Math.abs(value.roll) > 15) throw new Error('全景校准参数无效');
  return { eyeHeight: value.eyeHeight, pitch: value.pitch, roll: value.roll };
}
/** 将校准拍摄高度用于固定观察位置，旧工程回退到默认高度。 */
export function panoramaEye(project) {
  return [0, project?.environment?.panoramaCalibration?.eyeHeight ?? 1.6, 0];
}
/** 默认让位于地面的全景演员贴地，已悬空或明确解锁的演员保留原高度。 */
export function isGrounded(project, actor) {
  return !!project?.environment?.panorama && actor?.type === 'actor'
    && (actor.groundLock ?? actor.position[1] === 0);
}
/** 贴地约束同时处理人物坐标和走位两端，避免播放时再次离地。 */
export function groundActor(actor) {
  actor.position[1] = 0;
  if (actor.motion) { actor.motion.from[1] = 0; actor.motion.to[1] = 0; }
}
