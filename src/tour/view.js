export const FACE_ORDER = ['r', 'l', 'u', 'd', 'f', 'b'];
export const FACE_VIEWS = { f: [0, 0], r: [90, 0], b: [180, 0], l: [270, 0], u: [0, 89.9], d: [0, -89.9] };

/** 將視角限制在有效範圍，避免極點翻轉與異常縮放。 */
export function normalizeView({ yaw = 0, pitch = 0, fov = 65 } = {}) {
  if (![yaw, pitch, fov].every(Number.isFinite)) throw new Error('视角参数必须为有限数字');
  return { yaw: ((yaw % 360) + 360) % 360, pitch: Math.max(-89.9, Math.min(89.9, pitch)), fov: Math.max(25, Math.min(95, fov)) };
}

/** 以原始尺寸驗證六面圖，禁止補圖、縮放或格式轉換。 */
export function validateFaces(images, maxSize = Infinity) {
  if (images.length !== 6) throw new Error('场景需要完整的六张图片');
  const size = images[0].naturalWidth;
  if (!size || images.some(image => image.naturalWidth !== size || image.naturalHeight !== size)) throw new Error('六张图片必须为相同尺寸的正方形');
  if (size > maxSize) throw new Error(`图片尺寸 ${size} 超出当前设备的纹理限制 ${maxSize}`);
  return size;
}
