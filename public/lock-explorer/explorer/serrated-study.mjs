// Both cutaways and the feedback dial use the same zero-based Blender frames.
export const serratedAsset='output/serrated-recovery/three-stack-serrated';
const sequence=[
  [0,'Start at pin 1','No lift yet','The serrated driver is in the middle. The pick starts at pin 1.'],
  [8,'Pin 1 binds','Pin 1 resists','Pin 1 resists, so the picker lifts it.'],
  [27,'Pin 1 sets','Resistance eases','Pin 1 clears. As the pick moves on, its driver stays up.',true],
  [62,'Pin 2 binds','Pin 2 resists','The pick reaches pin 2. Watch the grooves in the close-up.'],
  [68,'First groove','Groove catches','The core catches in the first groove. Part of the blue driver is still below the shear line.',true],
  [88,'Second groove','Groove catches','Another groove gives another possible click.',true],
  [104,'Third groove','Groove catches','The third groove catches. The bottom of the driver still has a little way to go.',true],
  [126,'Driver clears','Resistance eases','This time the driver clears. Pin 3 still blocks the core.',true],
  [154,'Pin 2 overset','Key pin caught','The picker lifts past the set. The pale key pin now crosses the shear line.'],
  [179,'Overset with pick lowered','Pick lowered','The hook has lowered, but the key pin is still caught against the shell.'],
  [193,'Ease the tension','Pick lowered','The picker eases the turning pressure and the key pin starts to come free.'],
  [202,'Pin 2 drops','Pick lowered','Pin 2 has dropped. Pin 1 is still set.'],
  [214,'Pin 1 drops too','Pick lowered','Here the core comes back far enough for pin 1’s spring to push its driver down too.'],
  [244,'Pin 1 binds again','Pin 1 resists','Back at the front, pin 1 binds again.'],
  [263,'Pin 1 set again','Resistance eases','The picker sets pin 1 again and returns to the serrated driver.',true],
  [296,'First groove again','Groove catches','Pin 2 gives the same series of clicks on the second lift.',true],
  [316,'Second groove again','Groove catches','The second groove catches.',true],
  [332,'Third groove again','Groove catches','The third groove catches. The driver still blocks the core.',true],
  [354,'Pin 2 sets','Resistance eases','This time the picker stops lifting as the serrated driver clears.',true],
  [369,'Correct set with pick lowered','Pick lowered','The pale key pin drops away. The gap shows that the blue driver stayed set.'],
  [388,'Back to the front','Hook at pin 1','The last search starts at the front.'],
  [404,'Test pin 1','Free play','The lower pin lifts and drops beneath the driver that is already set.'],
  [451,'Test pin 2','Free play','The serrated driver stays up as the hook tests the lower pin.'],
  [477,'Pin 3 binds','Pin 3 resists','Only pin 3 is still blocking the turn.'],
  [498,'Pin 3 sets','Resistance eases','Pin 3 clears. All three drivers are set.',true],
  [523,'Pick withdrawn','Pick withdrawn','The hook is out and the turning tool turns the core.'],
  [549,'Core unlocked','Pick withdrawn','The lock is open.']
];
export const serratedFeedback=sequence.map(([frame,name,feel,,click])=>[frame,feel,Boolean(click),name]);
export const serratedFilm={
  asset:serratedAsset,mediaRevision:'recovery-search-1',stop:179,label:'Pause on the overset',replayFrom:126,
  replayLabel:'Replay the overset and recovery',cues:sequence.map(([frame,,,caption])=>[frame,caption])
};
