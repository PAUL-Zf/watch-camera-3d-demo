import { PRESETS, DEFAULT_CAMERAS, SURFACES } from './kinematics.js';
export const POSE_LIMITS = { raise: [-30, 120], inward: [-60, 90], elbow: [0, 140], twist: [-180, 180], wrist: [-60, 60], flip: [0, 120], spin: [-180, 180] };
export function defaultState() {
  return { schemaVersion: 1, side: 'left', preset: 'look', pose: { ...PRESETS.look }, cameras: DEFAULT_CAMERAS.map(c => ({ ...c })), selected: 0, showFrustums: true, showAllFrustums: false, showBody: true };
}
export function validateState(input) {
  if (!input || input.schemaVersion !== 1) throw new Error('不支持的配置版本');
  if (!['left', 'right'].includes(input.side)) throw new Error('佩戴手腕配置无效');
  const finiteRange = (value, min, max, name) => { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name}超出范围`); return value; };
  const pose = {};
  for (const [key, [min, max]] of Object.entries(POSE_LIMITS)) {
    const value = key === 'inward' && input.pose?.inward === undefined ? 0 : input.pose?.[key];
    pose[key] = finiteRange(value, min, max, key);
  }
  if (!Array.isArray(input.cameras) || input.cameras.length !== 4) throw new Error('配置必须包含四个摄像头槽位');
  const cameras = input.cameras.map((c, i) => {
    if (!c || !Object.hasOwn(SURFACES, c.surface) || !['body', 'base'].includes(c.attach) || typeof c.enabled !== 'boolean') throw new Error(`摄像头 ${i + 1} 配置无效`);
    return { name: 'ABCD'[i], surface: c.surface, attach: c.attach, enabled: c.enabled, yaw: finiteRange(c.yaw, -90, 90, '水平偏转'), pitch: finiteRange(c.pitch, -90, 90, '上下倾斜'), roll: finiteRange(c.roll === undefined ? 0 : c.roll, -180, 180, '画面旋转'), fov: finiteRange(c.fov, 40, 130, '水平视场角') };
  });
  return { schemaVersion: 1, side: input.side, preset: Object.hasOwn(PRESETS, input.preset) ? input.preset : 'custom', pose, cameras, selected: Number.isInteger(input.selected) && input.selected >= 0 && input.selected < 4 ? input.selected : 0, showFrustums: input.showFrustums !== false, showAllFrustums: input.showAllFrustums === true, showBody: input.showBody !== false };
}
