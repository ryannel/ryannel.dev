if(window!==window.parent){
  document.documentElement.dataset.embedded='';
  const type='lock-explorer/1';
  let parentOrigin,previous=-1;
  function send(action,fields={}){
    if(parentOrigin)window.parent.postMessage({type,action,...fields},parentOrigin);
  }
  const page=document.querySelector('#explorer-page');
  function resize(){
    const height=Math.ceil(page.getBoundingClientRect().height);
    if(parentOrigin&&height!==previous){previous=height;send('size',{height});}
  }
  const observer=new ResizeObserver(resize);
  observer.observe(page);
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.data?.type!==type||event.data.action!=='connect')return;
    if(event.origin==='null'||(parentOrigin&&parentOrigin!==event.origin))return;
    parentOrigin=event.origin;previous=-1;resize();
  });
  window.addEventListener('explorer-route',event=>{
    resize();if(event.detail.moved)send('route');
  });
  // The host page owns the scroll position, so it decides whether the box needs revealing.
  window.addEventListener('explorer-reveal',event=>{
    const {top,bottom}=event.detail;
    send('reveal',{top:Math.round(top),bottom:Math.round(bottom)});
  });
  // The handshake carries no page data; the host replies with its own origin.
  window.parent.postMessage({type,action:'ready'},'*');
}
