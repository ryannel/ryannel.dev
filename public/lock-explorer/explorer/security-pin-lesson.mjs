import {serratedFilm} from './serrated-study.mjs';
import {sequenceFilm} from './security-films.mjs';

const shapes = [
  {id:'spool', name:'Spool driver', paragraphs:[
    'With the spool’s narrow neck at the shear line, other pins can bind first. The picker may already have several pins set when the core turns and catches against the neck. That turn can come with a convincing click. It feels like another pin has set, but the spool’s wide base still blocks the lock. This is a false set.',
    'As the picker lifts the spool, its wide base pushes the core back. The picker feels that counter-rotation through the turning tool and has to ease the tension to let the base pass. That backward turn puts the pins they’ve already set at risk. If a chamber comes back into line with its driver, the spring can push the driver back into the core and the picker has to set it again.'
  ]},
  {id:'serrated', name:'Serrated driver', paragraphs:[
    'Each groove on a serrated driver can catch at the shear line with a click that feels like the pin has set. After several false clicks, the real set can feel like just another groove. Lifting again can push the key pin across the shear line and overset it.',
    'The picker checks how the pin moves after each click. If the driver still binds, it may need a little more lift. Once it clears, the key pin can move beneath it. Easing the tension can free an overset key pin, at the risk of dropping pins the picker has already set.'
  ]},
  {id:'mushroom', name:'Mushroom driver', paragraphs:[
    'A mushroom driver is shaped to put earlier sets at risk. Its narrow stem leaves room for other pins to bind first, so the picker may have several pins set by the time the mushroom binds.',
    'Lifting the mushroom forces its sloping shoulder against the core. The picker feels the turning tool push back and has to ease the tension so the wide head can pass. That counter-rotation risks dropping pins the picker has already set.'
  ]},
  {id:'hybrid', name:'Serrated spool', paragraphs:[
    'A serrated spool combines the false set of a spool with the false clicks of a serrated driver. Its narrow waist lets the core turn partway. Even after the wide base starts to clear, a groove can catch at the shear line and give a convincing click.',
    'As the picker lifts the wide base, they feel the turning tool push back. Easing the tension lets the spool rise, at the risk of dropping earlier sets. After the groove clicks, the picker checks whether the driver still binds before lifting it farther.'
  ]},
  {id:'key-pin', name:'Notched key pin', paragraphs:[
    'A notch in the key pin can catch on the edge of the core if the picker lifts too far. Paired with a serrated driver, it makes an overset easy to miss. The click of the lower pin catching can feel just like another groove in the driver.',
    'When the picker lowers the hook, the key pin stays up. Easing the tension frees the notch so the key pin can drop below the shear line. It also risks dropping pins the picker has already set.'
  ]}
];

export function pinSecurityChapter(spool){
  const studies=shapes.map(({id,name,paragraphs})=>{
    const film=id==='spool'?spool:id==='serrated'?serratedFilm:sequenceFilm(id);
    return {...film,slug:id==='spool'?undefined:id,choice:name,title:name,
      lead:paragraphs.join('\n\n'),profile:true,thumbnail:'output/assembly-films/'+film.asset.split('/').at(-1)+'-feature.jpg'};
  });
  return {...studies[0],heading:spool.title,introduction:spool.lead,variants:studies.slice(1)};
}
