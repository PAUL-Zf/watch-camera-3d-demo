import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createPhotoViewer, photoAnchorPoint, MIN_PHOTO_ZOOM, MAX_PHOTO_ZOOM, bindPhotoPan } from '../src/photo-viewer.js';

function viewerFixture(width=3264,height=2448) {
  const dom=new JSDOM('<div id="host" tabindex="0"><div id="stage"><canvas></canvas></div></div>');
  const host=dom.window.document.querySelector('#host'),stage=host.firstChild,canvas=stage.firstChild;
  canvas.width=width;canvas.height=height;
  Object.defineProperties(host,{clientWidth:{value:900,writable:true},clientHeight:{value:500,writable:true}});
  Object.defineProperties(stage,{offsetWidth:{get:()=>stage.style.width==='100%'?host.clientWidth:parseFloat(stage.style.width)||0},offsetHeight:{get:()=>stage.style.height==='100%'?host.clientHeight:parseFloat(stage.style.height)||0}});
  host.setPointerCapture=()=>{};host.releasePointerCapture=()=>{};
  const viewer=createPhotoViewer(host,stage,()=>canvas);
  return {dom,host,stage,canvas,viewer};
}
test('fit, native and manual scales use exact display pixels without changing the photo pixel grid',()=>{
  const e=viewerFixture();try {
    e.viewer.fit();assert.equal(e.canvas.style.height,'500px');assert.ok(parseFloat(e.canvas.style.width)<900);assert.equal(e.viewer.getState().mode,'fit');
    e.viewer.setZoom(1);assert.equal(e.canvas.style.width,'3264px');assert.equal(e.canvas.style.height,'2448px');assert.equal(e.stage.style.width,'3264px');
    e.viewer.zoomBy(1.25);assert.equal(e.canvas.style.width,'4080px');assert.equal(e.canvas.width,3264);assert.equal(e.canvas.height,2448);
    e.host.clientWidth=800;e.viewer.resize();assert.equal(e.viewer.getState().zoom,1.25);
    e.viewer.fit();e.host.clientHeight=400;e.viewer.resize();assert.equal(parseFloat(e.canvas.style.height),400);
  }finally{e.dom.window.close();}
});
test('a small VGA photo can zoom beyond native, limits clamp safely and fit restores its original displayed size',()=>{
  const e=viewerFixture(640,480);try {
    e.viewer.fit();assert.equal(e.viewer.getState().zoom,1);assert.equal(e.canvas.style.width,'640px');
    e.viewer.zoomBy(2);assert.equal(e.canvas.style.width,'1280px');assert.equal(e.viewer.getState().mode,'manual');
    e.viewer.setZoom(100);assert.equal(e.viewer.getState().zoom,MAX_PHOTO_ZOOM);e.viewer.setZoom(0);assert.equal(e.viewer.getState().zoom,MIN_PHOTO_ZOOM);
    e.viewer.fit();assert.equal(e.viewer.getState().zoom,1);assert.equal(e.canvas.width,640);
  }finally{e.dom.window.close();}
});
test('zooming preserves the same source pixel under an interior mouse anchor and around centre buttons',()=>{
  const e=viewerFixture();try {
    e.viewer.fit();e.viewer.setZoom(1);e.host.scrollLeft=500;e.host.scrollTop=600;
    const point=photoAnchorPoint(1,500,600,900,500,3264,2448,250,180);
    e.viewer.setZoom(2,{x:250,y:180});
    assert.equal((e.host.scrollLeft+250)/2,point.x);assert.equal((e.host.scrollTop+180)/2,point.y);
    const before=photoAnchorPoint(2,e.host.scrollLeft,e.host.scrollTop,900,500,3264,2448,450,250);
    e.viewer.zoomBy(1/1.25);const z=e.viewer.getState().zoom;
    assert.ok(Math.abs((e.host.scrollLeft+450)/z-before.x)<1e-8);assert.ok(Math.abs((e.host.scrollTop+250)/z-before.y)<1e-8);
  }finally{e.dom.window.close();}
});
test('wheel zoom consumes native scrolling, Shift-wheel keeps panning and keyboard shortcuts update scale',()=>{
  const e=viewerFixture();try {
    e.viewer.fit();e.viewer.setZoom(1);
    const wheel=new e.dom.window.WheelEvent('wheel',{deltaY:-120,clientX:300,clientY:200,bubbles:true,cancelable:true});e.host.dispatchEvent(wheel);
    assert.ok(e.viewer.getState().zoom>1);assert.ok(wheel.defaultPrevented);
    const before=e.viewer.getState().zoom,shift=new e.dom.window.WheelEvent('wheel',{deltaY:120,shiftKey:true,bubbles:true,cancelable:true});e.host.dispatchEvent(shift);assert.equal(e.viewer.getState().zoom,before);assert.equal(shift.defaultPrevented,false);
    e.host.dispatchEvent(new e.dom.window.KeyboardEvent('keydown',{key:'+',bubbles:true,cancelable:true}));assert.ok(e.viewer.getState().zoom>before);
  }finally{e.dom.window.close();}
});
test('dragging a native-size photo changes both scroll offsets, stops on pointerup and does not pan fit mode',()=>{
  const dom=new JSDOM('<div id="host" tabindex="0"></div>');
  try {
    const w=dom.window,host=w.document.querySelector('#host');let captured;
    host.setPointerCapture=id=>captured=id;host.hasPointerCapture=id=>captured===id;host.releasePointerCapture=()=>captured=undefined;
    bindPhotoPan(host);
    const send=(type,x,y)=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:4});host.dispatchEvent(event);};
    host.classList.add('actual-size');host.scrollLeft=100;host.scrollTop=200;
    send('pointerdown',300,300);send('pointermove',250,240);assert.equal(host.scrollLeft,150);assert.equal(host.scrollTop,260);assert.equal(w.document.activeElement,host);
    send('pointerup',250,240);send('pointermove',0,0);assert.equal(host.scrollLeft,150);assert.equal(captured,undefined);
    host.classList.remove('actual-size');send('pointerdown',300,300);send('pointermove',0,0);assert.equal(host.scrollTop,260);assert.equal(captured,undefined);
  }finally{dom.window.close();}
});
