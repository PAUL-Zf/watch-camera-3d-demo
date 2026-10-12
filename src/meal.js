import * as THREE from 'three';
const mat = (color, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness });
export function createMealScene(scene) {
  const group = new THREE.Group(); group.name = 'meal-scene'; scene.add(group);
  const add = (geometry, material, position, scale) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.fromArray(position);
    if (scale) mesh.scale.fromArray(scale); group.add(mesh); return mesh;
  };
  const wood = mat('#ae8259'), white = mat('#f7eee0', .5);
  add(new THREE.BoxGeometry(.95, .04, .78), wood, [0, .80, .80]);
  for (const x of [-.4, .4]) for (const z of [.49, 1.11]) add(new THREE.CylinderGeometry(.024, .024, .78, 12), wood, [x, .39, z]);
  const cx = .02, cz = .78;
  add(new THREE.CylinderGeometry(.145, .13, .012, 64), white, [cx, .829, cz]);
  const rim = add(new THREE.TorusGeometry(.135, .006, 10, 64), white, [cx, .838, cz]); rim.rotation.x = Math.PI / 2;
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  add(sphere, mat('#f1e4c8'), [cx - .055, .854, cz + .02], [.056, .023, .060]);
  const protein = add(sphere, mat('#b9633e'), [cx + .048, .854, cz + .031], [.050, .021, .035]); protein.rotation.y = -.35;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399; add(sphere, mat(i % 2 ? '#559347' : '#397b39'), [cx + Math.sin(a) * .044, .85 + (i % 3) * .004, cz - .072 + Math.cos(a) * .022], [.018, .012, .018]);
  }
  for (let i = 0; i < 3; i++) add(sphere, mat('#c65736'), [cx + .080 - i * .021, .854, cz - .060], [.012, .012, .012]);
  add(new THREE.BoxGeometry(.17, .002, .24), mat('#dedacf'), [-.30, .824, .79]);
  const metal = mat('#adb8be', .3);
  add(new THREE.BoxGeometry(.008, .004, .14), metal, [-.30, .829, .80]);
  add(sphere, metal, [-.30, .831, .88], [.018, .004, .027]);
  add(new THREE.CylinderGeometry(.033, .028, .095, 32), mat('#cfddd7', .3), [.30, .87, .94]);
  const corners = [[-.13, -.13], [.13, -.13], [.13, .13], [-.13, .13]].map(([x, z]) => new THREE.Vector3(cx + x, .886, cz + z));
  const targets = [{ name: '餐盘食物', point: new THREE.Vector3(cx, .89, cz) }];
  return { group, targets, corners, focus: new THREE.Vector3(cx, .84, cz) };
}
