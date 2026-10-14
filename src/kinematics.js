import * as THREE from 'three';
import { DEFAULT_CAMERA_SPEC } from './camera-specs.js';

export const RAD = Math.PI / 180;
export const SURFACES = {
  front: { label: '屏幕面 · 前摄', position: [0, .0118, .019], normal: [0, 1, 0], up: [0, 0, 1] },
  rear: { label: '表体背面 · 后摄', position: [0, -.0118, .008], normal: [0, -1, 0], up: [0, 0, 1] },
  twelve: { label: '12 点钟侧', position: [0, .002, .0295], normal: [0, 0, 1], up: [0, 1, 0] },
  three: { label: '3 点钟侧', position: [-.024, .002, 0], normal: [-1, 0, 0], up: [0, 1, 0] },
  six: { label: '6 点钟侧', position: [0, .002, -.0295], normal: [0, 0, -1], up: [0, 1, 0] },
  nine: { label: '9 点钟侧', position: [.024, .002, 0], normal: [1, 0, 0], up: [0, 1, 0] }
};
export const PRESETS = {
  look: { label: '抬腕看表', raise: 45, inward: 35, elbow: 95, twist: -28, wrist: 0, flip: 0, spin: 0 },
  upright: { label: '抬腕立起 · 双摄', raise: 90, inward: 25, elbow: 0, twist: 0, wrist: 0, flip: 90, spin: -90 },
  down: { label: '自然下垂', raise: 0, inward: 0, elbow: 5, twist: 0, wrist: 0, flip: 0, spin: 0 },
  meal: { label: '餐桌食物取景', raise: 70, inward: 15, elbow: 45, twist: 90, wrist: 0, deviation: 0, flip: 0, spin: 0 },
  forward: { label: '抬臂向前', raise: 85, inward: 0, elbow: 5, twist: 0, wrist: 0, flip: 90, spin: -90 }
};
export function presetPose(key, side = 'left', wearDistance = 53) {
  const pose = { deviation: 0, wearDistance, ...PRESETS[key] };
  if (side === 'right' && ['upright', 'forward'].includes(key)) pose.spin *= -1;
  return pose;
}
export const DEFAULT_CAMERAS = [
  { name: 'A', surface: 'front', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true, ...DEFAULT_CAMERA_SPEC },
  { name: 'B', surface: 'rear', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true, ...DEFAULT_CAMERA_SPEC },
  { name: 'C', surface: 'twelve', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true, ...DEFAULT_CAMERA_SPEC },
  { name: 'D', surface: 'three', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true, ...DEFAULT_CAMERA_SPEC }
];
export function horizontalToVertical(hfov, aspect) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov * RAD / 2) / aspect));
}
// Elliptical forearm cross-sections shared by the watch mount and strap fitting.
export function forearmRadius(y) {
  const profile = [[-.27, .027, .022], [-.257, .028, .023], [-.25, .029, .025], [-.247, .029, .025], [-.215, .032, .027], [-.12, .041, .035], [-.055, .043, .038]];
  for (let i = 1; i < profile.length; i++) {
    if (y <= profile[i][0]) {
      const a = profile[i - 1], b = profile[i], t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
      return { x: THREE.MathUtils.lerp(a[1], b[1], t), z: THREE.MathUtils.lerp(a[2], b[2], t) };
    }
  }
  return { x: .043, z: .038 };
}
export function createRig() {
  const root = new THREE.Group(); root.name = 'wearer';
  const shoulder = new THREE.Group(); shoulder.name = 'shoulder'; root.add(shoulder);
  const elbow = new THREE.Group(); elbow.name = 'elbow'; elbow.position.y = -.30; shoulder.add(elbow);
  const forearm = new THREE.Group(); forearm.name = 'forearm-roll'; elbow.add(forearm);
  const wrist = new THREE.Group(); wrist.name = 'wrist'; wrist.position.y = -.27; forearm.add(wrist);
  const hand = new THREE.Group(); hand.name = 'midcarpal-hand'; hand.position.y = -.014; wrist.add(hand);
  // The strap encircles the distal forearm, proximal to the wrist articulation.
  // It must NOT rotate with wrist flexion. 3 o'clock points toward the hand on
  // the left wrist; the same physical dial faces the opposite way on the right.
  const mount = new THREE.Group(); mount.name = 'watch-base'; mount.position.set(0, -.217, .036); mount.rotation.set(Math.PI / 2, Math.PI / 2, 0); forearm.add(mount);
  const swivel = new THREE.Group(); swivel.name = 'base-swivel'; mount.add(swivel);
  const hinge = new THREE.Group(); hinge.name = 'hinge'; hinge.position.set(0, .006, -.029); swivel.add(hinge);
  const body = new THREE.Group(); body.name = 'movable-watch-body'; body.position.set(0, .011, .029); hinge.add(body);
  return { root, shoulder, elbow, forearm, wrist, hand, mount, swivel, hinge, body };
}
export function updatePose(rig, pose, side = 'left', swing = 0) {
  const sign = side === 'left' ? 1 : -1;
  rig.shoulder.position.set(sign * .225, 1.38, 0);
  // Rotate the flexion plane toward the torso before raising the arm.
  // Positive inward has the same meaning on either wrist. Elbow remains
  // a hinge; forearm twist remains a separate rotation about its own axis.
  rig.shoulder.rotation.set(-(pose.raise + swing) * RAD, -(pose.inward ?? 0) * sign * RAD, 0, 'YXZ');
  rig.elbow.rotation.x = -pose.elbow * RAD;
  rig.forearm.rotation.y = pose.twist * RAD * sign;
  // Two serial articulation centres approximate radiocarpal + midcarpal motion.
  // Positive flexion is toward the palm (-Z), negative is dorsal extension.
  rig.wrist.rotation.set(pose.wrist * RAD * .65, 0, (pose.deviation ?? 0) * sign * RAD * .65);
  rig.hand.rotation.set(pose.wrist * RAD * .35, 0, (pose.deviation ?? 0) * sign * RAD * .35);
  rig.hand.scale.x = sign;
  const wearDistance = pose.wearDistance ?? 53, mountY = -.27 + wearDistance / 1000;
  const radius = forearmRadius(mountY);
  rig.mount.position.set(0, mountY, radius.z + .009);
  rig.updateStrap?.(wearDistance, mountY);
  rig.mount.rotation.set(Math.PI / 2, sign * Math.PI / 2, 0);
  rig.swivel.rotation.y = pose.spin * RAD;
  rig.hinge.rotation.x = -pose.flip * RAD;
  rig.root.updateMatrixWorld(true);
  rig.updateSoftTissue?.();
}
export function applyCameraConfig(camera, rig, config, aspect = 4 / 3) {
  const surface = SURFACES[config.surface];
  const parent = config.attach === 'base' ? rig.mount : rig.body;
  if (camera.parent !== parent) parent.add(camera);
  camera.position.fromArray(surface.position);
  if (config.attach === 'base') {
    // The fixed carrier is a separate, thinner part of the watch.
    if (config.surface === 'front') camera.position.y = .0056;
    if (config.surface === 'rear') camera.position.y = -.0048;
    if (config.surface === 'twelve' || config.surface === 'six') camera.position.z *= 1.1;
    if (config.surface === 'three' || config.surface === 'nine') camera.position.x *= 1.1;
  }
  // Optical direction alone leaves sensor roll undefined. Define a complete
  // right-handed sensor frame: camera +Z points backward, +Y is image top.
  // Both face lenses have image top toward 12 o'clock. For the rear this is
  // a 180-degree roll correction relative to the old shortest-arc quaternion.
  const backward = new THREE.Vector3(...surface.normal).negate();
  const right = new THREE.Vector3(...surface.up).cross(backward).normalize();
  const imageUp = backward.clone().cross(right).normalize();
  camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, imageUp, backward));
  camera.rotateY(config.yaw * RAD);
  camera.rotateX(config.pitch * RAD);
  camera.rotateZ((config.roll ?? 0) * RAD);
  camera.aspect = aspect;
  camera.fov = horizontalToVertical(config.fov, aspect);
  camera.near = .0004; camera.far = 12;
  camera.updateProjectionMatrix();
  rig.root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
}
export function cameraWorldPose(camera) {
  return { position: camera.getWorldPosition(new THREE.Vector3()), direction: camera.getWorldDirection(new THREE.Vector3()), up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())) };
}
