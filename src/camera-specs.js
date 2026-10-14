// Output sampling presets, independent of package size and HFOV.
export const PHOTO_RESOLUTIONS = {
  vga: { width: 640, height: 480, label: '30 万 · 640×480' },
  uxga: { width: 1600, height: 1200, label: '200 万 · 1600×1200' },
  five: { width: 2592, height: 1944, label: '500 万 · 2592×1944' },
  eight: { width: 3264, height: 2448, label: '800 万 · 3264×2448' }
};
export const MODULE_LIMITS = { moduleWidth: [2, 12], moduleDepth: [1, 8] };
export const DEFAULT_CAMERA_SPEC = { moduleWidth: 6, moduleDepth: 3, resolution: 'vga' };
export function photoResolution(config) {
  const key = config.resolution ?? DEFAULT_CAMERA_SPEC.resolution;
  if (!Object.hasOwn(PHOTO_RESOLUTIONS, key)) throw new Error('照片分辨率无效');
  return PHOTO_RESOLUTIONS[key];
}
export function pixelLabel(config) {
  const { width, height } = photoResolution(config);
  return `${(width * height / 1e6).toFixed(2)} MP · ${width}×${height}`;
}
