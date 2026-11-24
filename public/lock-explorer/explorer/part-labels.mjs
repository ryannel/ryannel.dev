import {assemblyLabels} from './assembly-films.mjs';
import {familyData} from './family-data.mjs?v=wheel-views-1';
import {glossaryEntries} from './glossary.mjs?v=wheel-views-1';
import {pinExamples} from './pin-terms.mjs?v=field-1';
// Blender object IDs in the keyed films map to the same glossary as the lesson films.
const filmKeys = {
  pin: {drivers:'driver',keypins:'lower',plug:'plug',springs:'spring',cam:'cam'},
  wafer: {wafers:'wafers',plug:'plug',key:'key',cam:'cam'},
  lever: {'Lever stack':'lever','Small stump through gates':'stump','Tall bolt head':'bolt','Return springs':'leaf'},
  disc: {discs:'discs',sidebar:'sidebar',key:'key',drive:'frontDrive',cam:'cam'},
  warded: {wards:'wards',key:'bit',talon:'talon',bolt:'bolt'},
  combination: {wheels:'wheels',fence:'fence',nose:'nose',bolt:'bolt'},
  standard: {driver:'driver',lower:'lower',line:'line',pick:'pick',turner:'turner'},
  spool: {spool:'spool',driver:'driver',lower:'lower',line:'line',pick:'pick',turner:'turner'}
};
const familyNames={pin:'Pin tumbler',wafer:'Wafer',lever:'Lever',disc:'Disc detainer',warded:'Warded',combination:'Combination'};
export const labelFrame=media=>`<div class="label-frame">${media}<svg class="film-labels" role="img" aria-hidden="true"></svg></div>`;
export const labelControls=(id='part-key')=>`<div class="part-controls"><button type="button" class="label-switch" aria-expanded="false" aria-controls="${id}">Show labels</button>
  <div class="family-glossary" id="${id}" hidden><label class="label-choice">On the film <select><option value="">Main parts</option></select></label>
  <p class="label-status" role="status"></p><button class="locate-part" type="button" hidden>Go to a frame showing this part</button><details class="term-index"><summary></summary>
  <label class="term-filter">Find a term <input type="search" autocomplete="off"></label>
  <div class="term-list"></div><p class="no-terms" hidden>No matching terms.</p></details></div></div>`;

const requests=new Map();
function loadTracks(file){
  if(!requests.has(file))requests.set(file,fetch(new URL(file,import.meta.url)).then(response=>{
    if(!response.ok)throw Error('Part positions unavailable');
    return response.json();
  }).catch(error=>{requests.delete(file);throw error;}));
  return requests.get(file);
}
function pointAt(path,frame){
  const i=path.findIndex(([f])=>f>=frame);
  if(i<0)return path.at(-1).slice(1);
  if(i===0)return path[0].slice(1);
  const [a,x,y]=path[i-1],[b,u,v]=path[i],t=(frame-a)/(b-a);
  return [x+(u-x)*t,y+(v-y)*t];
}

const mainParts={
  pin:['spring','driver','lower'],wafer:['waferSpring','wafers','rack','housing','plug','key'],
  lever:['bolt','lever','detector','pivot','leaf'],disc:['frontDrive','discs','sidebar'],
  warded:['wards','entryWard','guide','bolt','bit'],combination:['wheels','fence','bolt','driveCam']
};
const featured={mixed:['serrated','hybrid','mushroom'],spool:['spring','spool','lower'],mushroom:['spring','mushroom','lower'],hybrid:['spring','hybrid','lower'],'three-stack-serrated':['spring','serrated','lower']};
const svgNS='http://www.w3.org/2000/svg';
function svgElement(tag,parent){
  const child=document.createElementNS(svgNS,tag);parent.append(child);return child;
}

// The video can have side bars on desktop and a transport area under the picture on phones.
function pictureRect(video){
  const box=video.getBoundingClientRect();
  const scale=Math.min(box.width/video.videoWidth,box.height/video.videoHeight);
  const width=video.videoWidth*scale,height=video.videoHeight*scale;
  const [x,y]=getComputedStyle(video).objectPosition.split(' ').map(value=>parseFloat(value)/100);
  return {left:(box.width-width)*x,top:(box.height-height)*y,width,height};
}

function makeOverlay(svg){
  const items=[];
  function itemAt(index){
    if(items[index])return items[index];
    const group=svgElement('g',svg),line=svgElement('path',group),tip=svgElement('circle',group);
    const box=svgElement('rect',group),text=svgElement('text',group);
    tip.setAttribute('r','3.4');box.setAttribute('rx','4');box.setAttribute('height','23');
    return items[index]={group,line,tip,box,text,width:0};
  }
  return (anchors,picture)=>{
    svg.style.visibility=anchors.length?'visible':'hidden';
    svg.setAttribute('aria-hidden',String(!anchors.length));
    if(anchors.length)svg.setAttribute('aria-label',anchors.map(item=>item.name).join(', '));
    for(let i=anchors.length;i<items.length;i++)items[i].group.style.display='none';
    if(!anchors.length)return;
    // Lay names on either side, in the same vertical order as their targets.
    const sides=[[],[]],ordered=[...anchors].sort((a,b)=>a.x-b.x);
    for(const [i,anchor] of ordered.entries()){
      const item=itemAt(i);item.group.style.display='';
      item.group.dataset.term=anchor.key;
      if(item.text.textContent!==anchor.name){
        item.text.textContent=anchor.name;item.width=Math.ceil(item.text.getComputedTextLength())+14;
      }
      const x=picture.left+anchor.x*picture.width,y=picture.top+anchor.y*picture.height;
      let side=ordered.length===1?Number(anchor.x>.5):Number(i>=Math.ceil(ordered.length/2));
      const room=side?picture.width*(1-anchor.x):picture.width*anchor.x;
      if(room<item.width+19)side=1-side;
      sides[side].push({item,x,y});
    }
    const top=picture.top+17,bottom=Math.max(top,picture.top+picture.height-41);
    for(const [side,labels] of sides.entries()){
      labels.sort((a,b)=>a.y-b.y);
      let last=top-30;
      for(const [index,{item,x,y}] of labels.entries()){
        const cy=Math.max(last+30,Math.min(bottom-30*(labels.length-index-1),Math.max(top,y-21)));
        last=cy;
        const reach=Math.min(68,picture.width*.10);
        const left=side?Math.min(x+reach,picture.left+picture.width-item.width-7):Math.max(x-reach-item.width,picture.left+7);
        const end=side?left:left+item.width;
        item.tip.setAttribute('cx',x);item.tip.setAttribute('cy',y);
        item.line.setAttribute('d',`M ${x} ${y} L ${end} ${cy}`);
        item.box.setAttribute('x',left);item.box.setAttribute('y',cy-11.5);item.box.setAttribute('width',item.width);
        item.text.setAttribute('x',left+7);item.text.setAttribute('y',cy+4);
      }
    }
  };
}

export function wireLabels(root,family,c={}){
  const panel=root.querySelector('.family-glossary'),toggle=root.querySelector('.label-switch');
  const list=panel.querySelector('.term-list'),filter=panel.querySelector('input'),choice=panel.querySelector('select');
  const index=panel.querySelector('details'),status=panel.querySelector('.label-status'),locate=panel.querySelector('.locate-part');
  const frame=root.querySelector('.label-frame'),movie=frame?.querySelector('video');
  const paint=frame?makeOverlay(frame.querySelector('svg')):null;
  const name=c.asset?.split('/').pop(),source=(c.bindingSource||c.asset)?.split('/').pop();
  const assembled=assemblyLabels[name],coords=assembled||familyData[c.inspect]?.points||{};
  const locations=new Map(),paths=new Map();
  for(const [term,[frame,x,y]] of Object.entries(coords))locations.set(term,{frame,x,y});
  if(family==='pin'&&movie&&!assembled){
    for(const point of pinExamples(c.asset,c.mixed,c.securityStudies==='mixed'))locations.set(point.key,point);
  }
  // The wheel-face inset stays fixed throughout both dial films, including the cut back to the door.
  if(c.inspect?.startsWith('combination-')&&!assembled){
    locations.set('driveCam',{x:953/1280,y:245/720});
    locations.set('wheels',{x:1140/1280,y:504/720});
  }
  for(const [key,point] of locations)if(point.frame>c.lastFrame)locations.delete(key);

  const entries=new Map(glossaryEntries(family)),rows=new Map();
  const detailTerms=new Set();
  const controller=new AbortController(),options={signal:controller.signal};
  let active=false,selected='',pending=null,videoCallback=0,ready=false;
  index.querySelector('summary').textContent=familyNames[family]+' glossary';
  for(const [key,[title,definition]] of entries){
    const row=document.createElement('div'),term=document.createElement('strong'),meaning=document.createElement('p');
    row.className='term-row';term.textContent=title;meaning.textContent=definition;
    row.append(term,meaning);list.append(row);rows.set(key,row);
  }

  async function prepare(){
    if(ready||!movie)return;
    if(assembled||!c.inspect){
      const dataset=await loadTracks(assembled?'./part-tracks.json':'./label-tracks.json');
      if(controller.signal.aborted)return;
      for(const [id,path] of Object.entries(dataset[source]||{})){
        const detail=id.startsWith('detail/');
        const key=assembled?id.replace(/^detail\//,''):filmKeys[family]?.[id];
        if(detail)detailTerms.add(key);
        if(entries.has(key))paths.set(key,path);
      }
    }
    if(ready)return;
    ready=true;
    const parts=document.createElement('optgroup'),moments=document.createElement('optgroup');
    parts.label='Parts';moments.label='Pause at a film moment';
    for(const [key,[title]] of entries){
      if(!paths.has(key)&&!locations.has(key))continue;
      const target=!paths.has(key)&&locations.get(key)?.frame!==undefined?moments:parts;
      target.append(new Option(title,key));
      const button=document.createElement('button');button.type='button';button.dataset.term=key;button.textContent=title;
      rows.get(key).firstChild.replaceWith(button);
    }
    for(const group of [parts,moments])if(group.children.length)choice.append(group);
  }
  const currentFrame=()=>Math.max(0,Math.floor(movie.currentTime*24+.005));
  function anchor(key,at){
    let x,y;
    if(paths.has(key)){
      const [u,v]=pointAt(paths.get(key),at);
      x=u/(detailTerms.has(key)?400:assembled?960:1600);y=v/(detailTerms.has(key)?460:assembled?720:900);
    }else{
      const p=locations.get(key);
      if(!p||(p.frame!==undefined&&p.frame!==at))return null;
      ({x,y}=p);
    }
    if(!(x>=0&&x<=1&&y>=0&&y<=1))return null;
    if(detailTerms.has(key)){x=(904+x*368)/1280;y=(148+y*424)/720;}
    else if(assembled&&movie.dataset.camera==='context'){x=x*896/1280;y=(24+y*672)/720;}
    return {key,name:entries.get(key)[0].replace(/ \(.+\)$/,''),x,y};
  }
  function draw(at){
    if(!movie)return;
    if(!active||!ready||movie.seeking||movie.dataset.switchingCamera||!movie.videoWidth){paint([]);return;}
    const keys=selected?[selected]:featured[name]||mainParts[family];
    const picture=pictureRect(movie);
    const limit=picture.width<430?2:3;
    const anchors=keys.map(key=>anchor(key,at)).filter(Boolean).slice(0,limit);
    locate.hidden=!selected||anchors.length>0||!paths.has(selected);
    paint(anchors,picture);
  }
  function drawNow(){if(movie)draw(currentFrame());}
  function update(){
    locate.hidden=true;choice.value=selected;
    status.textContent=selected?entries.get(selected)[1]:'';
    drawNow();
  }
  function seek(){
    if(pending===null||movie.readyState<1||movie.dataset.switchingCamera)return;
    const target=pending;pending=null;
    movie.currentTime=(target+.15)/24;
  }
  function select(key){
    selected=key;pending=null;
    if(key&&!paths.has(key)&&locations.get(key)?.frame!==undefined){
      movie.pause();pending=locations.get(key).frame;seek();
    }else if(paths.has(key)&&!anchor(key,currentFrame())){
      // Some inset cameras crop a moving part during the final turn.
      const at=currentFrame();
      const visible=paths.get(key).map(([frame])=>frame).filter(frame=>frame<movie.duration*24&&anchor(key,frame));
      if(visible.length){
        movie.pause();pending=visible.reduce((a,b)=>Math.abs(a-at)<Math.abs(b-at)?a:b);seek();
      }
    }
    update();
  }
  function resetMoment(){
    if(pending===null&&!movie.dataset.switchingCamera&&selected&&!paths.has(selected)){
      const pose=locations.get(selected)?.frame;
      if(pose!==undefined&&(!movie.paused||currentFrame()!==pose))select('');
    }
    drawNow();
  }
  function animate(){
    if(!active||movie.paused||videoCallback||!movie.requestVideoFrameCallback)return;
    videoCallback=movie.requestVideoFrameCallback((_,info)=>{
      videoCallback=0;draw(Math.round(info.mediaTime*24));animate();
    });
  }
  function stopAnimation(){if(videoCallback)movie.cancelVideoFrameCallback(videoCallback);videoCallback=0;}
  list.addEventListener('click',event=>{
    const button=event.target.closest('button[data-term]');if(!button)return;
    index.open=false;select(button.dataset.term);choice.focus({preventScroll:true});
    frame.scrollIntoView({block:'nearest'});
  },options);
  locate.addEventListener('click',()=>select(selected),options);
  choice.addEventListener('change',()=>select(choice.value),options);
  function filterTerms(){
    const query=filter.value.trim().toLowerCase();let count=0;
    for(const row of rows.values()){row.hidden=!row.textContent.toLowerCase().includes(query);if(!row.hidden)count++;}
    panel.querySelector('.no-terms').hidden=count!==0;
  }
  filter.addEventListener('input',filterTerms,options);
  if(!movie){panel.querySelector('.label-choice').hidden=true;index.open=true;toggle.textContent='Show glossary';}
  toggle.addEventListener('click',async()=>{
    active=!active;panel.hidden=!active;pending=null;selected='';
    toggle.setAttribute('aria-expanded',String(active));
    toggle.textContent=(active?'Hide ':'Show ')+(movie?'labels':'glossary');
    if(!active){stopAnimation();update();return;}
    index.open=!movie;filter.value='';filterTerms();update();
    try{
      await prepare();
      if(active&&!controller.signal.aborted){update();if(movie)animate();}
    }catch{if(active&&!controller.signal.aborted)status.textContent='Part positions could not load. The glossary is available below.';}
  },options);
  if(movie){
    movie.addEventListener('loadeddata',()=>{seek();drawNow();},options);
    movie.addEventListener('play',()=>{resetMoment();animate();},options);
    movie.addEventListener('seeked',resetMoment,options);
    movie.addEventListener('seeking',drawNow,options);
    movie.addEventListener('pause',()=>{stopAnimation();drawNow();},options);
    movie.addEventListener('timeupdate',drawNow,options);
  }
  const resize=new ResizeObserver(drawNow);if(frame)resize.observe(frame);
  return ()=>{controller.abort();stopAnimation();resize.disconnect();};
}
