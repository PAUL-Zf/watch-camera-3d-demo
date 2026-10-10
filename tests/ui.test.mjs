import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

// These tests run real UI/scene code with a renderer double. They do not
// claim to test GPU pixels, WebGL shaders, or browser visual layout.
const threePath = fileURLToPath(new URL('../node_modules/three/build/three.module.js', import.meta.url));
const rendererDouble = `
import * as Real from ${JSON.stringify(threePath)};
export * from ${JSON.stringify(threePath)};
export class WebGLRenderer {
 constructor(){this.domElement=document.createElement('canvas');this.viewport=new Real.Vector4();this.scissor=new Real.Vector4();this.target=null;this.scissorTest=false;window.__renders=0;window.__viewports=[];}
 setPixelRatio(){} setSize(){} setClearColor(){} clear(){}
 setViewport(a,b,c,d){if(a?.isVector4)this.viewport.copy(a);else this.viewport.set(a,b,c,d);}
 setScissor(a,b,c,d){if(a?.isVector4)this.scissor.copy(a);else this.scissor.set(a,b,c,d);}
 getViewport(v){return v.copy(this.viewport);} getScissor(v){return v.copy(this.scissor);}
 setScissorTest(v){this.scissorTest=v;} getScissorTest(){return this.scissorTest;}
 render(scene,camera){window.__renders++;window.__viewports.push({width:this.viewport.z,height:this.viewport.w,aspect:camera.aspect});} setRenderTarget(t){this.target=t;} getRenderTarget(){return this.target;}
 readRenderTargetPixels(t,x,y,w,h,p){p.fill(128);}
}`;
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/app.js', import.meta.url))], bundle: true, write: false, format: 'iife', plugins: [{ name: 'renderer-double', setup(builder) {
  builder.onResolve({ filter: /^three$/ }, () => ({ path: 'renderer-double', namespace: 'test' }));
  builder.onResolve({ filter: /^\//, namespace: 'test' }, args => ({ path: args.path, namespace: 'file' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: rendererDouble, loader: 'js' }));
} }] });
const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
function setup(url = 'https://local-test.invalid/') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; let raf = [];
  w.requestAnimationFrame = fn => { raf.push(fn); return raf.length; };
  w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { w.__download = this.download; };
  w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, fillText() {}, putImageData() {}, createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }) });
  w.HTMLCanvasElement.prototype.toBlob = cb => cb(new w.Blob(['mock'], { type: 'image/png' }));
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    let width = this.id === 'mainViewport' ? 600 : 180, height = this.id === 'mainViewport' ? 550 : 135;
    if (this.classList.contains('feed-frame') && w.__frameSize) ({ width, height } = w.__frameSize);
    if (this.classList.contains('camera-view')) { width = parseFloat(this.style.width) || 0; height = parseFloat(this.style.height) || 0; }
    return { x: 280, y: 100, left: 280, top: 100, right: 280 + width, bottom: 100 + height, width, height };
  };
  const errors = []; w.addEventListener('error', e => errors.push(e.message));
  w.eval(bundle.outputFiles[0].text);
  return { w, doc: w.document, frame: time => { const fn = raf.shift(); fn(time); }, errors, close: () => dom.window.close() };
}
function click(env, selector) { env.doc.querySelector(selector).click(); }
function slide(env, selector, value) { const input = env.doc.querySelector(selector); input.value = value; input.dispatchEvent(new env.w.Event('input', { bubbles: true })); }
function change(env, selector, value) { const input = env.doc.querySelector(selector); input.value = value; input.dispatchEvent(new env.w.Event('change', { bubbles: true })); }
test('UI initializes four feeds and submits five view renders per frame', () => {
  const e = setup(); try {
    assert.equal(e.doc.querySelectorAll('.feed').length, 4); e.frame(1000);
    assert.equal(e.w.__renders, 5); assert.equal(e.doc.querySelector('#loading').style.display, 'none'); assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
test('feed images fit both wide and tall cells at 4:3 and all controls stay present', () => {
  const e = setup(); try {
    assert.equal(e.doc.querySelectorAll('.control-section').length, 3);
    assert.equal(e.doc.querySelectorAll('[data-group="pose"]').length, 7);
    assert.equal(e.doc.querySelectorAll('[data-group="camera"]').length, 4);
    let time = 0;
    for (const [size, expected] of [[{ width: 600, height: 240 }, { width: 320, height: 240 }], [{ width: 160, height: 400 }, { width: 160, height: 120 }], [{ width: 300.5, height: 161.5 }, { width: 215, height: 161.25 }]]) {
      e.w.__frameSize = size; e.w.__viewports.length = 0; e.frame(time += 1000);
      const sensorViews = e.w.__viewports.slice(1); assert.equal(sensorViews.length, 4);
      for (const viewport of sensorViews) {
        assert.equal(viewport.width, expected.width); assert.equal(viewport.height, expected.height);
        assert.equal(viewport.aspect, 4 / 3);
      }
    }
    assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
test('preset, lift, left/right wrist and camera-edit events change the live scene state', () => {
  const e = setup(); try {
    click(e, '[data-preset="upright"]'); assert.equal(e.w.watchVision.getState().pose.flip, 90);
    slide(e, '#pose-flip', 45); assert.equal(e.w.watchVision.getState().pose.flip, 45); assert.equal(e.doc.querySelector('#flipReadout').textContent, '45°');
    click(e, '[data-side="right"]'); assert.equal(e.w.watchVision.getState().side, 'right');
    click(e, '#cameraTabs [data-camera="2"]'); change(e, '#cameraAttach', 'base'); change(e, '#cameraSurface', 'nine'); slide(e, '#camera-fov', 120);
    const c = e.w.watchVision.getState().cameras[2]; assert.equal(c.attach, 'base'); assert.equal(c.surface, 'nine'); assert.equal(c.fov, 120);
    assert.match(e.doc.querySelector('#title-2').textContent, /底座/); assert.match(e.doc.querySelector('#fov-2').textContent, /120/);
    assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
test('disabling a slot removes its render pass and resets restore all four slots', () => {
  const e = setup(); try {
    const input = e.doc.querySelector('#cameraEnabled'); input.checked = false; input.dispatchEvent(new e.w.Event('change', { bubbles: true })); e.frame(1000);
    assert.equal(e.w.__renders, 4); assert.equal(e.doc.querySelector('#cameraCount').textContent, '3 路');
    click(e, '#cameraTabs [data-camera="1"]'); assert.equal(e.doc.querySelector('#cameraEnabled').checked, true);
    click(e, '#cameraTabs [data-camera="0"]'); assert.equal(e.doc.querySelector('#cameraEnabled').checked, false);
    click(e, '#reset'); assert.equal(e.w.watchVision.getState().cameras.filter(c => c.enabled).length, 4);
    assert.equal(e.doc.querySelector('#cameraEnabled').checked, true);
    assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
test('configuration and composite image exports execute without DOM errors', () => {
  const e = setup(); try {
    click(e, '#exportConfig'); assert.equal(e.w.__download, 'watch-camera-config.json');
    click(e, '#saveImages'); assert.equal(e.w.__download, 'watch-camera-comparison.png');
    assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
test('pause freezes a sampled walking pose rather than reverting to its starting pose', () => {
  const e = setup(); try {
    click(e, '[data-preset="down"]'); click(e, '#animate'); e.frame(1000);
    const before = e.w.watchVision.cameraPoses()[0].direction;
    click(e, '#animate'); const after = e.w.watchVision.cameraPoses()[0].direction;
    assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < .02);
    assert.equal(e.w.watchVision.getState().preset, 'custom'); assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
test('file URL works without localStorage; UI gives export fallback', () => {
  const e = setup('file:///watch-camera-demo.html'); try {
    click(e, '[data-preset="upright"]'); e.frame(1000);
    assert.match(e.doc.querySelector('#saveStatus').textContent, /导出配置/); assert.equal(e.w.__renders, 5); assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});

test('rear-camera rotation controls change image-up while keeping lens aim fixed', () => {
  const e = setup(); try {
    click(e, '[data-preset="upright"]'); click(e, '#cameraTabs [data-camera="1"]');
    const before = e.w.watchVision.cameraPoses()[1]; assert.ok(before.up[1] > .99);
    click(e, '[data-roll="180"]'); const after = e.w.watchVision.cameraPoses()[1];
    assert.ok(after.up[1] < -.99); assert.equal(e.w.watchVision.getState().cameras[1].roll, 180);
    assert.ok(Math.hypot(...before.direction.map((v, i) => v - after.direction[i])) < 1e-8);
    click(e, '[data-roll="0"]'); assert.ok(e.w.watchVision.cameraPoses()[1].up[1] > .99);
    assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});

test('horizontal inward slider moves camera position and persists on wrist-side changes', () => {
  const e = setup(); try {
    click(e, '[data-preset="look"]'); assert.equal(e.w.watchVision.getState().pose.inward, 35);
    slide(e, '#pose-inward', 0); const before = e.w.watchVision.cameraPoses()[0].position;
    slide(e, '#pose-inward', 35); const after = e.w.watchVision.cameraPoses()[0].position;
    assert.ok(Math.abs(after[0]) < Math.abs(before[0])); assert.equal(e.doc.querySelector('#pose-inward-value').textContent, '35°');
    click(e, '[data-side="right"]'); assert.equal(e.w.watchVision.getState().pose.inward, 35);
    assert.deepEqual(e.errors, []);
  } finally { e.close(); }
});
