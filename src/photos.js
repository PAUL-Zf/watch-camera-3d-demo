import * as THREE from 'three';
import { photoResolution } from './camera-specs.js';

export function flipPixelRows(pixels, width, height) {
  const output = new Uint8ClampedArray(width * height * 4), stride = width * 4;
  for (let y = 0; y < height; y++) output.set(pixels.subarray((height-y-1)*stride, (height-y)*stride), y*stride);
  return output;
}
// Render at the selected output grid. Retain renderer/camera/background state,
// even if allocation, rendering, readback or canvas conversion fails.
export function renderSensorPhoto(renderer, scene, camera, config) {
  const { width, height } = photoResolution(config);
  if (renderer.capabilities?.maxTextureSize && Math.max(width,height) > renderer.capabilities.maxTextureSize) throw new Error('当前设备不支持此照片尺寸，请选择较低分辨率');
  const previous = renderer.getRenderTarget(), viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
  const scissorTest = renderer.getScissorTest(), background = scene.background.clone();
  let target;
  try {
    target = new THREE.WebGLRenderTarget(width,height); target.texture.colorSpace = THREE.SRGBColorSpace;
    const pixels = new Uint8Array(width*height*4);
    renderer.setScissorTest(false); renderer.setRenderTarget(target); renderer.setViewport(0,0,width,height);
    scene.background.set('#9bb2bf'); renderer.render(scene,camera); renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d'); if (!ctx) throw new Error('无法生成照片');
    const image=ctx.createImageData(width,height); image.data.set(flipPixelRows(pixels,width,height)); ctx.putImageData(image,0,0);
    return canvas;
  } finally {
    renderer.setRenderTarget(previous); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); scene.background.copy(background); target?.dispose();
  }
}
