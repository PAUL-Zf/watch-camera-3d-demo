import * as THREE from 'three';
import { createRig, updatePose, applyCameraConfig, PRESETS } from './kinematics.js';
import { sensorMeshes } from './occlusion.js';

const BOUNDS = { raise: [15, 110], inward: [-35, 60], elbow: [0, 125], twist: [-180, 180], flip: [0, 120], spin: [-180, 180] };
// Search actual pose transforms. Lens location, yaw/pitch/roll/FOV and wrist
// wearing distance remain unchanged; no virtual lookAt or image warp is used.
export function fitMealToCamera(world, config, original, side = 'left') {
  if (!config.enabled) return { pose: { ...original }, framed: false, visibleCorners: 0, reason: '当前主摄已关闭，请先启用' };
  if (config.attach === 'base' && config.surface === 'rear')
    return { pose: { ...original }, framed: false, visibleCorners: 0, reason: '底座背摄朝向皮肤，无法靠姿势解除结构遮挡' };
  const rig = createRig(), camera = new THREE.PerspectiveCamera();
  applyCameraConfig(camera, rig, config);
  const centre = world.meal.targets[0].point, points = [centre, ...world.meal.corners];
  const projected = new THREE.Vector3(), origin = new THREE.Vector3();
  const measure = pose => {
    updatePose(rig, pose, side); camera.getWorldPosition(origin);
    if (origin.y < centre.y + .085 || origin.z < .16) return 1e4 + Math.abs(origin.y - 1.1) * 100;
    let score = 0;
    points.forEach((point, i) => {
      projected.copy(point).project(camera);
      if (projected.z < -1 || projected.z > 1) { score += 500; return; }
      const edgeX = Math.max(0, Math.abs(projected.x) - .86), edgeY = Math.max(0, Math.abs(projected.y) - .86);
      score += (edgeX * edgeX + edgeY * edgeY) * 70;
      if (i === 0) score += (projected.x ** 2 + projected.y ** 2) * 5;
    });
    // Mild regularisation prefers a relaxed, flat watch where framing is equal.
    return score + (Math.abs(pose.twist) / 180 + pose.flip / 120 + Math.abs(pose.spin) / 180 + pose.elbow / 125) * .009;
  };
  let pool = [];
  const offer = pose => { const score = measure(pose); pool.push({ pose: { ...pose }, score }); if (pool.length > 100) pool = pool.sort((a,b) => a.score-b.score).slice(0,48); };
  offer(original);
  const base = { ...PRESETS.meal, ...original, wrist: 0, deviation: 0, wearDistance: original.wearDistance ?? 53 };
  const flips = config.attach === 'base' ? [original.flip] : config.surface === 'rear' ? [60,90,120] : [0,90];
  const spins = config.attach === 'base' ? [original.spin] : [-90,0,90];
  for (const raise of [30,60,90]) for (const inward of [-15,15,40]) for (const elbow of [0,45,90])
    for (const twist of [-180,-120,-60,0,60,120]) for (const flip of flips) for (const spin of spins)
      offer({ ...base, raise, inward, elbow, twist, flip, spin });
  pool.sort((a,b)=>a.score-b.score);
  const keys = config.attach === 'base' ? ['raise','inward','elbow','twist'] : Object.keys(BOUNDS);
  for (const seed of pool.slice(0,8)) {
    let current = seed;
    for (const step of [18,7,3,1]) for (let pass = 0; pass < 2; pass++) for (const key of keys) {
      for (const sign of [-1,1]) {
        const pose = { ...current.pose, [key]: THREE.MathUtils.clamp(current.pose[key] + sign * step, ...BOUNDS[key]) };
        const score = measure(pose); if (score < current.score) current = { pose, score };
      }
    }
    pool.push(current);
  }
  pool.sort((a,b)=>a.score-b.score);
  const live = new THREE.PerspectiveCamera(), ray = new THREE.Raycaster(), delta = new THREE.Vector3();
  const seen = new Set(); let fallback;
  try {
    for (const candidate of pool) {
      const signature = JSON.stringify(candidate.pose); if (seen.has(signature)) continue; seen.add(signature);
      if (seen.size > 28) break;
      for (const wrist of [...new Set([original.wrist,0,20,40])]) {
        const pose = { ...candidate.pose, wrist, deviation: 0 };
        updatePose(world.rig, pose, side); applyCameraConfig(live, world.rig, config); world.scene.updateMatrixWorld(true);
        const meshes = sensorMeshes(world.scene, live); live.getWorldPosition(origin);
        const visible = points.map(point => {
          projected.copy(point).project(live);
          if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > .96 || Math.abs(projected.y) > .96) return false;
          delta.copy(point).sub(origin); const distance = delta.length(); ray.set(origin, delta.normalize()); ray.near = live.near; ray.far = Math.max(live.near,distance-.008);
          return ray.intersectObjects(meshes,false).length === 0;
        });
        const handAboveTable = world.rig.hand.getWorldPosition(new THREE.Vector3()).y > .86;
        const visibleCorners = visible.slice(1).filter(Boolean).length;
        const result = { pose, framed: visible.every(Boolean) && handAboveTable, visibleCorners, reason: '餐盘未完整入镜或存在遮挡，请微调姿势 / 镜头参数' };
        if (result.framed) return { ...result, reason: '餐盘中心及四个范围参考点均可见' };
        if (handAboveTable && (!fallback || visibleCorners > fallback.visibleCorners)) fallback = result;
      }
    }
    return fallback ?? { pose: { ...original }, framed: false, visibleCorners: 0, reason: '当前安装配置未找到可用取景姿势' };
  } finally {
    updatePose(world.rig, original, side); live.removeFromParent(); camera.removeFromParent();
  }
}
