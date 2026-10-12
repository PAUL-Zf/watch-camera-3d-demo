import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createRig, updatePose } from './kinematics.js';
import { createAvatar } from './avatar.js';
import { createMealScene } from './meal.js';

const material = (color, roughness = .8) => new THREE.MeshStandardMaterial({ color, roughness });
function addMesh(parent, geometry, mat, position = [0, 0, 0], scale) {
  const mesh = new THREE.Mesh(geometry, mat); mesh.position.fromArray(position);
  if (scale) mesh.scale.fromArray(scale);
  parent.add(mesh); return mesh;
}
function textTexture(lines, background = '#e6f1ec', color = '#173c45', size = 512) {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  lines.forEach((line, i) => { ctx.font = `${i ? 30 : 66}px sans-serif`; ctx.fillText(line, size / 2, size * (.38 + i * .18)); });
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function label(parent, text, position, size = .013, color = '#b7d7df') {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = 'bold 38px sans-serif'; ctx.fillText(text, 64, 46);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.position.fromArray(position); mesh.rotation.set(-Math.PI / 2, 0, Math.PI); mesh.layers.set(1); parent.add(mesh); return mesh;
}

export function createWorld() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#182f3d');
  scene.add(new THREE.HemisphereLight('#e2f7ff', '#777967', 2.5));
  const light = new THREE.DirectionalLight('#fff4df', 3.0); light.position.set(2, 4, 3); scene.add(light);
  const rim = new THREE.DirectionalLight('#9cc7e5', 1.8); rim.position.set(-2, 2, -2); scene.add(rim);
  const ground = addMesh(scene, new THREE.PlaneGeometry(12, 12), material('#52636a'), [0, -.003, 0]); ground.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(10, 40, '#849ca4', '#667c86'); grid.position.y = .001; scene.add(grid);
  const rig = createRig(); scene.add(rig.root);
  const { humanMeshes, passiveArm, passiveHand, facePoints, handMeshes, fingerTips, wristBridge } = createAvatar(rig);

  const strapMat = material('#c4b184'); const carrier = material('#b5cbd1', .45); const caseMat = material('#293c47', .32);
  // A closed elliptical band fits the distal forearm, independently of the hand.
  const vertices = [], indices = [], n = 64;
  for (let j = 0; j <= n; j++) {
    const a = j / n * Math.PI * 2;
    for (const [rx, rz, y] of [[.0328, .0282, -.227], [.036, .0314, -.227], [.036, .0314, -.207], [.0328, .0282, -.207]])
      vertices.push(Math.sin(a) * rx, y, Math.cos(a) * rz);
  }
  for (let j = 0; j < n; j++) for (let k = 0; k < 4; k++) {
    const a = j * 4 + k, b = j * 4 + (k + 1) % 4;
    indices.push(a, b, a + 4, b, b + 4, a + 4);
  }
  const bandGeometry = new THREE.BufferGeometry(); bandGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); bandGeometry.setIndex(indices); bandGeometry.computeVertexNormals();
  const strap = addMesh(rig.forearm, bandGeometry, strapMat); strap.name = 'fitted-forearm-strap'; strap.userData.region = 'watch';
  addMesh(rig.mount, new RoundedBoxGeometry(.052, .009, .065, 3, .002), carrier, [0, 0, 0]);
  addMesh(rig.swivel, new THREE.CylinderGeometry(.014, .014, .003, 24), material('#7c989e'), [0, .006, -.023]);
  const axle = addMesh(rig.hinge, new THREE.CylinderGeometry(.003, .003, .046, 16), material('#93aeb6')); axle.rotation.z = Math.PI / 2;
  addMesh(rig.body, new RoundedBoxGeometry(.047, .022, .058, 4, .004), caseMat);
  const crown = addMesh(rig.body, new THREE.CylinderGeometry(.003, .003, .004, 20), material('#8da8b2', .35), [-.025, .002, -.015]); crown.rotation.z = Math.PI / 2; crown.name = 'three-oclock-crown';
  for (const x of [-.023, .023]) for (const z of [-.021, .021]) addMesh(rig.mount, new RoundedBoxGeometry(.010, .008, .008, 2, .002), carrier, [x, -.002, z]);
  const screen = addMesh(rig.body, new THREE.PlaneGeometry(.040, .047), new THREE.MeshBasicMaterial({ map: textTexture(['08:00', 'WATCH VISION'], '#172b36', '#76e6d1') }), [0, .0113, -.002]); screen.rotation.set(-Math.PI / 2, 0, Math.PI); screen.name = 'dial-screen';
  const backPlate = addMesh(rig.body, new THREE.PlaneGeometry(.038, .046), material('#a2b7c0'), [0, -.0111, -.002]); backPlate.rotation.x = Math.PI / 2;
  // Clock labels are explanatory overlays and never enter sensor images.
  label(rig.body, '12', [0, .014, .032], .014);
  label(rig.body, '6', [0, .014, -.032], .010);
  label(rig.body, '3', [-.029, .014, 0], .010);
  label(rig.body, '9', [.029, .014, 0], .010);

  rig.mount.traverse(o => { if (o.isMesh && o.layers.mask === 1) o.userData.region = 'watch'; });
  const calibration = new THREE.Group(); calibration.name = 'calibration-scene'; scene.add(calibration);
  function sign(text, secondary, position, width = .9, height = .55, color = '#dcf1ea', yaw = 0) {
    const group = new THREE.Group(); group.position.fromArray(position); group.rotation.y = yaw; calibration.add(group);
    const mesh = addMesh(group, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: textTexture([text, secondary], color), roughness: 1, side: THREE.DoubleSide })); mesh.rotation.y = Math.PI;
    mesh.name = `sign-${text}`;
    addMesh(group, new THREE.CylinderGeometry(.015, .015, position[1] - height / 2, 12), material('#7d939b'), [0, -(position[1] + height / 2) / 2, 0]);
    return group;
  }
  sign('VISION', 'FRONT / 2.5 m', [0, 1.35, 2.5]);
  sign('SIDE', 'SIDE REFERENCE', [-1.6, 1.25, .7], .65, .45, '#e6dcfa', Math.PI / 2);
  const cube = addMesh(calibration, new THREE.BoxGeometry(.35, .35, .35), material('#40c5bd'), [-.58, 1.08, 1.75]); cube.rotation.y = .28;
  const ball = addMesh(calibration, new THREE.SphereGeometry(.18, 24, 18), material('#eda44c'), [.6, 1.15, 2.0]);
  [-.58, .6].forEach((x, i) => addMesh(calibration, new THREE.CylinderGeometry(.022, .022, .85, 12), material('#829298'), [x, .425, i ? 2 : 1.75]));
  const farWall = addMesh(scene, new THREE.PlaneGeometry(7, 3), material('#7a919e'), [0, 1.5, 4.5]); farWall.rotation.y = Math.PI;
  const targets = [{ name: '前方文字牌', point: new THREE.Vector3(0, 1.35, 2.499) }, { name: '青色方块', point: new THREE.Vector3(-.58, 1.08, 1.52) }, { name: '橙色球', point: new THREE.Vector3(.6, 1.15, 1.819) }];
  const meal = createMealScene(scene);
  const selectEnvironment = key => { calibration.visible = key !== 'meal'; meal.group.visible = key === 'meal'; };
  selectEnvironment('calibration');
  updatePose(rig, { raise: 20, elbow: 110, twist: -25, wrist: 0, flip: 0, spin: 0 });
  return { scene, rig, humanMeshes, passiveArm, passiveHand, facePoints, handMeshes, fingerTips, wristBridge, targets, meal, selectEnvironment, calibration };
}
