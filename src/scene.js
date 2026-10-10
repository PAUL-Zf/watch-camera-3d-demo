import * as THREE from 'three';
import { createRig, updatePose } from './kinematics.js';

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
  mesh.position.fromArray(position); mesh.rotation.x = -Math.PI / 2; mesh.layers.set(1); parent.add(mesh); return mesh;
}

export function createWorld() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#182f3d');
  scene.add(new THREE.HemisphereLight('#e2f7ff', '#777967', 2.5));
  const light = new THREE.DirectionalLight('#fff4df', 3.0); light.position.set(2, 4, 3); scene.add(light);
  const rim = new THREE.DirectionalLight('#9cc7e5', 1.8); rim.position.set(-2, 2, -2); scene.add(rim);
  const ground = addMesh(scene, new THREE.PlaneGeometry(12, 12), material('#52636a'), [0, -.003, 0]); ground.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(10, 40, '#849ca4', '#667c86'); grid.position.y = .001; scene.add(grid);
  const rig = createRig(); scene.add(rig.root);
  const skin = material('#dfb99e'); const shirt = material('#397c85'); const trousers = material('#283d50'); const shoes = material('#cad6d9'); const hair = material('#343236');
  const humanMeshes = [];
  function human(parent, geo, mat, position, scale) { const m = addMesh(parent, geo, mat, position, scale); humanMeshes.push(m); m.userData.kind = 'human'; return m; }
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  human(rig.root, sphere, shirt, [0, 1.15, 0], [.235, .265, .12]);
  human(rig.root, sphere, trousers, [0, .88, 0], [.17, .16, .11]);
  human(rig.root, new THREE.CylinderGeometry(.055, .057, .10, 20), skin, [0, 1.44, 0]);
  human(rig.root, sphere, skin, [0, 1.62, .005], [.108, .136, .098]);
  human(rig.root, sphere, hair, [0, 1.70, -.027], [.106, .064, .086]);
  human(rig.root, sphere, skin, [0, 1.625, .107], [.013, .023, .018]);
  [-1, 1].forEach(sign => {
    human(rig.root, sphere, skin, [sign * .108, 1.62, .003], [.014, .026, .017]);
    human(rig.root, sphere, material('#fff8ed'), [sign * .039, 1.658, .088], [.019, .010, .010]);
    human(rig.root, sphere, material('#30393a'), [sign * .039, 1.658, .097], [.007, .007, .002]);
    human(rig.root, new THREE.CapsuleGeometry(.067, .63, 5, 16), trousers, [sign * .09, .46, 0]);
    human(rig.root, sphere, shoes, [sign * .09, .06, .044], [.071, .045, .13]);
  });
  human(rig.root, sphere, material('#ad7870'), [0, 1.586, .099], [.028, .004, .003]);
  human(rig.shoulder, new THREE.CapsuleGeometry(.048, .205, 4, 16), skin, [0, -.15, 0]);
  human(rig.shoulder, new THREE.CapsuleGeometry(.061, .10, 4, 16), shirt, [0, -.055, 0]);
  human(rig.elbow, sphere, skin, [0, 0, 0], [.044, .044, .044]);
  human(rig.forearm, new THREE.CapsuleGeometry(.038, .19, 4, 16), skin, [0, -.135, 0]);
  human(rig.wrist, sphere, skin, [0, -.044, 0], [.038, .067, .020]);
  [-1.5, -.5, .5, 1.5].forEach((n, i) => human(rig.wrist, new THREE.CapsuleGeometry(.007, .045 + (i === 1 || i === 2 ? .01 : 0), 3, 8), skin, [n * .015, -.117, .001]));
  human(rig.wrist, new THREE.CapsuleGeometry(.011, .035, 3, 10), skin, [-.042, -.065, .009]);
  const passiveArm = new THREE.Group(); rig.root.add(passiveArm);
  human(passiveArm, new THREE.CapsuleGeometry(.048, .205, 4, 16), skin, [0, -.15, 0]);
  human(passiveArm, new THREE.CapsuleGeometry(.061, .10, 4, 16), shirt, [0, -.055, 0]);
  human(passiveArm, new THREE.CapsuleGeometry(.038, .19, 4, 16), skin, [0, -.435, 0]);
  human(passiveArm, sphere, skin, [0, -.60, 0], [.040, .08, .021]);

  const strapMat = material('#c4b184'); const carrier = material('#b5cbd1', .45); const caseMat = material('#293c47', .32);
  const strap = addMesh(rig.mount, new THREE.TorusGeometry(.035, .006, 8, 32), strapMat, [0, -.031, 0]); strap.scale.set(1, .78, 1); // torus hole follows the forearm / 12–6 axis
  addMesh(rig.mount, new THREE.BoxGeometry(.052, .009, .065), carrier, [0, 0, 0]);
  addMesh(rig.swivel, new THREE.CylinderGeometry(.014, .014, .003, 24), material('#7c989e'), [0, .006, -.023]);
  const axle = addMesh(rig.hinge, new THREE.CylinderGeometry(.003, .003, .046, 16), material('#93aeb6')); axle.rotation.z = Math.PI / 2;
  addMesh(rig.body, new THREE.BoxGeometry(.047, .022, .058), caseMat);
  const screen = addMesh(rig.body, new THREE.PlaneGeometry(.040, .047), new THREE.MeshBasicMaterial({ map: textTexture(['08:00', 'WATCH VISION'], '#172b36', '#76e6d1') }), [0, .0113, -.002]); screen.rotation.x = -Math.PI / 2;
  const backPlate = addMesh(rig.body, new THREE.PlaneGeometry(.038, .046), material('#a2b7c0'), [0, -.0111, -.002]); backPlate.rotation.x = Math.PI / 2;
  // Clock labels are explanatory overlays and never enter sensor images.
  label(rig.body, '12', [0, .014, .032], .014);
  label(rig.body, '6', [0, .014, -.032], .010);
  label(rig.body, '3', [.029, .014, 0], .010);
  label(rig.body, '9', [-.029, .014, 0], .010);

  function sign(text, secondary, position, width = .9, height = .55, color = '#dcf1ea', yaw = 0) {
    const group = new THREE.Group(); group.position.fromArray(position); group.rotation.y = yaw; scene.add(group);
    const mesh = addMesh(group, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: textTexture([text, secondary], color), roughness: 1, side: THREE.DoubleSide })); mesh.rotation.y = Math.PI;
    mesh.name = `sign-${text}`;
    addMesh(group, new THREE.CylinderGeometry(.015, .015, position[1] - height / 2, 12), material('#7d939b'), [0, -(position[1] + height / 2) / 2, 0]);
    return group;
  }
  sign('VISION', 'FRONT / 2.5 m', [0, 1.35, 2.5]);
  sign('SIDE', 'SIDE REFERENCE', [-1.6, 1.25, .7], .65, .45, '#e6dcfa', Math.PI / 2);
  const cube = addMesh(scene, new THREE.BoxGeometry(.35, .35, .35), material('#40c5bd'), [-.58, 1.08, 1.75]); cube.rotation.y = .28;
  const ball = addMesh(scene, new THREE.SphereGeometry(.18, 24, 18), material('#eda44c'), [.6, 1.15, 2.0]);
  [-.58, .6].forEach((x, i) => addMesh(scene, new THREE.CylinderGeometry(.022, .022, .85, 12), material('#829298'), [x, .425, i ? 2 : 1.75]));
  const farWall = addMesh(scene, new THREE.PlaneGeometry(7, 3), material('#7a919e'), [0, 1.5, 4.5]); farWall.rotation.y = Math.PI;
  const facePoints = [new THREE.Vector3(0, 1.625, .126), new THREE.Vector3(-.039, 1.658, .100), new THREE.Vector3(.039, 1.658, .100), new THREE.Vector3(0, 1.586, .103), new THREE.Vector3(0, 1.711, .079)];
  const targets = [{ name: '前方文字牌', point: new THREE.Vector3(0, 1.35, 2.499) }, { name: '青色方块', point: new THREE.Vector3(-.58, 1.08, 1.52) }, { name: '橙色球', point: new THREE.Vector3(.6, 1.15, 1.819) }];
  updatePose(rig, { raise: 20, elbow: 110, twist: -25, wrist: 0, flip: 0, spin: 0 });
  return { scene, rig, humanMeshes, passiveArm, facePoints, targets };
}
