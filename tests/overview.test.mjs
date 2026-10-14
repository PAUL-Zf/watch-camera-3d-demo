import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/scene.js';
import { fitMealOverview } from '../src/overview.js';
import { updatePose, presetPose } from '../src/kinematics.js';
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };

test('meal overview includes actual whole wearer and table meshes across desktop aspect ratios, leaving readout clearance', () => {
  const world=createWorld(),camera=new THREE.PerspectiveCamera(43,1,.01,20);
  for (const side of ['left','right']) for (const preset of ['look','meal','upright']) for (const aspect of [.45,.7,1,1.6,2]) {
    updatePose(world.rig,presetPose(preset,side),side);
    const fitted=fitMealOverview(camera,world,aspect);
    assert.ok(fitted.distance>2.8);assert.equal(camera.fov,43);assert.equal(camera.aspect,aspect);
    const meshes=[...world.humanMeshes];world.meal.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
    for(const mesh of meshes) {
      const points=mesh.geometry.attributes.position;
      for(let i=0;i<points.count;i++) {
        const p=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(mesh.matrixWorld).project(camera);
        assert.ok(Math.abs(p.x)<=.841&&p.y>=-.481&&p.y<=.801&&p.z>=-1&&p.z<=1, `${side} ${preset} ${aspect}: mesh vertex cropped`);
      }
    }
  }
});
