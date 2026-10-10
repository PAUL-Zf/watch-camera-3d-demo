import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/scene.js';
import { updatePose, applyCameraConfig, DEFAULT_CAMERAS, PRESETS, cameraWorldPose } from '../src/kinematics.js';
// Geometry and raycasting need texture objects, but no pixel drawing or WebGL.
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) };
function hitAlongAxis(world, c, distance = .5) {
  world.scene.updateMatrixWorld(true);
  const { position, direction } = cameraWorldPose(c);
  const ray = new THREE.Raycaster(position, direction, .0004, distance);
  const meshes = []; world.scene.traverse(o => { if (o.isMesh && o.layers.test(c.layers)) meshes.push(o); });
  return ray.intersectObjects(meshes, false)[0];
}
test('a flat rear camera is carrier-occluded; upright rear optical axis clears carrier and case', () => {
  const world = createWorld(), c = new THREE.PerspectiveCamera();
  updatePose(world.rig, PRESETS.down); applyCameraConfig(c, world.rig, DEFAULT_CAMERAS[1]);
  const flatHit = hitAlongAxis(world, c, .08); assert.ok(flatHit && flatHit.distance < .003, 'Carrier must block rear lens in flat mode');
  updatePose(world.rig, { ...PRESETS.down, flip: 90 });
  const openHit = hitAlongAxis(world, c, .08); assert.equal(openHit, undefined, 'An open rear lens must not be embedded in its own shell');
});
test('all six body-mounted lenses start outside the physical shell', () => {
  const world = createWorld();
  updatePose(world.rig, { ...PRESETS.forward, flip: 90 });
  for (const surface of ['front', 'rear', 'twelve', 'three', 'six', 'nine']) {
    const c = new THREE.PerspectiveCamera(); applyCameraConfig(c, world.rig, { ...DEFAULT_CAMERAS[0], surface });
    const hit = hitAlongAxis(world, c, .0005);
    assert.equal(hit, undefined, `${surface} lens is incorrectly embedded in shell`);
  }
});
test('look-at-watch preset places facial landmarks inside the front camera field', () => {
  const world = createWorld(), c = new THREE.PerspectiveCamera();
  updatePose(world.rig, PRESETS.look); applyCameraConfig(c, world.rig, DEFAULT_CAMERAS[0]);
  const inside = world.facePoints.filter(p => { const q = p.clone().project(c); return q.z >= -1 && q.z <= 1 && Math.abs(q.x) < 1 && Math.abs(q.y) < 1; });
  assert.ok(inside.length >= 4, `Only ${inside.length}/5 face landmarks are in view`);
});
test('upright preset sees facial points from front and frontal scene targets from rear', () => {
  const world = createWorld(), front = new THREE.PerspectiveCamera(), rear = new THREE.PerspectiveCamera();
  updatePose(world.rig, PRESETS.upright); applyCameraConfig(front, world.rig, DEFAULT_CAMERAS[0]); applyCameraConfig(rear, world.rig, DEFAULT_CAMERAS[1]);
  const inside = (p, c) => { const q = p.clone().project(c); return q.z >= -1 && q.z <= 1 && Math.abs(q.x) < 1 && Math.abs(q.y) < 1; };
  assert.ok(world.facePoints.filter(p => inside(p, front)).length >= 4);
  assert.ok(world.targets.some(t => inside(t.point, rear)));
});

test('rear camera projects frontal sign rightward and upward, with no inversion or mirror', () => {
  const world = createWorld(), rear = new THREE.PerspectiveCamera();
  updatePose(world.rig, PRESETS.upright); applyCameraConfig(rear, world.rig, DEFAULT_CAMERAS[1]); world.scene.updateMatrixWorld(true);
  const sign = world.scene.getObjectByName('sign-VISION');
  const projectLocal = vector => sign.localToWorld(vector).project(rear);
  const left = projectLocal(new THREE.Vector3(-.25, 0, 0)), right = projectLocal(new THREE.Vector3(.25, 0, 0));
  const bottom = projectLocal(new THREE.Vector3(0, -.14, 0)), top = projectLocal(new THREE.Vector3(0, .14, 0));
  assert.ok(right.x > left.x, 'Text is mirrored left-to-right'); assert.ok(top.y > bottom.y, 'Text is upside down');
});

test('inward look-at-watch preset retains unoccluded facial landmarks on either wrist', () => {
  const world = createWorld(), c = new THREE.PerspectiveCamera();
  for (const side of ['left', 'right']) {
    updatePose(world.rig, PRESETS.look, side); applyCameraConfig(c, world.rig, DEFAULT_CAMERAS[0]); world.scene.updateMatrixWorld(true);
    const meshes = []; world.scene.traverse(o => { if (o.isMesh && o.layers.test(c.layers)) meshes.push(o); });
    const origin = c.getWorldPosition(new THREE.Vector3());
    const visible = world.facePoints.filter(point => {
      const p = point.clone().project(c); if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return false;
      const delta = point.clone().sub(origin), distance = delta.length();
      return new THREE.Raycaster(origin, delta.normalize(), c.near, distance - .008).intersectObjects(meshes, false).length === 0;
    });
    assert.ok(visible.length >= 4, `${side}: face is blocked by the inward arm`);
  }
});
