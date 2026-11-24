// Drop this module next to explorer.html and its media. Each element owns its frame.
const viewerURL=new URL('./explorer.html',import.meta.url);
const protocol='lock-explorer/1';
const gap=20;
// Scroll distance that brings most of a box into view, or 0 when it is already mostly visible.
function revealOffset(top,bottom,viewport){
  const height=bottom-top,visible=Math.min(bottom,viewport)-Math.max(top,0);
  if(height<=0||visible>=Math.min(height,viewport)*.75)return 0;
  return top<gap||height+gap*2>viewport?top-gap:bottom-viewport+gap;
}
export class LockExplorer extends HTMLElement {
  static observedAttributes=['start','label'];
  constructor(){
    super();
    const root=this.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent=':host{display:block;width:100%;min-width:0}iframe{display:block;box-sizing:border-box;background:#f7f6ef;width:100%;height:640px;border:1px solid #cbd2c7;border-radius:8px}';
    this.frame=document.createElement('iframe');
    this.frame.setAttribute('part','frame');
    this.frame.loading='lazy';
    this.frame.allowFullscreen=true;
    root.append(style,this.frame);
    this.onMessage=this.onMessage.bind(this);
    this.connect=()=>this.frame.contentWindow?.postMessage({type:protocol,action:'connect'},viewerURL.origin);
  }
  connectedCallback(){
    this.frame.title=this.getAttribute('label')||'Interactive lock explorer';
    this.frame.addEventListener('load',this.connect);
    window.addEventListener('message',this.onMessage);
    this.open();
  }
  disconnectedCallback(){
    window.removeEventListener('message',this.onMessage);
    this.frame.removeEventListener('load',this.connect);
  }
  attributeChangedCallback(name,oldValue,value){
    if(!this.isConnected||oldValue===value)return;
    if(name==='label')this.frame.title=value||'Interactive lock explorer';
    else this.open();
  }
  open(){
    const url=new URL(viewerURL);
    url.searchParams.set('embed','1');
    url.hash=this.getAttribute('start')||'collection';
    if(this.frame.src!==url.href)this.frame.src=url.href;
    else this.connect();
  }
  onMessage(event){
    if(event.origin!==viewerURL.origin||event.source!==this.frame.contentWindow||event.data?.type!==protocol)return;
    const {action,height}=event.data;
    if(action==='ready')this.connect();
    if(action==='size'&&Number.isSafeInteger(height)&&height>0&&height<100000){
      this.frame.style.height=(height+2)+'px';
    }
    // Keep a little of the article visible above the reader when it scrolls the page.
    if(action==='route'){
      const top=this.getBoundingClientRect().top;
      if(top<0)window.scrollBy({top:top-gap,behavior:'instant'});
    }
    if(action==='reveal'&&Number.isFinite(event.data.top)&&Number.isFinite(event.data.bottom)){
      const offset=this.frame.getBoundingClientRect().top+this.frame.clientTop;
      const delta=revealOffset(offset+event.data.top,offset+event.data.bottom,window.innerHeight);
      if(delta)window.scrollBy({top:delta,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
  }
}
if(!customElements.get('lock-explorer'))customElements.define('lock-explorer',LockExplorer);
