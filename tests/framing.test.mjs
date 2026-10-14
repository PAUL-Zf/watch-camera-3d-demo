import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/scene.js';
import { presetPose, updatePose, applyCameraConfig, DEFAULT_CAMERAS, cameraWorldPose, forearmRadius } from '../src/kinematics.js';
import { defaultState, validateState } from '../src/config.js';
import { fitMealToCamera } from '../src/framing.js';
import { sensorMeshes } from '../src/occlusion.js';
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };

test('wearing distance translates case and every attached lens along forearm, without moving hand or optical aim', () => {
  const w = createWorld(), camera = new THREE.PerspectiveCamera();
  for (const side of ['left','right']) for (const attach of ['body','base']) {
    updatePose(w.rig, presetPose('look',side,10),side);
    applyCameraConfig(camera,w.rig,{...DEFAULT_CAMERAS[3],attach});
    const before = cameraWorldPose(camera), hand = w.rig.hand.getWorldPosition(new THREE.Vector3());
    updatePose(w.rig,presetPose('look',side,120),side); const after = cameraWorldPose(camera);
    assert.ok(after.position.distanceTo(before.position) > .084);
    assert.ok(after.direction.distanceTo(before.direction) < 1e-9);
    assert.ok(hand.distanceTo(w.rig.hand.getWorldPosition(new THREE.Vector3())) < 1e-9);
    assert.ok(Math.abs(w.rig.mount.position.y - (-.27+.120)) < 1e-9);
    assert.ok(Math.abs(w.rig.mount.position.z - (forearmRadius(-.15).z+.009)) < 1e-9);
  }
});

test('band moves with the mount and fits both forearm edges rather than scaling an old rigid ring', () => {
  const w = createWorld(), band = w.scene.getObjectByName('fitted-forearm-strap');
  for (const distance of [10,15,35,53,85,120]) {
    updatePose(w.rig,presetPose('look','left',distance));
    const positions=band.geometry.attributes.position;
    for (let k=0;k<4;k++) {
      const y = -.27+distance/1000+(k<2?-.01:.01), radius=forearmRadius(y), gap=k===0||k===3?.0008:.004;
      assert.ok(Math.abs(positions.getY(k)-y)<1e-7);
      assert.ok(Math.abs(positions.getZ(k)-(radius.z+gap))<1e-7);
    }
    assert.ok(Array.from(band.geometry.attributes.normal.array).every(Number.isFinite));
  }
});

function assertFramed(world, result, config, side) {
  assert.equal(result.framed,true,result.reason); assert.equal(result.visibleCorners,4);
  updatePose(world.rig,result.pose,side); const c=new THREE.PerspectiveCamera(); applyCameraConfig(c,world.rig,config);
  const meshes=sensorMeshes(world.scene,c),origin=c.getWorldPosition(new THREE.Vector3());
  for (const point of [world.meal.targets[0].point,...world.meal.corners]) {
    const p=point.clone().project(c); assert.ok(Math.abs(p.x)<.96&&Math.abs(p.y)<.96&&p.z>=-1&&p.z<=1);
    const delta=point.clone().sub(origin),distance=delta.length();
    assert.equal(new THREE.Raycaster(origin,delta.normalize(),c.near,distance-.008).intersectObjects(meshes,false).length,0);
  }
  c.removeFromParent();
}

test('quick framing handles all six body lens surfaces on both wrists while preserving selected camera parameters', () => {
  const w=createWorld(); w.selectEnvironment('meal');
  for (const side of ['left','right']) for (const surface of ['front','rear','twelve','three','six','nine']) {
    const config={...DEFAULT_CAMERAS[0],surface},before=JSON.stringify(config),pose=presetPose('look',side,85);
    const original=JSON.stringify(pose),result=fitMealToCamera(w,config,pose,side);
    assertFramed(w,result,config,side);
    assert.equal(result.pose.flip,surface==='rear'?90:pose.flip); assert.equal(result.pose.spin,pose.spin);
    assert.equal(result.pose.wearDistance,85); assert.equal(JSON.stringify(config),before); assert.equal(JSON.stringify(pose),original);
  }
});

test('quick framing respects narrow FOV, nonzero sensor angles, rotation and fixed carrier attachment', () => {
  const w=createWorld();w.selectEnvironment('meal');
  for (const config of [
    {...DEFAULT_CAMERAS[0],yaw:20,pitch:-15,roll:90,fov:60},
    {...DEFAULT_CAMERAS[2],attach:'base',yaw:-15,pitch:10,roll:35,fov:60},
    {...DEFAULT_CAMERAS[3],fov:40},
  ]) {
    const before=JSON.stringify(config),pose=presetPose('look');const result=fitMealToCamera(w,config,pose);
    assertFramed(w,result,config,'left');assert.equal(JSON.stringify(config),before);
    if(config.attach==='base') {assert.equal(result.pose.flip,pose.flip);assert.equal(result.pose.spin,pose.spin);}
  }
});

test('closed lenses and skin-facing base rear fail explicitly without changing the pose or rig', () => {
  const w=createWorld();w.selectEnvironment('meal');const pose=presetPose('look');updatePose(w.rig,pose);
  const before=w.rig.mount.matrixWorld.elements.slice();
  for (const config of [{...DEFAULT_CAMERAS[0],enabled:false},{...DEFAULT_CAMERAS[1],attach:'base'}]) {
    const result=fitMealToCamera(w,config,pose);assert.equal(result.framed,false);assert.deepEqual(result.pose,pose);
    assert.deepEqual(w.rig.mount.matrixWorld.elements,before);assert.match(result.reason,/关闭|皮肤/);
  }
});

test('default scene is food; v2 imports retain an explicit scene and gain a bounded wearing distance', () => {
  const initial=defaultState();assert.equal(initial.environment,'meal');assert.equal(initial.pose.wearDistance,53);assert.equal(initial.pose.flip,0);assert.equal(initial.pose.spin,0);
  const old={...initial,schemaVersion:2,environment:'calibration',pose:{...initial.pose}};delete old.pose.wearDistance;
  const next=validateState(old);assert.equal(next.schemaVersion,4);assert.equal(next.environment,'calibration');assert.equal(next.pose.wearDistance,53);
  assert.throws(()=>validateState({...initial,pose:{...initial.pose,wearDistance:9}}));
  assert.throws(()=>validateState({...initial,pose:{...initial.pose,wearDistance:121}}));
});


test('quick framing locks all current activity settings, with only the body rear lifting to exactly 90 degrees', () => {
  const w=createWorld();w.selectEnvironment('meal');
  for(const side of ['left','right']) for(const attach of ['body','base']) for(const surface of ['front','rear','twelve','three','six','nine']) {
    for(const [flip,spin] of [[0,0],[45,37],[120,-92]]) {
      const config={...DEFAULT_CAMERAS[0],surface,attach};const pose={...presetPose('look',side,15),flip,spin};
      const before=JSON.stringify(pose),result=fitMealToCamera(w,config,pose,side);
      assert.equal(result.pose.flip,attach==='body'&&surface==='rear'?90:flip,`${side} ${attach} ${surface}`);
      assert.equal(result.pose.spin,spin);assert.equal(result.pose.wearDistance,15);assert.equal(JSON.stringify(pose),before);
      if(result.framed) assertFramed(w,result,config,side);
    }
  }
});
