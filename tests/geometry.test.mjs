import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRig, updatePose, applyCameraConfig, cameraWorldPose, PRESETS, DEFAULT_CAMERAS, horizontalToVertical } from '../src/kinematics.js';
import { defaultState, validateState } from '../src/config.js';
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function camera(rig, config, pose = PRESETS.look) { const c = new THREE.PerspectiveCamera(); updatePose(rig, pose); applyCameraConfig(c, rig, config); return c; }

test('90-degree lift rotates the rear optical axis toward the 12 o’clock direction', () => {
  const rig = createRig(); const c = camera(rig, DEFAULT_CAMERAS[1], { ...PRESETS.down, flip: 90 });
  const direction = cameraWorldPose(c).direction;
  const expected = new THREE.Vector3(0, 0, 1).transformDirection(rig.swivel.matrixWorld);
  close(direction.dot(expected), 1);
  const originalPosition = cameraWorldPose(c).position;
  updatePose(rig, { ...PRESETS.down, flip: 0 });
  const flat = cameraWorldPose(c);
  assert.ok(flat.position.distanceTo(originalPosition) > .025, 'The lens must physically move around the hinge');
  const expectedFlat = new THREE.Vector3(0, -1, 0).transformDirection(rig.swivel.matrixWorld);
  close(flat.direction.dot(expectedFlat), 1);
});
test('a base-mounted camera stays fixed while a body-mounted camera flips', () => {
  const rig = createRig(), fixed = camera(rig, { ...DEFAULT_CAMERAS[2], attach: 'base' });
  const moving = camera(rig, DEFAULT_CAMERAS[2]); const before = cameraWorldPose(fixed), movingBefore = cameraWorldPose(moving);
  updatePose(rig, { ...PRESETS.look, flip: 90, spin: 70 });
  const after = cameraWorldPose(fixed), movingAfter = cameraWorldPose(moving);
  close(before.position.distanceTo(after.position), 0); close(before.direction.distanceTo(after.direction), 0);
  assert.ok(movingBefore.direction.distanceTo(movingAfter.direction) > .5);
});
test('forearm rotation moves both the base and attached cameras, with mirrored wrist placement', () => {
  const rig = createRig(), c = camera(rig, DEFAULT_CAMERAS[0], PRESETS.down);
  const before = cameraWorldPose(c);
  updatePose(rig, { ...PRESETS.down, twist: 90 });
  const after = cameraWorldPose(c);
  assert.ok(before.direction.distanceTo(after.direction) > 1);
  assert.ok(before.position.distanceTo(after.position) > .03);
  updatePose(rig, PRESETS.down, 'right'); close(rig.shoulder.position.x, -.225);
  assert.ok(cameraWorldPose(c).position.x < 0);
});
test('front and rear optical axes remain opposite through compound motion', () => {
  for (const flip of [0, 45, 90, 120]) {
    const rig = createRig(), pose = { ...PRESETS.look, flip, spin: 75, twist: 52, wrist: -35 };
    const front = camera(rig, DEFAULT_CAMERAS[0], pose), rear = camera(rig, DEFAULT_CAMERAS[1], pose);
    close(cameraWorldPose(front).direction.dot(cameraWorldPose(rear).direction), -1);
  }
});
test('horizontal FOV conversion preserves left/right image boundaries', () => {
  const hfov = 90, aspect = 4 / 3, c = new THREE.PerspectiveCamera(horizontalToVertical(hfov, aspect), aspect, .001, 10);
  c.updateMatrixWorld(true);
  close(new THREE.Vector3(1, 0, -1).project(c).x, 1);
  close(new THREE.Vector3(-1, 0, -1).project(c).x, -1);
  close(c.fov, 73.73979529168804);
});
test('every preset and surface produces finite, normalized camera transforms', () => {
  for (const pose of Object.values(PRESETS)) for (const surface of ['front', 'rear', 'twelve', 'three', 'six', 'nine']) {
    const rig = createRig(), c = camera(rig, { ...DEFAULT_CAMERAS[0], surface }, pose), result = cameraWorldPose(c);
    assert.ok(result.position.toArray().every(Number.isFinite)); close(result.direction.length(), 1);
  }
});
test('configuration roundtrip preserves angles and rejects invalid imports', () => {
  const state = defaultState(); state.pose.flip = 90; state.cameras[0].fov = 120;
  const validated = validateState(JSON.parse(JSON.stringify(state))); close(validated.pose.flip, 90); close(validated.cameras[0].fov, 120);
  assert.throws(() => validateState({ ...state, schemaVersion: 99 }));
  assert.throws(() => validateState({ ...state, pose: { ...state.pose, flip: NaN } }));
  assert.throws(() => validateState({ ...state, cameras: state.cameras.map((c, i) => i ? c : { ...c, surface: '__proto__' }) }));
  assert.throws(() => validateState({ ...state, cameras: state.cameras.map((c, i) => i ? c : { ...c, fov: 180 }) }));
});

test('front and rear image-up directions agree and both are upright in the raised-watch preset', () => {
  const rig = createRig(), front = camera(rig, DEFAULT_CAMERAS[0], PRESETS.upright), rear = camera(rig, DEFAULT_CAMERAS[1], PRESETS.upright);
  const a = cameraWorldPose(front), b = cameraWorldPose(rear);
  close(a.up.dot(b.up), 1); assert.ok(b.up.y > .99, 'Rear image top must face sky, not ground');
  close(a.direction.dot(b.direction), -1);
});
test('180-degree sensor rotation reverses image axes without changing the optical direction or lens position', () => {
  const rig = createRig(), c = camera(rig, DEFAULT_CAMERAS[1], PRESETS.upright), before = cameraWorldPose(c);
  applyCameraConfig(c, rig, { ...DEFAULT_CAMERAS[1], roll: 180 }); const after = cameraWorldPose(c);
  close(before.position.distanceTo(after.position), 0); close(before.direction.dot(after.direction), 1); close(before.up.dot(after.up), -1);
});
test('old exported configurations migrate to zero added sensor rotation, and invalid roll is rejected', () => {
  const legacy = defaultState(); legacy.cameras.forEach(c => delete c.roll);
  assert.ok(validateState(legacy).cameras.every(c => c.roll === 0));
  legacy.cameras[1].roll = 181; assert.throws(() => validateState(legacy), /画面旋转/);
});
