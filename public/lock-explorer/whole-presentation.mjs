/** Shared by the atlas and detailed installed-opening player. */
export function openingAsset(kind, mode) {
 const paced = mode === 'correct' && ['pin', 'wafer'].includes(kind);
 return 'output/mechanism-context/' + kind + '-' + mode + (paced ? '-paced' : '');
}

export function openingStatus(state, final, kind) {
 if (state.doorAngle > 0) return state.doorAngle === final.doorAngle ? 'Door open' : 'Door opening';
 if (state.boltClear) return 'Unlocked · door closed';
 if (state.blocked) return kind === 'combination' ? 'Fence blocked · bolt held' : 'Key blocked · door closed';
 return 'Lock held closed';
}

export function openingPart(part, kind, mode) {
 if (kind === 'pin' && mode === 'wrong' && part.id === 'key') {
  return {...part, text:'Mismatched cut key', description:'The shoulder seats at the usual depth. The low third cut leaves its driver across the shear line.'};
 }
 return part;
}

/** Chapter indices are the first visible frames of events in the encoded clip. */
export function wholePresentation(frames, kind, mode = 'correct') {
 if (!frames.length) throw new RangeError('Baked states required');
 const first = predicate => frames.findIndex(predicate);
 const blocked = first(s => s.blocked);
 const last = frames.length - 1;
 const endFrame = mode === 'wrong' && blocked >= 0 ? Math.min(last, blocked + 36) : last;
 const chapters = [];
 function add(frame, label) {
  if (frame < 0 || frame > endFrame) return;
  if (!chapters.some(c => c.frame === frame)) chapters.push({frame, label});
 }
 add(0, 'Locked');
 if (kind === 'combination') {
  // The first pose of each wheel's final plateau is its parking point.
  for (const [wheel,label] of [[2,'Far wheel parked'],[1,'Middle wheel parked'],[0,'Near wheel parked']]) {
   const finalAngle = frames[last].wheelAngles[wheel];
   const lastMoving = frames.findLastIndex(s => Math.abs(s.wheelAngles[wheel] - finalAngle) > 1e-8);
   if (lastMoving >= 0) add(lastMoving + 1, label);
  }
 } else {
  const seated = first(s => s.insert === 1);
  const aligned = seated >= 0 && frames[seated].ready;
  add(seated, seated === blocked ? 'Key seated · blocked' : aligned ? 'Key seated · aligned' : 'Key seated');
 }
 if (mode === 'wrong') {
  add(blocked, kind === 'combination' ? 'Fence blocked' : 'Blocked');
  add(endFrame, 'Hold blocked');
 } else {
  if (kind === 'combination') {
   add(first(s => s.engagement > 0), 'Fence enters gates');
   add(first(s => s.engagement === 1), 'Fence seated');
  } else {
   add(first(s => s.ready && (kind !== 'disc' || s.set === 1)),
       kind === 'warded' ? 'Wards cleared' : kind === 'disc' ? 'Gates aligned' : 'Aligned');
  }
  add(first(s => s.motion > 0), frames[0].style === 'cam' ? 'Turn rear cam' : 'Retract bolt');
  add(first(s => s.outputClear), 'Keeper clear');
  add(first(s => s.doorAngle > 0), 'Open door');
  add(first(s => s.doorAngle > 0 && s.doorAngle === frames[last].doorAngle), 'Hold open');
 }
 chapters.sort((a,b) => a.frame - b.frame);
 function message(s) {
  if (kind === 'warded' && s.ready && s.motion === 0) {
   return {title:'The bit has cleared the wards', text:'The key has reached the bolt talon. The bolt still holds the door shut until the key turns farther.'};
  }
  if (kind === 'combination' && s.engagement === 1 && s.motion === 0) {
   return {title:'The fence is seated', text:'The fence rests in the three wheel gates and the lever nose sits in the cam pocket. The bolt is still extended.'};
  }
  return {title:s.wholeStage, text:s.wholeExplanation};
 }
 return {chapters, endFrame, message};
}
export const wholeInfo={
 pin:{turns:'Key, plug, key pins and rear cam',slides:'Pin stacks during insertion; the drivers stay in the housing during turning',scope:'A generic pin-tumbler cabinet cam lock. The cutaway shows the pin chambers and direct rear output. Five unequal key pins follow a finite-width blade contact; the matching joins free the plug. Clearances and contact profiles are illustrative, not manufacturing dimensions.'},
 wafer:{turns:'Key, plug, wafers, their springs and rear cam',slides:'Wafers within the plug during insertion',scope:'A generic single-bitted wafer cabinet cam lock. The plate windows and blade cuts vary; springs sit in the plug and turn with it. Housing grooves catch protruding wafers. The removed housing and door section expose the movement.'},
 disc:{turns:'Key, individual discs, then the released carrier and rear cam',slides:'Sidebar inward into the aligned gates',scope:'A generic delayed-pickup disc cabinet cam lock. Angular key sections contact semicircular apertures; aligned peripheral gates admit the sidebar. The front drive disc turns with the key. Its lug meets the carrier shoulder at the end of the setting turn. Three discs and exaggerated clearances make the sequence visible. Sidebar movement is prescribed after geometric alignment; its detailed spring/chamfer actuation is omitted.'},
 warded:{turns:'Slotted pipe key around a fixed supporting pin',slides:'Connected bolt head, tail and drive talon',scope:'A simplified fixed-ward cupboard bolt lock. Three different fixed wards are cleared by matching slots in the key. Its uncut end directly pushes the bolt talon. The historic back-spring detent is omitted; this is an opening study, not a complete retained/relocking mechanism.'},
 combination:{turns:'Dial, drive cam and sequentially picked-up wheels',slides:'Fence enters aligned gates; connected lever retracts the bolt',scope:'A generic three-wheel direct-pull combination cabinet lock. The small lock bolt secures the keeper directly; this installation has no separate safe handle or multi-bolt mechanism. The wheel pickup, fence, lever and cam drive are exposed. Dimensions and contact profiles are illustrative.'}
};
