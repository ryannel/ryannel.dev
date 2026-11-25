import {assemblyLabels} from './assembly-films.mjs';
// Each version uses the same 24 fps timeline, including the shortened key films.
const details = {
  probe:'Straight cutaway', spool:'Spool', 'three-stack-serrated':'Driver grooves',
  mushroom:'Mushroom driver', hybrid:'Serrated spool', 'key-pin':'Key pin', mixed:'Active pin',
  'pin-binding':'Shear line', 'wafer-binding':'Wafer window', 'lever-binding':'Lever gates', 'disc-binding':'Disc contact',
  'wafer-manual':'Wafer window', 'wafer-security':'Sidebar notch', 'wafer-clamp':'Sidebar teeth',
  'lever-manual':'Lever gates', 'lever-security':'False gate', 'lever-detector':'Detector',
  'disc-manual':'Disc contact', 'disc-security':'Disc gates', 'disc-blocking':'Locking bars',
  'warded-manual':'Bolt talon', 'warded-security':'Rear ward', 'warded-keyhole':'Entrance ward',
  'combination-correct':'Wheel faces', 'combination-wrong':'Wheel faces',
  'combination-manual':'Cam pocket', 'combination-security':'Fence spring', 'combination-roller':'Contact roller',
  'pin-wrong':'Middle pin', 'wafer-wrong':'Middle wafer', 'lever-wrong':'Bolt stump',
  'disc-wrong':'Sidebar', 'warded-wrong':'Key bit and ward'
};

export function cameraFiles(asset){
  const name=asset.split('/').at(-1);
  if(Object.hasOwn(assemblyLabels,name)){
    const base='output/assembly-films/'+name;
    return {assembly:true,whole:base+'-whole.mp4',context:base+'-context.mp4',guided:base+'-guided.mp4',
      detail:base+'-detail.mp4',poster:base+'-poster.jpg',contextPoster:base+'-context-poster.jpg',detailTitle:details[name]};
  }
  const base='output/reader-cameras/'+name;
  const cylinder=asset==='output/binding/pin-binding'||/^output\/(three-pin|three-pin-spool|serrated-recovery|security-sequences)\//.test(asset);
  const context=/^output\/(family-sections|lever-case)\//.test(asset)||/^output\/binding\/(wafer|disc|lever)-binding$/.test(asset);
  return {whole:cylinder?base+'-whole.mp4':null,context:(context||cylinder)?base+'-context.mp4':null,
    contextPoster:(context||cylinder)?base+'-context-poster.jpg':null,guided:base+'-guided.mp4',detail:base+'-detail.mp4',poster:base+'-poster.jpg',
    detailTitle:details[name]||'Door'};
}

export function cameraChoices(c){
  const {detailTitle,whole,context,assembly}=cameraFiles(c.asset);
  return `<div class="camera-choices" role="group" aria-label="Film camera">${[
    ...(context?[['context','Lock and cutaway']]:[]),['guided','Guided film'],
    ...(whole?[['whole',assembly?'Whole lock':'Whole cylinder · 45°']]:[]),...(!whole?[['paired','Both views']]:[]),['detail',detailTitle]
  ].map(([key,title])=>`<button type="button" data-camera="${key}" aria-pressed="${key===(context?'context':'guided')}">${title}</button>`).join('')}</div>`;
}

export function wireCameras(figure,c){
  const movie=figure.querySelector('video');
  const files=cameraFiles(c.asset);
  const urls={context:files.context,whole:files.whole,guided:files.guided,detail:files.detail,paired:c.clip||c.asset+'.mp4'};
  const controller=new AbortController(), options={signal:controller.signal};
  let current=movie.dataset.camera,pending=null;

  function choose(view){
    if(view===current)return;
    // A second selection can arrive before the first source has loaded.
    pending=pending||{time:movie.currentTime,play:!movie.paused&&!movie.ended,rate:movie.playbackRate,
      captions:Array.from(movie.textTracks).some(track=>track.mode==='showing')};
    current=view;
    for(const button of figure.querySelectorAll('button[data-camera]')){
      button.setAttribute('aria-pressed',String(button.dataset.camera===view));
    }
    movie.dataset.switchingCamera='true';
    movie.pause();movie.preload='auto';movie.removeAttribute('poster');
    movie.dataset.camera=view;
    movie.src=urls[view]+(view==='paired'&&c.mediaRevision?'?v='+c.mediaRevision:'');
    movie.load();
  }
  movie.addEventListener('loadedmetadata',()=>{
    if(!pending)return;
    movie.playbackRate=pending.rate;
    if(pending.time>0)movie.currentTime=Math.min(pending.time,movie.duration);
    if(pending.captions)for(const track of movie.textTracks){
      if(track.kind==='captions'){track.mode='showing';break;}
    }
  },options);
  movie.addEventListener('loadeddata',()=>{
    if(!pending)return;
    const resume=pending.play;pending=null;delete movie.dataset.switchingCamera;
    if(resume)movie.play().catch(()=>{});
  },options);
  figure.querySelector('.camera-choices').addEventListener('click',event=>{
    const button=event.target.closest('[data-camera]');
    if(button)choose(button.dataset.camera);
  },options);
  return ()=>controller.abort();
}
