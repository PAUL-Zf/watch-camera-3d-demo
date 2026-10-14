import * as THREE from 'three';

// Fit actual wearer + dining-table bounds into the observer viewport, leaving
// room for the bottom readout. This never touches the four sensor cameras.
export function mealOverviewBounds(world) {
  world.scene.updateMatrixWorld(true);
  const box = new THREE.Box3(), part = new THREE.Box3();
  for (const mesh of world.humanMeshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    part.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld); box.union(part);
  }
  box.expandByObject(world.meal.group);
  return box;
}
export function fitMealOverview(camera, world, aspect) {
  const bounds = mealOverviewBounds(world), centre = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const direction = new THREE.Vector3(2.6, 1.15, 3.25).normalize();
  camera.aspect = Math.max(.1, aspect); camera.updateProjectionMatrix();
  camera.position.copy(centre).addScaledVector(direction, 4); camera.lookAt(centre); camera.updateMatrixWorld(true);
  const imageUp = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const target = centre.clone().addScaledVector(imageUp, -size.y * .15);
  const corners = [];
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) corners.push(new THREE.Vector3(x,y,z));
  let distance = 2.8;
  for (let i = 0; i < 80; i++) {
    camera.position.copy(target).addScaledVector(direction,distance); camera.lookAt(target); camera.updateMatrixWorld(true);
    const fits = corners.every(point => {
      const p = point.clone().project(camera);
      return p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= .84 && p.y >= -.48 && p.y <= .80;
    });
    if (fits) break;
    distance *= 1.06;
  }
  return { target, distance, bounds };
}

// Table-only, almost vertical view. Keep the observer's Y-up convention so
// OrbitControls continues to use its original rotation axes after switching.
export function fitTableOverview(camera,world,aspect) {
  world.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(world.meal.group),centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const target=centre.clone();target.z+=size.z*.20;
  camera.aspect=Math.max(.1,aspect);camera.updateProjectionMatrix();
  const corners=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z));
  let distance=1.2;
  for(let i=0;i<80;i++) {
    camera.position.copy(target).add(new THREE.Vector3(0,distance,distance*.00001));camera.lookAt(target);camera.updateMatrixWorld(true);
    if(corners.every(point=>{const p=point.clone().project(camera);return Math.abs(p.x)<=.84&&p.y>=-.48&&p.y<=.80&&p.z>=-1&&p.z<=1;}))break;
    distance*=1.06;
  }
  return {target,distance,bounds};
}
