// Browser layout fixture: the production viewer and CSS, without requiring GPU.
import { layoutPhoto, bindPhotoPan } from '../../src/photo-viewer.js';
const $=s=>document.querySelector(s),host=$('#photoCanvasHost'),stage=$('#photoCanvasStage');
const canvas=document.createElement('canvas');canvas.width=3264;canvas.height=2448;stage.append(canvas);
const ctx=canvas.getContext('2d');
for(let y=0;y<canvas.height;y+=256)for(let x=0;x<canvas.width;x+=256){ctx.fillStyle=((x+y)/256)%2?'#386d86':'#88aab0';ctx.fillRect(x,y,256,256);ctx.fillStyle='#fff';ctx.font='28px sans-serif';ctx.fillText(`${x}, ${y}`,x+20,y+50);}
$('#photoTitle').textContent='原尺寸滚动验证 · 测试图';$('#photoMeta').textContent='3264×2448 · 使用生产照片查看器与样式；非3D拍摄照片';
let actual=false;
const scale=value=>{actual=value;layoutPhoto(host,stage,canvas,value);$('#photoFit').setAttribute('aria-pressed',String(!value));$('#photoActual').setAttribute('aria-pressed',String(value));host.scrollLeft=0;host.scrollTop=0;if(value)host.focus();};
$('#photoFit').onclick=()=>scale(false);$('#photoActual').onclick=()=>scale(true);$('#closePhoto').onclick=()=>$('#photoDialog').close();$('#savePhoto').hidden=true;
bindPhotoPan(host);$('#photoDialog').showModal();scale(false);window.addEventListener('resize',()=>scale(actual));
