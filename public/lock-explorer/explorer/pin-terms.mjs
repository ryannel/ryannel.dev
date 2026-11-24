import {securitySequence} from './security-films.mjs';
// Positions are in a 480-wide copy of the actual film (270 high) or still (320 high).
// Each film position belongs to one frame. Scrubbing away hides that example marker.
const standard = {
  front:[37,188,128],middle:[37,232,116],rear:[37,276,122],order:[108,188,125],
  plug:[37,252,190],shell:[37,252,60],chamber:[37,224,86],wall:[37,222,103],
  edge:[94,225,105],spring:[37,232,57],pair:[37,231,117],straight:[37,187,117],
  tension:[37,163,235],lift:[37,229,159],loose:[37,188,144],bind:[37,224,102],
  clear:[70,231,106],advance:[71,163,235],click:[70,231,106],release:[70,231,106],
  set:[94,230,101],gap:[94,231,112],withdraw:[94,216,170]
};
const spool = {
  ...Object.fromEntries(Object.entries(standard).map(([key,[frame,x,y]])=>[key,[frame+68,x,y]])),
  loose:[45,188,141],bind:[95,224,102],waist:[223,421,137],foot:[223,436,171],shoulder:[356,413,145],
  falseSet:[223,414,132],counter:[356,413,145],ease:[365,162,246],
  dropped:[378,189,120],hold:[268,229,159],free:[578,251,130]
};
const keyed = {
  shell:[53,159,95],line:[53,197,104],chamber:[53,173,74],wall:[53,184,83],
  pair:[53,207,104],key:[53,194,188],cut:[53,207,168],join:[53,207,104],
  door:[53,398,140],frame:[53,432,130]
};

const single = {plug:[0,139,154],shell:[0,124,90],line:[0,158,89],wall:[0,176,83],edge:[0,177,90],
  chamber:[0,178,65],spring:[0,188,36],turner:[0,234,237],pick:[0,150,212]};
const clearance = {clear:[124,190,90],advance:[124,234,237],click:[124,190,90],set:[129,189,84],release:[124,190,90]};
const paced = {clear:[105,190,90],advance:[105,233,237],click:[105,190,90],set:[110,189,84],release:[105,190,90]};
const profile = {
 'three-stack-serrated':{
   front:[31,162,92],middle:[91,212,96],rear:[91,262,92],order:[62,211,96],
   plug:[91,234,181],shell:[91,189,57],chamber:[91,404,110],wall:[179,437,131],
   line:[179,445,140],edge:[369,405,140],pair:[91,212,110],driver:[91,421,129],
   straight:[31,163,78],serrated:[91,421,136],groove:[91,421,139],ridge:[91,421,147],
   catch:[88,407,140],click:[88,407,140],spring:[91,421,88],lower:[179,422,149],
   turner:[193,136,244],tension:[91,136,244],ease:[193,136,244],pick:[91,199,156],
   lift:[91,211,148],bind:[62,405,140],clear:[126,421,139],advance:[130,136,244],
   overset:[179,433,133],withdraw:[179,209,165],hold:[154,211,126],dropped:[214,163,112],
   set:[369,421,134],gap:[369,421,162],free:[549,222,157],release:[354,421,140]
 },
 'standard-paced':{...single,...paced,straight:[33,188,107],driver:[33,188,107],lower:[33,187,145],bind:[33,181,96],lift:[33,187,167]},
 'spool-paced':{...single,...paced,spool:[50,192,102],waist:[50,192,101],foot:[50,193,116],shoulder:[78,187,98],falseSet:[50,184,90],counter:[78,187,98],lower:[50,194,144]},
 mushroom:{...single,...clearance,mushroom:[72,193,99],stem:[72,191,85],head:[72,195,103],shoulder:[72,191,97],falseSet:[0,189,91],counter:[72,191,97],lower:[72,194,130]},
 serrated:{...single,...clearance,serrated:[19,189,102],groove:[19,190,102],ridge:[19,190,99],catch:[19,181,91],lift:[19,188,157],lower:[19,188,142]},
 hybrid:{...single,...clearance,hybrid:[43,191,98],waist:[43,191,94],foot:[43,195,109],shoulder:[43,192,103],groove:[103,188,79],catch:[103,180,90],falseSet:[43,184,90],counter:[83,186,94],lower:[43,192,132]},
 'key-pin-trap':{notched:[135,185,117],groove:[135,175,123],ridge:[135,175,130],overset:[60,182,108],catch:[135,166,125],falseSet:[135,166,125],driver:[60,180,61],lower:[60,180,148],line:[60,150,125],edge:[135,163,125],tool:[60,179,183],withdraw:[160,416,171],plug:[135,89,170],shell:[135,130,80],spring:[135,451,91]}
};
const mixed = {
  'serrated-blocks':{bind:[0,111,151],line:[0,163,158],serrated:[0,130,133],groove:[0,129,134],ridge:[0,128,143],straight:[0,239,124],set:[0,239,157],spool:[0,349,168],waist:[0,350,169]},
  'spool-catches':{falseSet:[0,342,159],set:[0,128,152],waist:[0,350,167],foot:[0,353,197],gap:[0,127,187]},
  'shoulder-lifts':{counter:[0,339,159],shoulder:[0,343,161],set:[0,130,156],edge:[0,113,163]},
  'front-drops':{dropped:[0,130,198],spool:[0,350,133],set:[0,237,154],spring:[0,127,97]},
  'spool-retained':{spool:[0,350,119],set:[0,346,151],dropped:[0,128,192],gap:[0,347,182]},
  'front-recovered':{serrated:[0,130,130],set:[0,130,158],straight:[0,238,122],spool:[0,350,131],gap:[0,350,185],lower:[0,240,252]},
  'core-open':{serrated:[0,129,121],straight:[0,239,120],spool:[0,349,120],set:[0,350,154],line:[0,174,163],lower:[0,263,291],free:[0,278,208]}
};
export function pinExamples(asset,still,mixedFilm=false) {
  const kind=asset?.split('/').pop();
  let points=still ? mixed[still] : profile[kind];
  if(kind==='standard') points={...standard,free:[285,161,231]};
  if(kind==='probe'){
    points=Object.fromEntries(Object.entries(standard).map(([key,[frame,x,y]])=>
      [key,[frame+68,x,y]]));
    points.loose=[45,188,141];
    points.bind=[95,224,102];
    points.free=[431,161,231];
  }
  if(kind==='spool') points=mixedFilm?{...spool,straight:[105,232,101],serrated:[45,187,110],
    groove:[45,188,106],ridge:[45,188,111]}:spool;
  if(kind==='pin-correct-paced'||kind==='pin-wrong') points={...keyed,join:[53,kind==='pin-wrong'?235:207,kind==='pin-wrong'?113:104]};
  if(still && points){
    points={front:[0,130,164],middle:[0,239,152],rear:[0,349,158],plug:[0,268,217],shell:[0,273,82],
      line:[0,161,157],spring:[0,128,48],lower:[0,239,257],...points};
  }
  if(securitySequence(asset))points=securitySequence(asset).points;
  return Object.entries(points||{}).map(([key,[frame,x,y]])=>({key,frame,x:x/480,y:y/(still?320:270)}));
}
