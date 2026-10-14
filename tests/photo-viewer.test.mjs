import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { photoDisplaySize, layoutPhoto, bindPhotoPan } from '../src/photo-viewer.js';

test('100% keeps exact CSS pixel extents and fit shrinks to the viewport without upscaling small photos',()=>{
  const dom=new JSDOM('<div id="host"><div id="stage"><canvas width="3264" height="2448"></canvas></div></div>');
  try {
    const host=dom.window.document.querySelector('#host'),stage=host.firstChild,canvas=stage.firstChild;
    Object.defineProperties(host,{clientWidth:{value:900},clientHeight:{value:500}});
    layoutPhoto(host,stage,canvas,true);assert.equal(canvas.style.width,'3264px');assert.equal(canvas.style.height,'2448px');assert.equal(stage.style.width,'3264px');assert.equal(stage.style.height,'2448px');
    layoutPhoto(host,stage,canvas,false);assert.equal(canvas.style.height,'500px');assert.ok(parseFloat(canvas.style.width)<900);assert.equal(stage.style.width,'100%');
    assert.deepEqual(photoDisplaySize(640,480,900,500,false),{width:640,height:480});
  }finally{dom.window.close();}
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
