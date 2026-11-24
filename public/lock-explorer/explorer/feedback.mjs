// Frames are zero-based on the published 24 fps films.
const moments = {
  'output/three-pin/probe': [
    [32,'Spring pressure','Pin 1 moves with the hook. Its spring pushes it back down as the hook lowers.'],
    [95,'A binding pin','Pin 2 feels stiffer. Turning pressure holds its driver against the edge of the chamber.'],
    [138,'A pin sets','The resistance eases as the driver clears. The picker may feel a small click through the hook.']
  ],
  'output/three-pin-spool/spool': [
    [223,'A false set','The turning tool moves forward as the core catches on the spool’s narrow neck.'],
    [335,'Counter-rotation','The picker feels the turning tool push back as the wide base rises against the core.']
  ],
  'output/serrated-recovery/three-stack-serrated': [
    [68,'A groove clicks','The first groove catches. The picker may feel a click even though the driver still blocks the core.'],
    [126,'The driver clears','This can feel like another groove. The key pin now has room to move beneath the driver.']
  ],
  'output/security-sequences/mushroom': [
    [135,'A false set','Pin 2 has set. The picker feels the core turn farther, until it catches against the mushroom in pin 3.'],
    [250,'Counter-rotation','The turning tool pushes back against the picker’s finger as the mushroom’s sloping shoulder rises.']
  ],
  'output/security-sequences/hybrid': [
    [253,'Counter-rotation','The turning tool pushes back as the wide base rises.'],
    [302,'A second catch','A groove near the base catches at the shear line. The picker may feel another click here.']
  ],
  'output/security-sequences/key-pin': [
    [122,'A groove clicks','The hook can transmit a click as the groove catches. The blue driver is still in the way.'],
    [204,'A trapped key pin','The hook has lowered, but the key pin has stayed up. The picker has lost the free movement beneath a set driver.']
  ],
  'output/security-sequences/mixed': [
    [155,'A groove clicks','The click at pin 2 comes from a groove. The driver still blocks the core.'],
    [841,'The core turns','As pin 5 sets, the turning tool moves forward. The core has caught against the serrated spool in pin 4.'],
    [1557,'The tool pushes back','Lifting the mushroom in pin 6 pushes the turning tool back. Pin 5 is about to lose its set again.']
  ]
};

export function hasTouchCues(asset){
  return Object.hasOwn(moments,asset);
}

export function touchCues(asset){
  return `<details class="touch-cues"><summary>Explore touch and sound</summary>
    <label>Pause at <select><option value="">Choose a moment</option>${moments[asset].map(([frame,name])=>
      `<option value="${frame}">${name}</option>`).join('')}</select></label>
    <p role="status" hidden></p></details>`;
}

export function wireTouchCues(figure,film){
  const movie=figure.querySelector('video'), panel=figure.querySelector('.touch-cues');
  const select=panel.querySelector('select'), explanation=panel.querySelector('p');
  const controller=new AbortController(), options={signal:controller.signal};
  let pending=null;
  function seek(){
    if(pending===null || movie.readyState<1)return;
    movie.currentTime=(pending+.25)/24;
    pending=null;
  }
  function clear(){
    pending=null;
    select.value='';
    explanation.hidden=true;
    explanation.textContent='';
  }
  select.onchange=()=>{
    if(select.value===''){clear();return;}
    const [frame,,description]=moments[film.asset].find(([f])=>f===Number(select.value));
    movie.pause();
    pending=frame;
    explanation.hidden=false;
    explanation.textContent=description;
    if(movie.readyState>=1)seek();else movie.load();
  };
  function metadata(){
    if(!film.captions && !movie.textTracks.length && typeof VTTCue==='function'){
      const track=movie.addTextTrack('captions','English','en');
      film.cues.forEach(([frame,text],i)=>{
        const end=film.cues[i+1]?.[0]/24 || movie.duration;
        if(end>frame/24)track.addCue(new VTTCue(frame/24,end,text));
      });
      track.mode='disabled';
    }
    seek();
  }
  movie.addEventListener('loadedmetadata',metadata,options);
  movie.addEventListener('play',clear,options);
  movie.addEventListener('seeked',()=>{
    if(select.value!=='' && Math.abs(movie.currentTime*24-Number(select.value))>1)clear();
  },options);
  movie.addEventListener('error',()=>{
    panel.open=true;select.disabled=true;explanation.hidden=false;
    explanation.textContent='The film could not load. Reload the page to try again.';
  },options);
  if(movie.readyState>=1)metadata();
  return ()=>{controller.abort();movie.pause();};
}
