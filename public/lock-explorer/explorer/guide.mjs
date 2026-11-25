import {cameraChoices,cameraFiles,wireCameras} from './camera-views.mjs?v=view-labels-1';
import {featureNotes} from './feature-notes.mjs';
import {familyData} from './family-data.mjs?v=wheel-views-1';
import {hasTouchCues,touchCues,wireTouchCues} from './feedback.mjs?v=quiet-1';
import {guides} from './walkthroughs.mjs?v=lock-views-2';
import {labelControls,labelFrame,wireLabels} from './part-labels.mjs?v=view-labels-1';

const main=document.querySelector('main');
const names=Object.keys(guides);
const method=id=>id==='warded'?'bypass':id==='combination'?'manipulation':'picking';
const slugs=id=>guides[id].chapters.map(c=>c.routeSlug);
const topics=id=>guides[id].chapters.map(c=>c.topic);
const link=(id,index)=>'#'+id+'/'+guides[id].chapters[index].routeSlug;
let lastRoute;
let teardown;
let revision=0;

function route(){
  const [id,topic,beat,view]=location.hash.slice(1).split('/');
  if(id==='catalogue')return {plan:true,filter:names.includes(topic)?topic:'all'};
  if(!names.includes(id))return {};
  const legacy={orient:'opening',open:'opening',blocked:slugs(id)[1],'different-key':slugs(id)[1],manual:method(id),'without-key':method(id),shape:'security',replay:'security',spool:'security'};
  const chapters=slugs(id);
  const index=Math.max(0,chapters.indexOf(chapters.includes(topic)?topic:legacy[topic]));
  return {id,index:Math.min(index,guides[id].chapters.length-1),parts:view==='parts'||beat==='parts',profile:topic==='security'?beat:undefined};
}

function collection(){
  return `<div class="collection-heading"><h1>Inside six locks</h1><p>Choose a lock to see how it opens. Then explore how it can be picked, bypassed or manipulated, and the security features that make that harder.</p></div>
    <div class="shelf">${names.map(id=>{
      const g=guides[id];
      return `<a class="card" href="${link(id,0)}"><div class="render-crop"><img src="explorer/covers/${id}.webp" alt="" width="640" height="350"></div><div class="cardbody"><strong>${g.name}</strong><small>${g.hint}</small><span class="arrow" aria-hidden="true">→</span></div></a>`;
    }).join('')}</div>`;
}

function navigation(id,index,parts=false){
  const {chapters,name}=guides[id];
  const anatomy=link(id,index)+'/inspect/parts';
  return `<aside class="lesson-nav" aria-label="Explore ${name}">
    <a class="all-locks" href="#collection">← All locks</a>
    <label class="family-picker">Lock type<select aria-label="Lock type" data-lock-family>${names.map(k=>`<option value="${k}" ${k===id?'selected':''}>${guides[k].name}</option>`).join('')}</select></label>
    <nav class="section-list" aria-label="Sections"><h2>Sections</h2>${chapters.map((c,i)=>`<a href="${link(id,i)}" ${!parts&&index===i?'aria-current="page"':''}>${topics(id)[i]}</a>`).join('')}
    <a class="parts-nav" href="${anatomy}" ${parts?'aria-current="page"':''}>Explore the parts in 3D</a></nav>
    <label class="mobile-sections">Section<select aria-label="Section" data-section>${chapters.map((c,i)=>`<option value="${link(id,i)}" ${!parts&&index===i?'selected':''}>${topics(id)[i]}</option>`).join('')}<option ${parts?'selected':''} value="${anatomy}">Explore the parts in 3D</option></select></label>
  </aside>`;
}
function chooseSection(current){
  const lock=main.querySelector('[data-lock-family]');
  if(lock)lock.onchange=()=>{
    const target=lock.value;
    const slug=slugs(current.id)[current.index];
    const match=slugs(target).indexOf(slug);
    const index=match>=0?match:slug===method(current.id)||slug==='binding'?slugs(target).indexOf(method(target)):slug.startsWith('different-')?1:0;
    go(link(target,index)+(current.parts?'/inspect/parts':''));
  };
  const section=main.querySelector('[data-section]');
  if(section)section.onchange=()=>{go(section.value);};
}
function go(hash){
  if(window===window.parent){location.hash=hash;return;}
  history.replaceState(null,'',hash);render();
}
function huntButton(asset){
  const runs={
    'output/three-pin/probe':[12,151,'Watch the search for a binding pin'],
    'output/three-pin-spool/spool':[0,150,'Watch the first search'],
    'output/lever-case/lever-manual':[0,112,'Replay the search through the levers'],
    'output/lever-case/lever-security':[0,112,'Replay the search through the levers'],
    'output/family-sections/disc-manual':[108,220,'Replay the search through the discs'],
    'output/family-sections/disc-blocking':[0,85,'Replay the middle disc turn'],
    'output/family-sections/disc-security':[0,112,'Replay the search through the discs'],
    'output/family-sections/wafer-manual':[0,101,'Watch the search for a binding wafer'],
    'output/family-sections/wafer-security':[0,101,'Watch the first search'],
    'output/security-sequences/mixed':[642,850,'Watch the search for pin 5']
  };
  const run=runs[asset];
  const tension=asset==='output/family-sections/disc-manual'?
    '<button type="button" data-play-from="0" data-play-until="108">Replay how tension is applied</button>':'';
  return run?`${tension}<button type="button" data-play-from="${run[0]}" data-play-until="${run[1]}">${run[2]}</button>`:'';
}
function film(c,feature=false){
  const description=feature?`<header class="feature-copy"><h2>${c.title}</h2><div id="feature-description">${paragraphs(c.lead)}</div></header>`:'';
  const notes=featureNotes(c.featureId||c.study);
  const cameras=cameraFiles(c.asset);
  const revision=c.mediaRevision?'?v='+c.mediaRevision:'';
  const study=familyData[c.study];
  const touch=hasTouchCues(c.asset);
  const video=labelFrame(`<video controls playsinline preload="metadata" data-camera="${cameras.context?'context':'guided'}" poster="${cameras.contextPoster||cameras.poster}" src="${cameras.context||cameras.guided}" aria-label="${c.title}" ${feature?'aria-describedby="feature-description"':touch?'':'aria-describedby="narration"'}>${c.captions?`<track kind="captions" srclang="en" label="English" src="${c.captions}${revision}">`:''}</video>`);
  const binding=c.bindingSource;
  const controls=binding?`<div class="binding-moments">
    <div class="film-actions" role="group" aria-label="Replay a movement and pause at the contact">${c.moments.map(([start,stop,label],index)=>`<button type="button" data-binding-moment data-play-from="${start}" data-play-until="${stop}" aria-pressed="${index===0}">${label}</button>`).join('')}</div>
    <p id="narration">${c.cues[0][1]}</p></div>`:touch?touchCues(c.asset):`<details class="film-options"><summary>Explore film moments</summary>
    ${c.steps?`<div class="study-tools"><label>Jump to a moment <select data-moment>${c.steps.map(([f,t])=>`<option value="${f}">${t}</option>`).join('')}</select></label><label class="step-pause"><input type="checkbox" data-pause-moments> Pause at each moment</label></div>`:''}
    ${study?`<dl class="mechanism-readout" aria-label="Mechanism at this frame">${study.columns.map((col,i)=>`<div><dt>${col}</dt><dd>${study.track[0][i+1]}</dd></div>`).join('')}</dl>`:''}
    ${c.comparisonFrames?'':`<div class="moment-caption"><p id="narration">${c.cues[0][1]}</p><div class="film-actions">${huntButton(c.asset)}<button class="freeze" type="button">${c.label}</button>${c.replayFrom!==undefined?`<button class="replay" type="button">${c.replayLabel||'Replay the shoulder contact'}</button>`:''}</div></div>`}${notes}</details>`;
  const comparison=c.comparisonFrames?`<div class="moment-caption dial-comparison">
    <p id="narration">${c.cues[0][1]}</p>
    <div class="film-actions" role="group" aria-label="Compare two moments in the film">
      ${c.comparisonFrames.map(([frame,title])=>`<button type="button" data-compare-frame="${frame}">${title}</button>`).join('')}
    </div></div>`:'';
  return `<figure class="lesson-film">${description}${video}${labelControls()}${cameraChoices(c)}${comparison}${controls}${c.sectionNote?`<details class="study-notes"><summary>About this cutaway</summary><p>${c.sectionNote}</p>${cameras.context&&!cameras.whole?'<p>The smaller view shows where the key or dial sits on the installed lock. The cutaway follows the mechanism through this lesson.</p>':''}${c.sectionImage?`<picture>${c.sectionImageMobile?`<source media="(max-width: 38em)" srcset="${c.sectionImageMobile}" width="488" height="1056">`:''}<img class="section-image" src="${c.sectionImage}" alt="${c.sectionAlt}" width="976" height="536" loading="lazy"></picture>`:''}${c.source?`<p><a href="${c.source[0]}" target="_blank" rel="noopener">${c.source[1]} ↗</a></p>`:''}${c.toolSource?`<p><a href="${c.toolSource[0]}" target="_blank" rel="noopener">${c.toolSource[1]} ↗</a></p>`:''}</details>`:''}</figure>`;
}

function currentChapter({id,index,profile}){
  const base=guides[id].chapters[index];
  return base.variants?.find(chapter=>chapter.slug===profile)||base;
}
function paragraphs(text,css=''){
  return text.split('\n\n').map(p=>`<p${css?` class="${css}"`:''}>${p}</p>`).join('');
}
function studyLinks(id,index,base,chapter){
  return `<nav class="feature-choices" aria-label="Security features">${[base,...base.variants].map(study=>
    `<a href="${link(id,index)}${study.slug?'/'+study.slug:''}" ${study===chapter?'aria-current="page"':''}><img src="${study.thumbnail}" alt=""><span>${study.choice}</span></a>`).join('')}</nav>`;
}

function chapterHeading(id,index,title){
  const labels=topics(id),last=index===labels.length-1;
  const previous=index>0?`<a class="chapter-back" rel="prev" href="${link(id,index-1)}"><span aria-hidden="true">←</span><span><small>Previous chapter</small>${labels[index-1]}</span></a>`:'';
  const next=last?'Explore another lock':labels[index+1];
  return `<p class="family-name">${guides[id].name} · ${index+1} of ${labels.length}</p>
    <div class="chapter-heading-row"><h1>${title}</h1><nav class="chapter-trail" aria-label="Chapter navigation">
    ${previous}<a href="${last?'#collection':link(id,index+1)}"${last?'':' rel="next"'}><span>${last?'':'<small>Next chapter</small>'}${next}</span><span aria-hidden="true">→</span></a></nav></div>`;
}
function lesson({id,index,profile}){
  const g=guides[id],c=currentChapter({id,index,profile}),next=g.chapters[index+1];
  const base=g.chapters[index],feature=Boolean(base.variants);
  return `<div class="explorer-layout">${navigation(id,index)}<article class="guide-article">
    <header class="lesson-heading">${chapterHeading(id,index,base.heading||c.title)}${paragraphs(feature?base.introduction:c.lead,'intro-copy')}</header>
    ${feature?studyLinks(id,index,base,c):''}${film(c,feature)}
    <nav class="continue" aria-label="Continue through the lesson">${index?`<a class="previous" href="${link(id,index-1)}">← ${topics(id)[index-1]}</a>`:'<span></span>'}
    ${next?`<a class="next" href="${link(id,index+1)}"><small>Next · ${topics(id)[index+1]}</small>${next.heading||next.title} <span aria-hidden="true">→</span></a>`:'<a class="next" href="#collection">Explore another lock <span aria-hidden="true">→</span></a>'}</nav>
    </article></div>`;
}

// Bring the film back into view after a moment is chosen from controls below it.
function revealOffset(top,bottom,viewport,gap=20){
  const height=bottom-top,visible=Math.min(bottom,viewport)-Math.max(top,0);
  if(height<=0||visible>=Math.min(height,viewport)*.75)return 0;
  return top<gap||height+gap*2>viewport?top-gap:bottom-viewport+gap;
}
function reveal(element){
  const {top,bottom}=element.getBoundingClientRect();
  if(window!==window.parent){window.dispatchEvent(new CustomEvent('explorer-reveal',{detail:{top,bottom}}));return;}
  const delta=revealOffset(top,bottom,window.innerHeight);
  if(delta)window.scrollBy({top:delta,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}

function wireMovie(c,figure){
  if(hasTouchCues(c.asset))return wireTouchCues(figure,c);
  const movie=figure.querySelector('video');
  const narration=figure.querySelector('#narration');
  const pauseAt=figure.querySelector('.freeze');
  const study=familyData[c.study], meters=figure.querySelectorAll('.mechanism-readout dd');
  const moment=figure.querySelector('[data-moment]');
  const stepPause=figure.querySelector('[data-pause-moments]');
  let nextMoment=null,momentCallback=0;
  let pendingTime=null,previous=-1;
  let clipEnd=null;
  const showFilm=()=>reveal(movie.closest('.label-frame')||movie);
  if(c.bindingSource){movie.defaultPlaybackRate=.75;movie.playbackRate=.75;}
  function seekFrame(frame){
    clipEnd=null;
    movie.pause();
    if(movie.readyState<1){pendingTime=frame;movie.load();return;}
    pendingTime=null;movie.currentTime=(frame+.3)/24;
  }
  function scheduleMoment(){
    if(momentCallback||nextMoment===null||movie.paused||!movie.requestVideoFrameCallback)return;
    momentCallback=movie.requestVideoFrameCallback((_,info)=>{
      momentCallback=0;stopAtMoment(info.mediaTime);scheduleMoment();
    });
  }
  function armMoment(){
    const frame=Math.floor(movie.currentTime*24+.1);
    nextMoment=clipEnd??(stepPause?.checked?c.steps.find(([n])=>n>frame)?.[0]??null:null);
    scheduleMoment();
  }
  function stopAtMoment(time){
    if(nextMoment!==null&&!movie.paused&&!movie.seeking&&time*24+.02>=nextMoment){
      const target=nextMoment;nextMoment=null;seekFrame(target);
    }
  }
  if(stepPause)stepPause.onchange=armMoment;
  movie.addEventListener('play',armMoment);
  movie.addEventListener('seeked',armMoment);
  function metadata(){if(pendingTime!==null)seekFrame(pendingTime);}
  for(const button of figure.querySelectorAll('[data-play-from]')){
    button.onclick=()=>{
      pendingTime=null;
      clipEnd=Number(button.dataset.playUntil);
      movie.currentTime=Number(button.dataset.playFrom)/24;
      nextMoment=clipEnd;
      movie.play().catch(()=>{clipEnd=null;});
      showFilm();
    };
  }
  movie.addEventListener('pause',()=>{if(!movie.dataset.switchingCamera){clipEnd=null;nextMoment=null;}});
  if(moment)moment.onchange=()=>{seekFrame(Number(moment.value));showFilm();};
  movie.addEventListener('loadedmetadata',metadata);
  function caption(){
    const frame=Math.floor(movie.currentTime*24+.015);
    if(study){
      const row=study.track.findLast(([f])=>f<=frame);
      if(row)meters.forEach((meter,i)=>{if(meter.textContent!==row[i+1])meter.textContent=row[i+1];});
    }
    const i=c.cues.findLastIndex(([start])=>start<=frame);
    stopAtMoment(movie.currentTime);
    if(moment&&i>=0)moment.selectedIndex=i;
    if(i>=0&&i!==previous){
      narration.textContent=c.cues[i][1];previous=i;
      if(c.moments)figure.querySelectorAll('[data-binding-moment]').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));
    }
  }
  if(pauseAt)pauseAt.onclick=()=>{seekFrame(c.stop);showFilm();};
  for(const button of figure.querySelectorAll('[data-compare-frame]')){
    button.onclick=()=>{seekFrame(Number(button.dataset.compareFrame));showFilm();};
  }
  const replay=figure.querySelector('.replay');
  if(replay)replay.onclick=()=>{
    movie.currentTime=c.replayFrom/24;
    movie.play().catch(()=>movie.pause());
    showFilm();
  };
  movie.addEventListener('timeupdate',caption);
  movie.addEventListener('seeked',caption);
  movie.addEventListener('error',()=>{
    narration.textContent='This film could not load. Reload the page to try again.';
    if(pauseAt)pauseAt.disabled=true;
    for(const button of figure.querySelectorAll('[data-compare-frame],[data-play-from]'))button.disabled=true;
  });
  return ()=>{movie.pause();movie.removeEventListener('loadedmetadata',metadata);if(momentCallback)movie.cancelVideoFrameCallback(momentCallback);};
}

async function render(){
  const serial=++revision,s=route();
  const keepLabels=s.id&&s.id===lastRoute?.id&&Boolean(main.querySelector('.label-switch[aria-expanded="true"]'));
  teardown?.();teardown=null;
  if(s.plan){
    const {catalogue}=await import('./plan.mjs?v=camera-review-1');
    if(serial!==revision)return;
    main.innerHTML=catalogue(s,{guides,link,topics});
    main.querySelector('#filter').onchange=e=>go('#catalogue/'+e.target.value);
  }else if(s.parts){
    main.innerHTML=`<div class="explorer-layout">${navigation(s.id,s.index,true)}<article class="guide-article"><div class="lesson-heading"><h1>${guides[s.id].name} parts model</h1></div><section data-inspector>Loading the model…</section><section data-model-glossary>${labelControls('model-part-key')}</section></article></div>`;
    const host=main.querySelector('[data-inspector]');
    const stopGlossary=wireLabels(main.querySelector('[data-model-glossary]'),s.id);
    teardown=stopGlossary;
    try{
      const {mount}=await import('./inspector.mjs?v=embed-fixes-1');
      if(serial!==revision)return;
      const stopModel=mount(host,s.id);
      teardown=()=>{stopModel?.();stopGlossary();};
    }catch{if(host.isConnected)host.textContent='The model could not load. Use the section menu to return to a lesson.';}
  }else if(s.id){
    main.innerHTML=lesson(s);
    const c=currentChapter(s);
    const figure=main.querySelector('.lesson-film');
    const stopMovie=wireMovie(c,figure);
    const stopCameras=wireCameras(figure,c);
    const stopLabels=wireLabels(figure,s.id,c);
    teardown=()=>{stopCameras();stopLabels();stopMovie();};
  }else main.innerHTML=collection();
  if(keepLabels)main.querySelector('.label-switch[aria-expanded="false"]')?.click();
  chooseSection(s);
  document.title=(s.plan?'Film catalogue':s.id?guides[s.id].name+' · '+currentChapter(s).title:'Inside six locks')+' · Lock explorer';
  document.body.dataset.page=s.plan?'plans':s.id?'lesson':'collection';
  const sameChapter=s.id && lastRoute?.id===s.id && s.index===lastRoute.index && s.profile!==lastRoute.profile && !s.parts && !lastRoute.parts;
  if(sameChapter)main.querySelector('.feature-choices [aria-current]')?.focus({preventScroll:true});
  else if(lastRoute)main.focus({preventScroll:true});
  if(window===window.parent){if(!sameChapter)window.scrollTo(0,0);}
  else window.dispatchEvent(new CustomEvent('explorer-route',{detail:{moved:Boolean(lastRoute)&&!sameChapter}}));
  lastRoute=s;
}

document.querySelector('.skip').onclick=e=>{e.preventDefault();main.focus();};
if(window!==window.parent){
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href^="#"]');
    if(!a||a.classList.contains('skip')||event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();go(a.hash);
  });
}
window.addEventListener('hashchange',render);render();
