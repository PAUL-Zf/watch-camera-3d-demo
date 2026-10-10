import * as THREE from 'three';

// The avatar is cosmetic geometry on the existing rig. Joint lengths, wrist
// mounts and camera coordinates remain owned by kinematics.js.
const mat = (color, roughness = .8) => new THREE.MeshStandardMaterial({ color, roughness });

// Smooth elliptical sections provide a jaw, tailored clothes and tapered limbs
// without external model files. Sections are ordered from bottom to top.
function loft(sections, segments = 32) {
  const vertices = [], indices = [];
  for (const [y, rx, rz, z = 0] of sections) {
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2;
      vertices.push(Math.sin(a) * rx, y, Math.cos(a) * rz + z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j, b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function hairPoint(a, t, lift = 0) {
  const front = Math.max(0, Math.cos(a));
  const edge = 1.646 + front * .054 + Math.sin(a) * front * .008;
  const radial = Math.sqrt(1 - t * t);
  return [Math.sin(a) * (.111 + lift) * radial - .009 * t,
    edge + (1.783 - edge) * t + front * Math.sin(t * Math.PI) * .008 + lift,
    -.009 + Math.cos(a) * (.105 + lift) * radial];
}

function hairCap() {
  const vertices = [], indices = [], segments = 48, rings = 14;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2;
      // A fitted low side fade rises into an asymmetric swept front hairline.
      vertices.push(...hairPoint(a, t));
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segments; j++) {
    const a = i * (segments + 1) + j, b = a + segments + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function createAvatar(rig) {
  const humanMeshes = [];
  const skin = mat('#d7a486', .76), ear = mat('#c78d76'), lips = mat('#ad7769');
  const shirt = mat('#193e50'), seam = mat('#315c6c'), pants = mat('#303f52');
  const sole = mat('#d9e0dc'), shoe = mat('#f1f1e7'), trim = mat('#567477');
  const hair = mat('#22252b', .78), hairHighlight = mat('#30343b', .85);
  const eyeWhite = mat('#e9e4d8', .6), iris = mat('#3f524b', .45), pupil = mat('#17252b', .4);
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  function mesh(parent, geometry, material, position = [0, 0, 0], scale) {
    const m = new THREE.Mesh(geometry, material); m.position.fromArray(position);
    if (scale) m.scale.fromArray(scale);
    m.userData.kind = 'human'; humanMeshes.push(m); parent.add(m); return m;
  }
  const ellipsoid = (parent, material, position, scale) => mesh(parent, sphere, material, position, scale);
  function curve(parent, points, radius, material) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(parent, new THREE.TubeGeometry(path, 16, radius, 6, false), material);
  }

  // Athletic shoulders, a quiet waist taper, and a fitted short-sleeve polo.
  mesh(rig.root, loft([
    [.886, 0, 0], [.892, .148, .092], [.94, .158, .099],
    [1.07, .162, .103], [1.20, .193, .111], [1.32, .215, .104],
    [1.365, .205, .091], [1.398, .13, .073], [1.412, .058, .051], [1.415, 0, 0],
  ]), shirt);
  mesh(rig.root, loft([[1.381, 0, 0], [1.39, .069, .050], [1.425, .054, .046], [1.455, .048, .043], [1.489, .049, .044], [1.493, 0, 0]]), skin);
  // Collar folds and a small placket, following the chest rather than floating.
  [-1, 1].forEach(s => {
    curve(rig.root, [[s * .053, 1.423, .026], [s * .077, 1.405, .058], [s * .044, 1.358, .099], [s * .012, 1.393, .071]], .008, seam);
  });
  curve(rig.root, [[0, 1.391, .074], [0, 1.365, .093], [0, 1.33, .105]], .004, seam);
  [1.355, 1.335].forEach(y => ellipsoid(rig.root, sole, [0, y, .11], [.0024, .0024, .0015]));
  mesh(rig.root, loft([[.79, 0, 0], [.80, .142, .085], [.88, .155, .094], [.91, .149, .095], [.912, 0, 0]]), pants);
  mesh(rig.root, loft([[.893, .15, .095], [.906, .15, .095]]), trim);

  // Contoured chin and cheekbones replace the original spherical head.
  mesh(rig.root, loft([
    [1.484, 0, 0, .029], [1.489, .028, .032, .032], [1.505, .057, .055, .021],
    [1.535, .080, .074, .006], [1.578, .093, .088, .002],
    [1.623, .102, .095, .001], [1.668, .099, .096, -.001],
    [1.709, .093, .086, -.006], [1.745, .063, .059, -.01], [1.762, 0, 0, -.012],
  ], 48), skin);
  mesh(rig.root, hairCap(), hair);
  // Fine swept ridges sit on the fitted hair shell, avoiding a separate hair ball.
  for (const angle of [-.85, -.4, .08, .52])
    curve(rig.root, [.06, .25, .5, .72, .9].map(t => hairPoint(angle + t * .2, t, .0006)), .0008, hairHighlight);
  [-1, 1].forEach(s => {
    ellipsoid(rig.root, skin, [s * .105, 1.623, -.003], [.013, .025, .016]);
    ellipsoid(rig.root, ear, [s * .113, 1.623, .006], [.005, .014, .008]);
    ellipsoid(rig.root, eyeWhite, [s * .039, 1.654, .090], [.018, .0068, .008]);
    ellipsoid(rig.root, iris, [s * .039, 1.654, .0975], [.0061, .0059, .0017]);
    ellipsoid(rig.root, pupil, [s * .039, 1.654, .099], [.0031, .0042, .0007]);
    ellipsoid(rig.root, sole, [s * .039 - .0016, 1.656, .1], [.0012, .0012, .0005]);
    curve(rig.root, [[s * .023, 1.662, .094], [s * .039, 1.665, .097], [s * .056, 1.660, .085]], .0019, skin);
    curve(rig.root, [[s * .022, 1.676, .094], [s * .038, 1.679, .094], [s * .059, 1.672, .079]], .0036, hair);
  });
  ellipsoid(rig.root, skin, [0, 1.634, .096], [.010, .026, .012]);
  ellipsoid(rig.root, skin, [0, 1.620, .111], [.013, .010, .017]);
  [-1, 1].forEach(s => ellipsoid(rig.root, skin, [s * .010, 1.616, .102], [.007, .006, .010]));
  curve(rig.root, [[-.023, 1.586, .095], [-.009, 1.588, .099], [0, 1.586, .101], [.009, 1.588, .099], [.023, 1.586, .095]], .0023, lips);
  ellipsoid(rig.root, lips, [0, 1.582, .096], [.018, .003, .003]);

  [-1, 1].forEach(s => {
    mesh(rig.root, loft([
      [.095, 0, 0], [.10, .041, .041], [.17, .043, .045], [.34, .050, .052],
      [.48, .058, .057], [.63, .069, .063], [.79, .076, .070], [.855, .061, .061], [.865, 0, 0],
    ]), pants, [s * .085, 0, 0]);
    // White low-top sneakers, contrasting outsole, heel and two clean lace rows.
    ellipsoid(rig.root, sole, [s * .085, .034, .037], [.055, .027, .112]);
    ellipsoid(rig.root, shoe, [s * .085, .057, .035], [.052, .035, .103]);
    ellipsoid(rig.root, trim, [s * .085, .069, -.047], [.035, .022, .019]);
    for (const z of [.042, .065]) curve(rig.root, [[s * .085 - .026, .081, z], [s * .085, .089, z], [s * .085 + .026, .081, z]], .0022, sole);
  });

  function upperArm(parent) {
    mesh(parent, loft([[-.30, 0, 0], [-.295, .040, .039], [-.21, .045, .043], [-.13, .051, .048], [-.04, .051, .05], [.015, 0, 0]]), skin);
    mesh(parent, loft([[-.15, .052, .049], [-.145, .057, .053], [-.06, .063, .059], [-.018, .057, .054], [.018, .032, .031], [.028, 0, 0]]), shirt);
    mesh(parent, loft([[-.15, .053, .05], [-.137, .0575, .0535]]), seam);
  }
  function forearm(parent, offset = 0) {
    mesh(parent, loft([[-.27, 0, 0], [-.265, .028, .027], [-.215, .032, .031], [-.12, .041, .039], [-.055, .043, .041], [-.003, .037, .035], [.003, 0, 0]]), skin, [0, offset, 0]);
  }
  function hand(parent) {
    ellipsoid(parent, skin, [0, -.043, 0], [.034, .053, .019]);
    [-1.5, -.5, .5, 1.5].forEach((n, i) => {
      const length = [ .033, .043, .040, .029 ][i];
      mesh(parent, new THREE.CapsuleGeometry(.0067, length, 3, 10), skin, [n * .014, -.092 - length / 2, .001]);
    });
    const thumb = mesh(parent, new THREE.CapsuleGeometry(.009, .031, 3, 10), skin, [-.035, -.062, .006]); thumb.rotation.z = -.35;
  }
  upperArm(rig.shoulder);
  ellipsoid(rig.elbow, skin, [0, 0, 0], [.039, .04, .037]);
  forearm(rig.forearm); hand(rig.wrist);
  const passiveArm = new THREE.Group(); rig.root.add(passiveArm);
  upperArm(passiveArm); forearm(passiveArm, -.30);
  ellipsoid(passiveArm, skin, [0, -.30, 0], [.039, .04, .037]);
  const passiveHand = new THREE.Group(); passiveHand.position.y = -.57; passiveArm.add(passiveHand); hand(passiveHand);

  // Sampling points lie on the updated facial surfaces, in the same world frame.
  const facePoints = [[0, 1.620, .128], [-.039, 1.654, .100], [.039, 1.654, .100], [0, 1.586, .103], [0, 1.692, .093]].map(p => new THREE.Vector3(...p));
  return { humanMeshes, passiveArm, facePoints };
}
