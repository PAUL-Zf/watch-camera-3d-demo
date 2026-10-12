import * as THREE from 'three';

export function sensorMeshes(scene, camera) {
  const meshes = [];
  scene.traverseVisible(o => { if (o.isMesh && o.layers.test(camera.layers)) meshes.push(o); });
  return meshes;
}
// Uniform image-plane sampling of the nearest surface within 35 cm. The
// percentage is a geometric sample fraction, not a segmentation/AI accuracy.
export function sampleNearOcclusion(camera, meshes, columns = 9, rows = 7) {
  const ray = new THREE.Raycaster(), origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(); let hand = 0, housing = 0, human = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    direction.set(2 * (x + .5) / columns - 1, 2 * (y + .5) / rows - 1, .5).unproject(camera).sub(origin).normalize();
    ray.set(origin, direction); ray.near = camera.near; ray.far = .35;
    const first = ray.intersectObjects(meshes, false)[0];
    if (!first) continue;
    const region = first.object.userData.region;
    if (region === 'hand' || region === 'wrist') hand++;
    if (first.object.userData.kind === 'human') human++;
    else if (region === 'watch') housing++;
  }
  const total = columns * rows;
  return { hand: Math.round(hand / total * 100), housing: Math.round(housing / total * 100), human: Math.round(human / total * 100), samples: total };
}
