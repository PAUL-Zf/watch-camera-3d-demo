import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SURFACES, PRESETS, DEFAULT_CAMERAS, updatePose, applyCameraConfig, cameraWorldPose } from './kinematics.js';
import { defaultState, validateState, POSE_LIMITS } from './config.js';
import { createWorld } from './scene.js';

const $ = selector => document.querySelector(selector);
const COLORS = ['#46d7cf', '#ffbe6f', '#92a7ff', '#f292bf'];
const STORAGE_KEY = 'watch-camera-vision-v1';
let state = defaultState(); let hasStorage = true;
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) state = validateState(JSON.parse(saved)); } catch { hasStorage = false; }
let renderer, world, observer, orbit;
let cameras = [], frustums = [], markers = [], feedRects = [], mainRect;
let animation = false, animationStart = 0, lastSwing = 0, lastFrame = 0, lastStatus = 0, frames = 0, lastFPS = 0;
let toastTimer; let view = 'full'; let raycastMeshes = [];

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('toast-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('toast-visible'), 3200); }
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); hasStorage = true; } catch { hasStorage = false; }
  $('#saveStatus').textContent = hasStorage ? '配置已保存在本机浏览器' : '浏览器不允许本地保存，请使用“导出配置”';
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function slider(key, label, min, max, value, group) {
  return `<div class="slider-field"><div class="slider-heading"><label for="${group}-${key}">${label}</label><output id="${group}-${key}-value" for="${group}-${key}">${value}°</output></div><input id="${group}-${key}" data-group="${group}" data-key="${key}" type="range" min="${min}" max="${max}" value="${value}" step="1"><div class="slider-bounds"><span>${min}°</span><span>${max}°</span></div></div>`;
}
function renderUI() {
  $('#poseList').innerHTML = Object.entries(PRESETS).map(([key, p]) => `<button data-preset="${key}" class="${state.preset === key ? 'active' : ''}">${p.label}</button>`).join('');
  $('#poseSliders').innerHTML = [['raise', '肩部抬臂'], ['elbow', '肘部弯曲'], ['twist', '前臂旋转'], ['wrist', '腕部弯曲']].map(([k, label]) => slider(k, label, ...POSE_LIMITS[k], state.pose[k], 'pose')).join('');
  $('#watchSliders').innerHTML = [['flip', '表体立起角度'], ['spin', '底座连接件旋转']].map(([k, label]) => slider(k, label, ...POSE_LIMITS[k], state.pose[k], 'pose')).join('');
  $('#cameraTabs').innerHTML = state.cameras.map((c, i) => `<button data-camera="${i}" style="--cam-color:${COLORS[i]}" class="${i === state.selected ? 'active' : ''}">${c.name}</button>`).join('');
  $('#feeds').innerHTML = state.cameras.map((c, i) => `<article class="feed ${i === state.selected ? 'selected' : ''} ${c.enabled ? '' : 'disabled'}" data-camera="${i}" style="--cam-color:${COLORS[i]}" tabindex="0" role="button" aria-label="配置摄像头 ${c.name}"><div class="feed-header"><span class="cam-letter">${c.name}</span><span class="feed-title" id="title-${i}">${SURFACES[c.surface].label}</span><span class="feed-selection">↗</span></div><div class="camera-view" id="viewport-${i}"><span class="feed-crosshair"></span><span class="feed-fov" id="fov-${i}">HFOV ${c.fov}°</span><div class="feed-disabled">镜头已关闭</div></div><div class="feed-bottom"><span id="details-${i}"></span><span class="visibility-status" id="status-${i}">正在分析视野…</span></div></article>`).join('');
  renderEditor(); syncUI(); measure();
}
function renderEditor() {
  const c = state.cameras[state.selected];
  $('#cameraEditor').innerHTML = `<label class="enable-row"><input id="cameraEnabled" type="checkbox" ${c.enabled ? 'checked' : ''}>启用摄像头 ${c.name}</label><label class="select-row">安装部件<select id="cameraAttach"><option value="body" ${c.attach === 'body' ? 'selected' : ''}>可翻转表体</option><option value="base" ${c.attach === 'base' ? 'selected' : ''}>腕上固定底座</option></select></label><label class="select-row">安装位置<select id="cameraSurface">${Object.entries(SURFACES).map(([key, surface]) => `<option value="${key}" ${key === c.surface ? 'selected' : ''}>${c.attach === 'base' && key === 'rear' ? '底座背面 · 朝皮肤' : surface.label}</option>`).join('')}</select></label>${slider('yaw', '水平偏转 · 相对安装面', -90, 90, c.yaw, 'camera')}${slider('pitch', '上下倾斜 · 相对安装面', -90, 90, c.pitch, 'camera')}${slider('roll', '画面旋转 · 传感器安装', -180, 180, c.roll, 'camera')}<div class="angle-shortcuts"><button data-roll="0">0°</button><button data-roll="90">90°</button><button data-roll="180">180°</button></div>${slider('fov', '水平视场角 HFOV', 40, 130, c.fov, 'camera')}<div class="angle-shortcuts"><button data-fov="60">窄 60°</button><button data-fov="90">中 90°</button><button data-fov="120">广 120°</button></div><button id="cameraDefault" class="camera-default">恢复此槽位的初始布局</button>`;
}
function syncUI() {
  document.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('active', b.dataset.side === state.side));
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('active', b.dataset.preset === state.preset));
  document.querySelectorAll('[data-flip]').forEach(b => b.classList.toggle('active', +b.dataset.flip === state.pose.flip));
  document.querySelectorAll('[data-group="pose"]').forEach(input => { input.value = state.pose[input.dataset.key]; $(`#${input.id}-value`).textContent = `${input.value}°`; });
  $('#poseReadout').textContent = PRESETS[state.preset]?.label || '自定义姿势';
  $('#flipReadout').textContent = `${state.pose.flip}°`;
  $('#cameraCount').textContent = `${state.cameras.filter(c => c.enabled).length} 路`;
  $('#showFrustums').checked = state.showFrustums; $('#showAllFrustums').checked = state.showAllFrustums; $('#showBody').checked = state.showBody;
  state.cameras.forEach((c, i) => {
    const label = c.attach === 'base' ? `底座 · ${SURFACES[c.surface].label.replace('表体背面 · 后摄', '背面').replace('屏幕面 · 前摄', '正面')}` : SURFACES[c.surface].label;
    $(`#title-${i}`).textContent = label;
    $(`#fov-${i}`).textContent = `HFOV ${c.fov}°`;
    $(`#details-${i}`).textContent = `${c.attach === 'body' ? '活动表体' : '固定底座'} · 偏转 ${c.yaw}° / 倾斜 ${c.pitch}° / 旋转 ${c.roll}°`;
    const feed = $(`#viewport-${i}`).closest('.feed'); feed.classList.toggle('disabled', !c.enabled); feed.classList.toggle('selected', i === state.selected); feed.setAttribute('aria-pressed', String(i === state.selected));
  });
  document.querySelectorAll('[data-camera]').forEach(b => b.classList.toggle('active', +b.dataset.camera === state.selected));
  document.querySelectorAll('.feed-key span').forEach((el, i) => { el.lastChild.textContent = ` ${state.cameras[i].name} ${SURFACES[state.cameras[i].surface].label}`; });
  const baseLabel = state.pose.flip === 0 ? '表体平放：表背镜头通常被底座挡住。选择“抬腕立起”，观察后摄如何转向环境。' : '表体已立起：前后摄朝向随翻转变化。镜头是否看向正前方，还取决于手臂姿势和转腕角度。';
  $('#hint').textContent = state.showBody ? baseLabel : '人体已隐藏，相关遮挡也已移除；此状态用于排查镜头方向，不代表真实佩戴视野。';
}
function selectCamera(i) {
  state.selected = i; renderEditor(); syncUI(); applyState(); saveState();
}
function applyState(swing = 0) {
  if (!world) return;
  updatePose(world.rig, state.pose, state.side, swing);
  world.passiveArm.position.set(state.side === 'left' ? -.225 : .225, 1.38, 0);
  world.passiveArm.rotation.x = animation ? swing * Math.PI / 180 : 0;
  world.humanMeshes.forEach(m => { m.visible = state.showBody; });
  state.cameras.forEach((c, i) => {
    applyCameraConfig(cameras[i], world.rig, c);
    markers[i].position.copy(cameras[i].position);
    if (markers[i].parent !== cameras[i].parent) cameras[i].parent.add(markers[i]);
    markers[i].visible = c.enabled;
    updateFrustum(i);
  });
  world.scene.updateMatrixWorld(true);
}
function updateFrustum(i) {
  const group = frustums[i], camera = cameras[i];
  const depth = .65, halfX = depth * Math.tan(state.cameras[i].fov * Math.PI / 360), halfY = halfX / camera.aspect;
  const corners = [[-halfX, -halfY, -depth], [halfX, -halfY, -depth], [halfX, halfY, -depth], [-halfX, halfY, -depth]];
  const vertices = []; for (let j = 0; j < 4; j++) vertices.push(0, 0, 0, ...corners[j], ...corners[j], ...corners[(j + 1) % 4]);
  group.children[0].geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); group.children[0].geometry.computeBoundingSphere();
  const faces = []; for (let j = 0; j < 4; j++) faces.push(0, 0, 0, ...corners[j], ...corners[(j + 1) % 4]);
  group.children[1].geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3)); group.children[1].geometry.computeBoundingSphere();
  group.visible = state.cameras[i].enabled && state.showFrustums && (state.showAllFrustums || i === state.selected);
}
function measure() {
  mainRect = $('#mainViewport').getBoundingClientRect();
  feedRects = state.cameras.map((_, i) => $(`#viewport-${i}`)?.getBoundingClientRect());
}
function resize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight); measure();
}
function frameCamera(which) {
  if (!orbit) return;
  view = which;
  if (which === 'wrist') {
    const target = world.rig.body.getWorldPosition(new THREE.Vector3()); orbit.target.copy(target); observer.position.copy(target).add(new THREE.Vector3(.16, .14, .22)); orbit.minDistance = .08;
  } else if (which === 'face') {
    orbit.target.set(0, 1.47, .05); observer.position.set(.7, 1.75, 1.4); orbit.minDistance = .3;
  } else {
    orbit.target.set(0, 1.1, .45); observer.position.set(2.6, 2.2, 3.7); orbit.minDistance = .3;
  }
  orbit.update();
}
const raycaster = new THREE.Raycaster();
function visiblePoint(camera, point, tolerance = .008) {
  const projected = point.clone().project(camera);
  if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return false;
  const origin = camera.getWorldPosition(new THREE.Vector3()), delta = point.clone().sub(origin), distance = delta.length();
  raycaster.set(origin, delta.normalize()); raycaster.near = camera.near; raycaster.far = Math.max(camera.near, distance - tolerance);
  return raycaster.intersectObjects(raycastMeshes, false).length === 0;
}
function updateStatuses() {
  raycastMeshes = [];
  world.scene.traverse(object => { if (object.isMesh && object.visible && object.layers.test(cameras[0].layers)) raycastMeshes.push(object); });
  state.cameras.forEach((c, i) => {
    if (!c.enabled) { $(`#status-${i}`).textContent = '镜头已关闭'; return; }
    const origin = cameras[i].getWorldPosition(new THREE.Vector3());
    const faceCount = state.showBody && origin.z > .1 ? world.facePoints.filter(p => visiblePoint(cameras[i], p)).length : 0;
    const faceText = state.showBody ? (faceCount >= 4 ? '脸部可见' : faceCount ? '部分脸部可见' : '未见人脸') : '人体遮挡已关闭';
    const target = world.targets.find(t => visiblePoint(cameras[i], t.point, .04));
    $(`#status-${i}`).textContent = target ? `${faceText} · ${target.name}` : faceText;
  });
}
function renderView(camera, rect, main = false) {
  if (!rect || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return;
  if (main) { camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }
  world.scene.background.set(main ? '#182f3d' : '#9bb2bf');
  renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height);
  renderer.setScissor(Math.max(0, rect.left), Math.max(0, innerHeight - rect.bottom), Math.min(rect.right, innerWidth) - Math.max(0, rect.left), Math.min(rect.bottom, innerHeight) - Math.max(0, rect.top));
  renderer.render(world.scene, camera);
}
function renderFrame(time) {
  requestAnimationFrame(renderFrame);
  if (document.hidden || time - lastFrame < 1000 / 30) return;
  lastFrame = time;
  if (animation) { lastSwing = THREE.MathUtils.clamp(state.pose.raise + Math.sin((time - animationStart) * .003) * 22, -30, 120) - state.pose.raise; applyState(lastSwing); }
  if (view === 'wrist') orbit.target.copy(world.rig.body.getWorldPosition(new THREE.Vector3()));
  orbit.update(); measure();
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.setClearColor('#000000', 0); renderer.clear(); renderer.setScissorTest(true);
  renderView(observer, mainRect, true);
  state.cameras.forEach((c, i) => { if (c.enabled) renderView(cameras[i], feedRects[i]); });
  if (time - lastStatus > 450) { updateStatuses(); lastStatus = time; }
  frames++; if (time - lastFPS >= 1000) { $('#fps').textContent = `${Math.round(frames * 1000 / (time - lastFPS))} FPS`; frames = 0; lastFPS = time; }
}
function toggleAnimation() {
  animation = !animation; animationStart = performance.now(); $('#animate').textContent = animation ? 'Ⅱ 暂停摆臂' : '▶ 摆臂演示'; $('#animate').classList.toggle('active', animation);
  if (!animation) { state.pose.raise = Math.round(THREE.MathUtils.clamp(state.pose.raise + lastSwing, -30, 120)); state.preset = 'custom'; lastSwing = 0; syncUI(); applyState(); saveState(); toast('已暂停在当前姿势，可继续观察四路画面'); }
  else { lastSwing = 0; toast('围绕当前姿势摆臂，摄像头与手腕同步运动'); }
}
function stopAnimation() { if (animation) toggleAnimation(); }
function capture() {
  if (!renderer) return;
  const width = 640, height = 480, header = 70;
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = (height + header) * 2 + 68;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#142b38'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const previous = renderer.getRenderTarget(), target = new THREE.WebGLRenderTarget(width, height), pixels = new Uint8Array(width * height * 4);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4()), scissorTest = renderer.getScissorTest(), background = world.scene.background.clone();
  try {
    renderer.setScissorTest(false);
    state.cameras.forEach((c, i) => {
      const x = (i % 2) * width, y = Math.floor(i / 2) * (height + header);
      ctx.fillStyle = COLORS[i]; ctx.font = 'bold 22px sans-serif'; ctx.fillText(`${c.name} / ${SURFACES[c.surface].label}`, x + 18, y + 29);
      ctx.fillStyle = '#b4cad3'; ctx.font = '14px sans-serif'; ctx.fillText(`${c.attach === 'body' ? '活动表体' : '固定底座'} · 偏转 ${c.yaw}° · 倾斜 ${c.pitch}° · 旋转 ${c.roll}°`, x + 18, y + 53);
      if (!c.enabled) { ctx.fillStyle = '#809ba8'; ctx.font = '24px sans-serif'; ctx.fillText('镜头已关闭', x + 240, y + header + 240); return; }
      renderer.setRenderTarget(target); renderer.setViewport(0, 0, width, height); world.scene.background.set('#9bb2bf'); renderer.render(world.scene, cameras[i]); renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const image = ctx.createImageData(width, height); for (let row = 0; row < height; row++) image.data.set(pixels.subarray((height - row - 1) * width * 4, (height - row) * width * 4), row * width * 4);
      ctx.putImageData(image, x, y + header);
    });
    ctx.fillStyle = '#bbcfd6'; ctx.font = '18px sans-serif'; ctx.fillText(`${state.side === 'left' ? '左腕' : '右腕'} | 表体立起 ${state.pose.flip}° | ${PRESETS[state.preset]?.label || '自定义姿势'} | 水平视场角 ${state.cameras.map(c => c.fov + '°').join(' / ')}`, 20, canvas.height - 38);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#8ca6b2'; ctx.fillText('WATCH / VISION · 概念视野模拟，非实机成像效果', 20, canvas.height - 14);
    canvas.toBlob(blob => { if (blob) { download(blob, 'watch-camera-comparison.png'); toast('四路对比图已生成'); } }, 'image/png');
  } finally {
    renderer.setRenderTarget(previous); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); world.scene.background.copy(background); target.dispose();
  }
}
function bindEvents() {
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); const card = event.target.closest('.feed');
    if (card) { selectCamera(+card.dataset.camera); return; }
    if (!button) return;
    if (button.dataset.camera !== undefined) { selectCamera(+button.dataset.camera); return; }
    if (button.dataset.side) { stopAnimation(); state.side = button.dataset.side; }
    else if (button.dataset.preset) { stopAnimation(); state.preset = button.dataset.preset; state.pose = { ...PRESETS[state.preset] }; }
    else if (button.dataset.flip !== undefined) { stopAnimation(); state.pose.flip = +button.dataset.flip; state.preset = 'custom'; }
    else if (button.dataset.roll !== undefined) { state.cameras[state.selected].roll = +button.dataset.roll; renderEditor(); }
    else if (button.dataset.fov) { state.cameras[state.selected].fov = +button.dataset.fov; renderEditor(); }
    else if (button.dataset.view) { frameCamera(button.dataset.view); return; }
    else if (button.id === 'cameraDefault') { state.cameras[state.selected] = { ...DEFAULT_CAMERAS[state.selected] }; renderEditor(); }
    else if (button.id === 'reset') { stopAnimation(); state = defaultState(); renderUI(); frameCamera('full'); toast('已恢复初始姿势与四路布局'); }
    else if (button.id === 'animate') { toggleAnimation(); return; }
    else if (button.id === 'exportConfig') { download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'watch-camera-config.json'); return; }
    else if (button.id === 'importConfig') { $('#configFile').click(); return; }
    else if (button.id === 'saveImages') { capture(); return; }
    else return;
    syncUI(); applyState(); saveState();
  });
  $('#feeds').addEventListener('keydown', event => { const card = event.target.closest('.feed'); if (card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectCamera(+card.dataset.camera); } });
  $('#mainViewport').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const offset = observer.position.clone().sub(orbit.target), spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += event.key === 'ArrowLeft' ? .10 : event.key === 'ArrowRight' ? -.10 : 0;
    spherical.phi += event.key === 'ArrowUp' ? -.10 : event.key === 'ArrowDown' ? .10 : 0; spherical.makeSafe(); observer.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical)); orbit.update();
  });
  document.addEventListener('input', event => {
    const input = event.target; if (!input.dataset.group) return;
    $(`#${input.id}-value`).textContent = `${input.value}°`;
    if (input.dataset.group === 'pose') { stopAnimation(); state.pose[input.dataset.key] = +input.value; state.preset = 'custom'; }
    else state.cameras[state.selected][input.dataset.key] = +input.value;
    syncUI(); applyState(); saveState();
  });
  document.addEventListener('change', event => {
    const input = event.target, c = state.cameras[state.selected];
    if (input.id === 'cameraSurface') { c.surface = input.value; c.yaw = 0; c.pitch = 0; c.roll = 0; renderEditor(); }
    else if (input.id === 'cameraAttach') { c.attach = input.value; renderEditor(); }
    else if (input.id === 'cameraEnabled') c.enabled = input.checked;
    else if (input.id === 'showFrustums') state.showFrustums = input.checked;
    else if (input.id === 'showAllFrustums') state.showAllFrustums = input.checked;
    else if (input.id === 'showBody') state.showBody = input.checked;
    else return;
    syncUI(); applyState(); saveState();
  });
  $('#configFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 100000) throw new Error('配置文件过大'); const imported = validateState(JSON.parse(await file.text())); stopAnimation(); state = imported; renderUI(); applyState(); saveState(); toast('配置已导入'); }
    catch (error) { toast(`无法导入：${error.message}`); }
    finally { event.target.value = ''; }
  });
  window.addEventListener('resize', resize); window.addEventListener('scroll', measure, { passive: true });
}
function initialize() {
  renderUI(); bindEvents();
  if (!hasStorage) $('#saveStatus').textContent = '本机保存不可用；可使用导出配置';
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.autoClear = true; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    $('#renderLayer').append(renderer.domElement);
    world = createWorld();
    observer = new THREE.PerspectiveCamera(43, 1, .01, 20); observer.layers.enable(1);
    orbit = new OrbitControls(observer, $('#mainViewport')); orbit.enableDamping = true; orbit.dampingFactor = .09; orbit.maxDistance = 8; orbit.maxPolarAngle = Math.PI * .96;
    cameras = state.cameras.map((_, i) => {
      const camera = new THREE.PerspectiveCamera(); world.rig.body.add(camera);
      const group = new THREE.Group(); group.name = `frustum-${i}`;
      const edges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS[i], transparent: true, opacity: .65 })); edges.layers.set(1); group.add(edges);
      const fill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: COLORS[i], transparent: true, opacity: .045, side: THREE.DoubleSide, depthWrite: false })); fill.layers.set(1); group.add(fill); camera.add(group); frustums.push(group);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.0035, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS[i] })); marker.layers.set(1); world.rig.body.add(marker); markers.push(marker);
      return camera;
    });
    applyState(); frameCamera('full'); resize(); $('#loading').style.display = 'none';
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); $('#loading').style.display = 'flex'; $('#loading').textContent = '3D 图形上下文已丢失，请重新打开页面。'; });
    requestAnimationFrame(renderFrame);
    // A read-only diagnostic API for development; geometry is the same as the visible simulator.
    window.watchVision = { getState: () => JSON.parse(JSON.stringify(state)), cameraPoses: () => cameras.map(camera => { const p = cameraWorldPose(camera); return { position: p.position.toArray(), direction: p.direction.toArray(), up: p.up.toArray() }; }), setPreset: key => { if (!Object.hasOwn(PRESETS, key)) return; state.preset = key; state.pose = { ...PRESETS[key] }; syncUI(); applyState(); saveState(); } };
  } catch (error) {
    $('#loading').textContent = '无法启动 3D 场景。请使用支持 WebGL 2 的新版 Chrome / Edge，并启用浏览器硬件加速。';
    console.error(error); toast('3D 初始化失败，详见浏览器控制台');
  }
}
initialize();
