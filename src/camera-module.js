import * as THREE from 'three';
import { DEFAULT_CAMERA_SPEC } from './camera-specs.js';

// Simplified square package envelope: the optical entrance stays fixed at z=0,
// with package thickness extending backwards along sensor +Z into the case.
export function createCameraModule(name) {
  const group = new THREE.Group(); group.name = `camera-module-${name}`;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#879ca7', roughness: .38 }));
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: '#102b3f', metalness: .45, roughness: .15 }));
  glass.rotation.y = Math.PI; glass.position.z = -.00005;
  // Default layer makes these real geometry, visible to other sensor cameras.
  for (const mesh of [shell, glass]) { mesh.userData.region = 'watch'; mesh.userData.cameraModule = name; group.add(mesh); }
  return group;
}
export function updateCameraModule(group, camera, config) {
  if (group.parent !== camera.parent) camera.parent.add(group);
  group.position.copy(camera.position); group.quaternion.copy(camera.quaternion);
  const width = (config.moduleWidth ?? DEFAULT_CAMERA_SPEC.moduleWidth) / 1000;
  const depth = (config.moduleDepth ?? DEFAULT_CAMERA_SPEC.moduleDepth) / 1000;
  group.children[0].scale.set(width, width, depth);
  group.children[0].position.z = depth / 2 + .0001;
  group.children[1].scale.setScalar(width * .30);
  group.visible = config.enabled;
  group.updateMatrixWorld(true);
}
