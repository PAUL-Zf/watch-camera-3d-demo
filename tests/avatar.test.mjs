import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAvatar } from '../src/avatar.js';
import { createRig, updatePose, applyCameraConfig, PRESETS, DEFAULT_CAMERAS, cameraWorldPose } from '../src/kinematics.js';

test('the detailed avatar leaves every preset and camera attachment transform unchanged', () => {
  const reference = createRig(), rig = createRig(); createAvatar(rig);
  for (const side of ['left', 'right']) for (const pose of Object.values(PRESETS)) {
    updatePose(reference, pose, side); updatePose(rig, pose, side);
    for (const config of DEFAULT_CAMERAS) for (const attach of ['body', 'base']) {
      const a = new THREE.PerspectiveCamera(), b = new THREE.PerspectiveCamera();
      applyCameraConfig(a, reference, { ...config, attach }); applyCameraConfig(b, rig, { ...config, attach });
      const expected = cameraWorldPose(a), actual = cameraWorldPose(b);
      for (const property of ['position', 'direction', 'up']) assert.ok(expected[property].distanceTo(actual[property]) < 1e-10);
    }
  }
});

test('all avatar details are finite sensor-visible meshes registered for the body toggle', () => {
  const rig = createRig(), { humanMeshes } = createAvatar(rig), all = [];
  rig.root.traverse(o => { if (o.isMesh) all.push(o); });
  assert.equal(all.length, humanMeshes.length); assert.equal(new Set(humanMeshes).size, all.length);
  for (const mesh of all) {
    assert.equal(mesh.userData.kind, 'human'); assert.equal(mesh.layers.mask, 1);
    assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(mesh.geometry.attributes.normal.array).every(Number.isFinite));
  }
});
