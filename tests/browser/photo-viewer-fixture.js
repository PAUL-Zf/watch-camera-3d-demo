// Browser layout fixture: the production viewer and CSS, without requiring GPU.
import { createPhotoViewer, MIN_PHOTO_ZOOM, MAX_PHOTO_ZOOM } from '../../src/photo-viewer.js';
const $=s=>document.querySelector(s),host=$('#photoCanvasHost'),stage=$('#photoCanvasStage');
const canvas=document.createElement('canvas');canvas.width=3264;canvas.height=2448;stage.append(canvas);
const ctx=canvas.getContext('2d');
for(let y=0;y<canvas.height;y+=256)for(let x=0;x<canvas.width;x+=256){ctx.fillStyle=((x+y)/256)%2?'#386d86':'#88aab0';ctx.fillRect(x,y,256,256);ctx.fillStyle='#fff';ctx.font='28px sans-serif';ctx.fillText(`${x}, ${y}`,x+20,y+50);}
$('#photoTitle').textContent='照片缩放验证 · V0.3.3 测试图';$('#photoMeta').innerHTML='<label>测试照片 <select id="qaGrid" aria-label="测试照片尺寸"><option value="eight">800万 · 3264×2448</option><option value="vga">30万 · 640×480</option></select></label> · 使用生产查看器；非3D拍摄照片';
const viewer=createPhotoViewer(host,stage,()=>canvas,({zoom,mode})=>{
 $('#photoZoomValue').textContent=`${Math.round(zoom*1000)/10}%`;
 $('#photoFit').setAttribute('aria-pressed',String(mode==='fit'));$('#photoActual').setAttribute('aria-pressed',String(Math.abs(zoom-1)<1e-8));
 $('#photoZoomOut').disabled=zoom<=MIN_PHOTO_ZOOM;$('#photoZoomIn').disabled=zoom>=MAX_PHOTO_ZOOM;
});
$('#photoFit').onclick=()=>viewer.fit();$('#photoActual').onclick=()=>{viewer.setZoom(1);host.focus();};
$('#photoZoomIn').onclick=()=>viewer.zoomBy(1.25);$('#photoZoomOut').onclick=()=>viewer.zoomBy(1/1.25);
$('#closePhoto').onclick=()=>$('#photoDialog').close();$('#savePhoto').hidden=true;
$('#qaGrid').onchange=()=>{const small=$('#qaGrid').value==='vga';canvas.width=small?640:3264;canvas.height=small?480:2448;for(let y=0;y<canvas.height;y+=256)for(let x=0;x<canvas.width;x+=256){ctx.fillStyle=((x+y)/256)%2?'#386d86':'#88aab0';ctx.fillRect(x,y,256,256);ctx.fillStyle='#fff';ctx.font='28px sans-serif';ctx.fillText(`${x}, ${y}`,x+20,y+50);}viewer.fit();};
$('#photoDialog').showModal();viewer.fit();window.addEventListener('resize',()=>viewer.resize());
