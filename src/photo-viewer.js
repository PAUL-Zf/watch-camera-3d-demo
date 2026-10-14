export function photoDisplaySize(width,height,viewportWidth,viewportHeight,actual) {
  const scale=actual ? 1 : Math.min(1,viewportWidth/width,viewportHeight/height);
  return {width:width*scale,height:height*scale};
}
export function layoutPhoto(host,stage,canvas,actual) {
  host.classList.toggle('actual-size',actual);
  const size=photoDisplaySize(canvas.width,canvas.height,host.clientWidth,host.clientHeight,actual);
  // Explicit CSS pixels avoid intrinsic canvas sizing and flex shrink changing
  // the 100% image. The stage owns overflow; the dialog viewport stays bounded.
  canvas.style.width=`${size.width}px`;canvas.style.height=`${size.height}px`;
  stage.style.width=actual ? `${canvas.width}px` : '100%';
  stage.style.height=actual ? `${canvas.height}px` : '100%';
}
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
}
