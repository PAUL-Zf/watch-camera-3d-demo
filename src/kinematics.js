import * as THREE from 'three';

export const RAD = Math.PI / 180;
export const SURFACES = {
  front: { label: '屏幕面 · 前摄', position: [0, .0118, .019], normal: [0, 1, 0], up: [0, 0, 1] },
  rear: { label: '表体背面 · 后摄', position: [0, -.0118, .008], normal: [0, -1, 0], up: [0, 0, 1] },
  twelve: { label: '12 点钟侧', position: [0, .002, .0295], normal: [0, 0, 1], up: [0, 1, 0] },
  three: { label: '3 点钟侧', position: [.024, .002, 0], normal: [1, 0, 0], up: [0, 1, 0] },
  six: { label: '6 点钟侧', position: [0, .002, -.0295], normal: [0, 0, -1], up: [0, 1, 0] },
  nine: { label: '9 点钟侧', position: [-.024, .002, 0], normal: [-1, 0, 0], up: [0, 1, 0] }
};
export const PRESETS = {
  look: { label: '抬腕看表', raise: 20, elbow: 110, twist: -25, wrist: 0, flip: 0, spin: 0 },
  upright: { label: '抬腕立起 · 双摄', raise: 65, elbow: 20, twist: 0, wrist: 0, flip: 90, spin: 0 },
  down: { label: '自然下垂', raise: 0, elbow: 5, twist: 0, wrist: 0, flip: 0, spin: 0 },
  forward: { label: '抬臂向前', raise: 85, elbow: 5, twist: 0, wrist: 0, flip: 90, spin: 0 }
};
export const DEFAULT_CAMERAS = [
  { name: 'A', surface: 'front', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true },
  { name: 'B', surface: 'rear', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true },
  { name: 'C', surface: 'twelve', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true },
  { name: 'D', surface: 'three', attach: 'body', yaw: 0, pitch: 0, roll: 0, fov: 90, enabled: true }
];
export function horizontalToVertical(hfov, aspect) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov * RAD / 2) / aspect));
}
export function createRig() {
  const root = new THREE.Group(); root.name = 'wearer';
  const shoulder = new THREE.Group(); shoulder.name = 'shoulder'; root.add(shoulder);
  const elbow = new THREE.Group(); elbow.name = 'elbow'; elbow.position.y = -.30; shoulder.add(elbow);
  const forearm = new THREE.Group(); forearm.name = 'forearm-roll'; elbow.add(forearm);
  const wrist = new THREE.Group(); wrist.name = 'wrist'; wrist.position.y = -.27; forearm.add(wrist);
  const mount = new THREE.Group(); mount.name = 'watch-base'; mount.position.set(0, -.006, .038); mount.rotation.x = Math.PI / 2; wrist.add(mount);
  const swivel = new THREE.Group(); swivel.name = 'base-swivel'; mount.add(swivel);
  const hinge = new THREE.Group(); hinge.name = 'hinge'; hinge.position.set(0, .006, -.029); swivel.add(hinge);
  const body = new THREE.Group(); body.name = 'movable-watch-body'; body.position.set(0, .011, .029); hinge.add(body);
  return { root, shoulder, elbow, forearm, wrist, mount, swivel, hinge, body };
}
export function updatePose(rig, pose, side = 'left', swing = 0) {
  const sign = side === 'left' ? 1 : -1;
  rig.shoulder.position.set(sign * .225, 1.38, 0);
  rig.shoulder.rotation.set(-(pose.raise + swing) * RAD, 0, 0);
  rig.elbow.rotation.x = -pose.elbow * RAD;
  rig.forearm.rotation.y = pose.twist * RAD * sign;
  rig.wrist.rotation.x = pose.wrist * RAD;
  rig.swivel.rotation.y = pose.spin * RAD;
  rig.hinge.rotation.x = -pose.flip * RAD;
  rig.root.updateMatrixWorld(true);
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
