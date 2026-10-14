export function bindPhotoPan(host) {
  let drag;
  const end=event=>{
    if (!drag || event.pointerId!==drag.id) return;
    if (host.hasPointerCapture?.(drag.id)) host.releasePointerCapture(drag.id);
    drag=undefined;host.classList.remove('panning');
  };
  host.addEventListener('pointerdown',event=>{
    if (!host.classList.contains('actual-size') || event.button!==0) return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:host.scrollLeft,top:host.scrollTop};
    host.setPointerCapture(event.pointerId);host.classList.add('panning');host.focus();event.preventDefault();
  });
  host.addEventListener('pointermove',event=>{
    if (!drag || event.pointerId!==drag.id) return;
    host.scrollLeft=drag.left+drag.x-event.clientX;host.scrollTop=drag.top+drag.y-event.clientY;
    event.preventDefault();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,end);
  return ()=>{if(drag)end({pointerId:drag.id});};
}

export const MIN_PHOTO_ZOOM=.01, MAX_PHOTO_ZOOM=8;
export const clampPhotoZoom=value=>Math.max(MIN_PHOTO_ZOOM,Math.min(MAX_PHOTO_ZOOM,value));
export function photoAnchorPoint(zoom,left,top,viewportWidth,viewportHeight,imageWidth,imageHeight,x,y) {
  return {x:(left+x-Math.max(0,(viewportWidth-imageWidth*zoom)/2))/zoom,y:(top+y-Math.max(0,(viewportHeight-imageHeight*zoom)/2))/zoom};
}
export function createPhotoViewer(host,stage,getCanvas,onChange=()=>{}) {
  let zoom=1, mode='fit';
  const cancelPan=bindPhotoPan(host);
  function apply(value,anchor,recenter=false) {
    const canvas=getCanvas();if(!canvas)return;
    cancelPan();host.classList.add('zoomable');
    const centre=anchor??{x:host.clientWidth/2,y:host.clientHeight/2};
    const point=recenter ? {x:canvas.width/2,y:canvas.height/2} : photoAnchorPoint(zoom,host.scrollLeft,host.scrollTop,host.clientWidth,host.clientHeight,canvas.width,canvas.height,centre.x,centre.y);
    zoom=clampPhotoZoom(value);host.classList.toggle('actual-size',mode!=='fit');
    const width=canvas.width*zoom,height=canvas.height*zoom;
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    // Re-measure after scrollbar layout; only oversized images should overflow.
    for(let i=0;i<2;i++){stage.style.width=`${Math.max(host.clientWidth,width)}px`;stage.style.height=`${Math.max(host.clientHeight,height)}px`;}
    const x=recenter?host.clientWidth/2:centre.x,y=recenter?host.clientHeight/2:centre.y;
    host.scrollLeft=Math.max(0,(host.clientWidth-width)/2)+point.x*zoom-x;
    host.scrollTop=Math.max(0,(host.clientHeight-height)/2)+point.y*zoom-y;
    onChange({zoom,mode});
  }
  const api={
    fit(){const canvas=getCanvas();if(!canvas)return;mode='fit';host.classList.add('zoomable');canvas.style.width='0px';canvas.style.height='0px';stage.style.width='100%';stage.style.height='100%';apply(Math.min(1,host.clientWidth/canvas.width,host.clientHeight/canvas.height),undefined,true);},
    setZoom(value,anchor){mode='manual';apply(value,anchor);},
    zoomBy(factor,anchor){api.setZoom(zoom*factor,anchor);},
    resize(){if(mode==='fit')api.fit();else apply(zoom);},
    reset(){cancelPan();zoom=1;mode='fit';host.classList.remove('zoomable','actual-size','panning');},
    getState:()=>({zoom,mode})
  };
  host.addEventListener('wheel',event=>{
    if(!getCanvas()||event.shiftKey)return;
    event.preventDefault();const rect=host.getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?host.clientHeight:1);
    api.zoomBy(Math.exp(-Math.max(-150,Math.min(150,delta))*.002),{x:event.clientX-rect.left-host.clientLeft,y:event.clientY-rect.top-host.clientTop});
  },{passive:false});
  host.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey)return;
    if(['+','=','-','_'].includes(event.key)){event.preventDefault();api.zoomBy(['-','_'].includes(event.key)?1/1.25:1.25);}
  });
  return api;
}
