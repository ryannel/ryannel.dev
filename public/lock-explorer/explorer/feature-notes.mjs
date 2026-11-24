// Clip ranges are zero-based frames in the 24 fps films.
const clipsByFeature = {
  'wafer-clamp': [[38, 91, "See the blade rock and catch"], [182, 250, "Replay the opening"]],
  'wafer-security': [[202, 248, "See what still blocks the turn"], [248, 328, "See the last notch line up"]],
  'pin-spool': [[305, 365, "See the turning tool push back"], [366, 516, "See pin 1 set again"]],
  'pin-serrated': [[328, 374, "See the play beneath a set driver"], [154, 223, "See both pins drop"]],
  'pin-mushroom': [[235, 286, "See the sloping shoulder catch"], [284, 423, "See pin 2 set again"]],
  'pin-hybrid': [[235, 307, "See the groove catch"], [298, 434, "See the driver clear the last groove"]],
  'pin-key-pin': [[158, 208, "See the key pin stay up"], [213, 253, "See the notch come free"]],
  'pin-mixed': [[1498, 1618, "See the second backward turn"], [1640, 1914, "See the last pin set"]],
  'lever-security': [[149, 181, "Replay the false gate"], [181, 287, "Replay the release"]],
  'lever-detector': [[66, 141, "See what stays latched"], [143, 248, "Watch the keyed reset"]],
  'disc-security': [[149, 181, "Replay the false gate"], [181, 287, "Replay the release"]],
  'disc-blocking': [[16, 85, "See the discs held together"], [137, 260, "Watch the discs line up"]],
  'warded-security': [[20, 65, "See the rear ward stop the bit"], [115, 204, "See the tip retract the bolt"]],
  'warded-keyhole': [[0, 48, "See the obstruction at the entrance"], [89, 220, "Watch the bit drive the bolt"]],
  'combination-security': [[15, 60, "Replay the fence touching a rim"], [154, 221, "See the fence enter all three gates"]],
  'combination-roller': [[38, 132, "Compare the two roller faces"], [155, 306, "Compare both wheel settings"]],
};

export function featureNotes(id){
  const clips=clipsByFeature[id];
  if(!clips)return '';
  return `<div class="feature-notes film-actions" role="group" aria-label="Replay moments from the film">${clips.map(([start,end,action])=>
      `<button type="button" data-play-from="${start}" data-play-until="${end}">${action} <span aria-hidden="true">▶</span></button>`).join('')}</div>`;
}
