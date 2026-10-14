import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/scene.js';
import { SURFACES, PRESETS, DEFAULT_CAMERAS, presetPose, updatePose, applyCameraConfig, cameraWorldPose } from '../src/kinematics.js';
import { sampleNearOcclusion, sensorMeshes } from '../src/occlusion.js';
import { defaultState, validateState } from '../src/config.js';
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('dial image, clock labels and lenses agree on 12 top, 3 right, 9 left', () => {
  const w = createWorld(); updatePose(w.rig, PRESETS.down);
  const dial = new THREE.PerspectiveCamera(55, 1, .001, 1);
  w.rig.body.add(dial); applyCameraConfig(dial, w.rig, DEFAULT_CAMERAS[0]);
  // Observer looks inward from the screen face, with 12 o'clock as image top.
  dial.position.set(0, .20, 0); dial.lookAt(w.rig.body.getWorldPosition(new THREE.Vector3()));
  const back = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(0, 0, 1);
  dial.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up.clone().cross(back), up, back));
  w.scene.updateMatrixWorld(true);
  const project = p => w.rig.body.localToWorld(new THREE.Vector3(...p)).project(dial);
  assert.ok(project(SURFACES.three.position).x > 0); assert.ok(project(SURFACES.nine.position).x < 0);
  assert.ok(project(SURFACES.twelve.position).y > 0); assert.ok(project(SURFACES.six.position).y < 0);
  const screen = w.scene.getObjectByName('dial-screen');
  const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(screen.quaternion);
  const screenTop = new THREE.Vector3(0, 1, 0).applyQuaternion(screen.quaternion);
  close(screenRight.dot(new THREE.Vector3(...SURFACES.three.normal)), 1);
  close(screenTop.dot(new THREE.Vector3(...SURFACES.twelve.normal)), 1);
  assert.ok(w.scene.getObjectByName('three-oclock-crown').position.x < 0);
});

test('wrist flexion and deviation move the hand, never the watch, strap or optical frame', () => {
  const w = createWorld(), camera = new THREE.PerspectiveCamera();
  for (const side of ['left', 'right']) {
    updatePose(w.rig, presetPose('look', side), side); applyCameraConfig(camera, w.rig, DEFAULT_CAMERAS[3]);
    const before = cameraWorldPose(camera), hand = w.rig.hand.getWorldQuaternion(new THREE.Quaternion());
    const strap = w.scene.getObjectByName('fitted-forearm-strap').matrixWorld.clone();
    for (const wrist of [-60, -30, 30, 60]) for (const deviation of [-20, 30]) {
      updatePose(w.rig, { ...presetPose('look', side), wrist, deviation }, side);
      const after = cameraWorldPose(camera);
      for (const key of ['position', 'direction', 'up']) close(after[key].distanceTo(before[key]), 0);
      assert.ok(w.rig.hand.getWorldQuaternion(new THREE.Quaternion()).angleTo(hand) > .1);
      assert.deepEqual(w.scene.getObjectByName('fitted-forearm-strap').matrixWorld.elements, strap.elements);
    }
  }
});

test('positive flexion bends palmward; positive deviation moves toward the mirrored thumb', () => {
  const w = createWorld();
  const fingertip = () => w.rig.forearm.worldToLocal(w.fingerTips[1].getWorldPosition(new THREE.Vector3()));
  for (const side of ['left', 'right']) {
    updatePose(w.rig, { ...PRESETS.down, wrist: 0 }, side); const neutral = fingertip();
    updatePose(w.rig, { ...PRESETS.down, wrist: 50 }, side); assert.ok(fingertip().z < neutral.z - .06);
    updatePose(w.rig, { ...PRESETS.down, wrist: -50 }, side); assert.ok(fingertip().z > neutral.z + .06);
    updatePose(w.rig, { ...PRESETS.down, wrist: 0, deviation: 25 }, side);
    assert.ok((fingertip().x - neutral.x) * (side === 'left' ? 1 : -1) > .03);
  }
});

test('skin bridge deforms continuously with finite positions and normals over wrist limits', () => {
  const w = createWorld(), geometry = w.wristBridge.geometry;
  updatePose(w.rig, PRESETS.down); const neutral = geometry.attributes.position.array.slice();
  for (const side of ['left', 'right']) for (const wrist of [-60, 0, 60]) for (const deviation of [-20, 0, 30]) {
    updatePose(w.rig, { ...PRESETS.down, wrist, deviation }, side);
    for (const attr of ['position', 'normal']) assert.ok(Array.from(geometry.attributes[attr].array).every(Number.isFinite));
    const top = geometry.attributes.position.count - 33;
    for (let i = top * 3; i < neutral.length; i++) close(geometry.attributes.position.array[i], neutral[i], 1e-7);
    assert.ok(geometry.boundingSphere.radius < .1);
  }
});

test('3 oclock hand occlusion grows during extension and disappears with body hidden', () => {
  const w = createWorld(), c = new THREE.PerspectiveCamera();
  updatePose(w.rig, { ...PRESETS.look, wrist: 0 }); applyCameraConfig(c, w.rig, DEFAULT_CAMERAS[3]);
  const initial = sampleNearOcclusion(c, sensorMeshes(w.scene, c));
  updatePose(w.rig, { ...PRESETS.look, wrist: -60 });
  const extended = sampleNearOcclusion(c, sensorMeshes(w.scene, c));
  assert.ok(extended.hand > initial.hand + 25, `${JSON.stringify(initial)} -> ${JSON.stringify(extended)}`);
  // The exact same mesh surfaces are used in sensor rendering and raycasting.
  assert.ok(sensorMeshes(w.scene, c).some(m => w.handMeshes.includes(m)));
  w.humanMeshes.forEach(m => { m.visible = false; });
  assert.equal(sampleNearOcclusion(c, sensorMeshes(w.scene, c)).hand, 0);
});

test('right wrist has the same physical dial and mirrored hand, without mirroring sensors', () => {
  const w = createWorld();
  for (const side of ['left', 'right']) {
    updatePose(w.rig, presetPose('upright', side), side);
    const c = new THREE.PerspectiveCamera(); applyCameraConfig(c, w.rig, DEFAULT_CAMERAS[1]);
    assert.ok(cameraWorldPose(c).direction.z > .8); assert.ok(cameraWorldPose(c).up.y > .99);
    const basis = new THREE.Matrix4().extractRotation(c.matrixWorld); close(basis.determinant(), 1);
  }
});

test('v1 imports migrate missing articulation and environment fields without losing slot edits', () => {
  const old = defaultState(); old.schemaVersion = 1; delete old.environment; delete old.pose.deviation;
  old.preset = 'upright'; old.pose = { ...PRESETS.upright, spin: 0 }; old.cameras[3].yaw = 34;
  const next = validateState(old); assert.equal(next.schemaVersion, 4); assert.equal(next.environment, 'calibration');
  assert.equal(next.pose.deviation, 0); assert.equal(next.pose.spin, -90); assert.equal(next.cameras[3].yaw, 34);
  assert.throws(() => validateState({ ...next, environment: 'bad' }));
});

test('meal scene switches geometry and occlusion together and supports four-point plate framing', () => {
  const w = createWorld(), c = new THREE.PerspectiveCamera();
  w.selectEnvironment('meal'); updatePose(w.rig, PRESETS.meal); applyCameraConfig(c, w.rig, DEFAULT_CAMERAS[2]);
  const meshes = sensorMeshes(w.scene, c);
  assert.ok(meshes.some(m => m.parent === w.meal.group));
  assert.ok(meshes.every(m => !w.calibration.children.includes(m)));
  for (const point of w.meal.corners) {
    const p = point.clone().project(c); assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z >= -1 && p.z <= 1);
    const origin = c.getWorldPosition(new THREE.Vector3()), delta = point.clone().sub(origin), distance = delta.length();
    const hits = new THREE.Raycaster(origin, delta.normalize(), c.near, distance - .008).intersectObjects(meshes, false);
    assert.equal(hits.length, 0, 'plate reference is obscured');
  }
  w.selectEnvironment('calibration'); assert.ok(sensorMeshes(w.scene, c).every(m => m.parent !== w.meal.group));
});
