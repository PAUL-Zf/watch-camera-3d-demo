import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultState, validateState } from '../src/config.js';
import { PHOTO_RESOLUTIONS, photoResolution } from '../src/camera-specs.js';
import { createCameraModule, updateCameraModule } from '../src/camera-module.js';
import { createRig, applyCameraConfig, updatePose, presetPose } from '../src/kinematics.js';
import { flipPixelRows, renderSensorPhoto } from '../src/photos.js';

test('camera specifications roundtrip independently and v1-v3 configs migrate without changing existing cameras or poses', () => {
  const state=defaultState(); state.cameras[0].moduleWidth=12; state.cameras[0].moduleDepth=8; state.cameras[0].resolution='eight';
  const normalized=validateState(JSON.parse(JSON.stringify(state))); assert.deepEqual(normalized.cameras,state.cameras); const { label, ...pose }=state.pose;assert.deepEqual(normalized.pose,pose);
  for (const schemaVersion of [1,2,3]) {
    const legacy=defaultState(); legacy.schemaVersion=schemaVersion;
    legacy.cameras.forEach(c=>{delete c.moduleWidth;delete c.moduleDepth;delete c.resolution;});
    const migrated=validateState(legacy); assert.equal(migrated.schemaVersion,4); const { label, ...oldPose }=legacy.pose; assert.deepEqual(migrated.pose,oldPose);
    assert.ok(migrated.cameras.every(c=>c.moduleWidth===6&&c.moduleDepth===3&&c.resolution==='vga'));
  }
  for (const bad of [{moduleWidth:13},{moduleDepth:0},{resolution:'__proto__'},{moduleWidth:NaN},{resolution:null}]) {
    const invalid=defaultState(); Object.assign(invalid.cameras[2],bad); assert.throws(()=>validateState(invalid));
  }
});
test('all supported photo grids are 4:3 with exact pixel counts, independent of module size', () => {
  for (const [resolution,r] of Object.entries(PHOTO_RESOLUTIONS)) {
    assert.equal(r.width/r.height,4/3);
    assert.equal(photoResolution({resolution,moduleWidth:2}),photoResolution({resolution,moduleWidth:12}));
  }
  assert.equal(PHOTO_RESOLUTIONS.eight.width*PHOTO_RESOLUTIONS.eight.height,7990272);
});
test('physical module dimensions use millimetres, follow the optical entrance and keep sensor projection fixed', () => {
  const rig=createRig(), camera=new THREE.PerspectiveCamera(), module=createCameraModule('A'), config=defaultState().cameras[0];
  updatePose(rig,presetPose('look')); applyCameraConfig(camera,rig,config); updateCameraModule(module,camera,config);
  const projection=camera.projectionMatrix.clone(), position=camera.getWorldPosition(new THREE.Vector3());
  for (const attach of ['body','base']) for (const surface of ['front','rear','three','twelve']) {
    Object.assign(config,{attach,surface,moduleWidth:12,moduleDepth:8,resolution:'eight'});
    applyCameraConfig(camera,rig,config); updateCameraModule(module,camera,config);
    const box=new THREE.Box3().setFromObject(module.children[0]); assert.ok(!box.isEmpty());
    assert.equal(module.children[0].scale.x,.012); assert.equal(module.children[0].scale.z,.008);
    assert.equal(module.parent,camera.parent); assert.ok(module.position.equals(camera.position));
    assert.ok(module.quaternion.equals(camera.quaternion)); assert.ok(camera.projectionMatrix.equals(projection));
    const meshes=module.children;const ray=new THREE.Raycaster(camera.getWorldPosition(new THREE.Vector3()),camera.getWorldDirection(new THREE.Vector3()),camera.near,.1);
    assert.equal(ray.intersectObjects(meshes,false).length,0,'own package must not block its forward optical ray');
  }
  config.attach='body';config.surface='front';applyCameraConfig(camera,rig,config); assert.ok(camera.getWorldPosition(new THREE.Vector3()).distanceTo(position)<1e-10);
  config.enabled=false;updateCameraModule(module,camera,config);assert.equal(module.visible,false);
});
test('sensor readback flips rows without exchanging left/right pixels', () => {
  const input=Uint8Array.from({length:24},(_,i)=>i);
  assert.deepEqual([...flipPixelRows(input,3,2)],[...input.slice(12),...input.slice(0,12)]);
});
test('photo sampling uses the configured grid and restores render target, viewport, scissor and scene after success or failure', () => {
  const targetBefore={name:'previous'},viewportBefore=new THREE.Vector4(3,4,5,6),scissorBefore=new THREE.Vector4(7,8,9,10);
  let target=targetBefore,viewport=viewportBefore.clone(),scissor=scissorBefore.clone(),scissorTest=true,fail=false,disposed=false;
  const renderer={
    capabilities:{maxTextureSize:4096},getRenderTarget:()=>target,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>scissorTest,
    setRenderTarget:t=>{target=t;if(t?.isWebGLRenderTarget)t.addEventListener('dispose',()=>disposed=true);},
    setViewport:(a,b,c,d)=>{if(a?.isVector4)viewport.copy(a);else viewport.set(a,b,c,d);},setScissor:v=>scissor.copy(v),setScissorTest:v=>scissorTest=v,
    render:()=>{assert.equal(target.width,1600);assert.equal(target.height,1200);assert.equal(scissorTest,false);if(fail)throw new Error('GPU failure');},readRenderTargetPixels:(t,x,y,w,h,p)=>p.fill(128)
  };
  const priorDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};
  try {
    const scene=new THREE.Scene();scene.background=new THREE.Color('#123456');const camera=new THREE.PerspectiveCamera();
    const photo=renderSensorPhoto(renderer,scene,camera,{resolution:'uxga'});assert.equal(photo.width,1600);assert.equal(photo.height,1200);
    for (const failure of [false,true]) {
      fail=failure;disposed=false;
      if(fail)assert.throws(()=>renderSensorPhoto(renderer,scene,camera,{resolution:'uxga'}),/GPU failure/);else renderSensorPhoto(renderer,scene,camera,{resolution:'uxga'});
      assert.equal(target,targetBefore);assert.ok(viewport.equals(viewportBefore));assert.ok(scissor.equals(scissorBefore));assert.equal(scissorTest,true);assert.equal(scene.background.getHexString(),'123456');assert.ok(disposed);
    }
    renderer.capabilities.maxTextureSize=1024;assert.throws(()=>renderSensorPhoto(renderer,scene,camera,{resolution:'eight'}),/不支持/);assert.equal(target,targetBefore);
  } finally {globalThis.document=priorDocument;}
});
