import {chapterSequence} from './binding.mjs';
import {pinSecurityChapter} from './security-pin-lesson.mjs';
import {familyGuides} from "./family-lessons.mjs?v=camera-review-1";
import {sequenceFilm} from './security-films.mjs';
import {spoolChapters} from '../spool-study.mjs?v=spool-search';
import {openingAsset} from '../whole-presentation.mjs';

// Cue positions are zero-based frames in the existing 24 fps films.
const film=(title,lead,asset,cues,stop,label,mediaRevision)=>({title,lead,asset,cues,stop,label,mediaRevision});
const opening=(id,title,lead,cues,stop,label)=>film(title,lead,openingAsset(id,'correct'),cues,stop,label);
const mismatch=(id,title,lead,cues,stop,label)=>({...film(title,lead,openingAsset(id,'wrong'),cues,stop,label),clip:'explorer/clips/'+id+'-wrong.mp4'});
const families={
 pin:{
  name:'Pin tumbler',hint:'The hills and valleys of a key lift five pairs of pins.',
  chapters:[
   {...opening('pin','How a key turns the lock','Watch the edge of the key slide under the pins. Each cut lifts its pin a different distance.',[
    [0,'The blue upper pins are driver pins. Each one reaches into the silver cylinder, called the plug, and holds it still.'],
    [53,'The pale pins resting on the key are key pins. All five now meet their driver pins at the boundary between plug and shell, called the shear line.'],
    [68,'The key pins turn with the plug. The driver pins stay in the shell.'],
    [127,'The arm at the back, called the cam, has swung clear of the frame. The door can open.']],53,'See where the pins meet'),
    sectionNote:'A ledge in the plug holds each rounded key pin above the floor. The blade fits between the edges of the ledge. As its tip slides in, it lifts the pin off its rest.',
    sectionImage:'explorer/sections/pin-seat.png',sectionImageMobile:'explorer/sections/pin-seat-stacked.png',
    sectionAlt:'End view through the first chamber. With the key out, the pin rests on the ledge. With the key in, the pin rests on the blade. The near half of the plug is cut away.'},
   mismatch('pin','Why a similar key gets stuck','This key goes all the way in. Watch the middle pair of pins as the key comes to a stop.',[
    [0,'The key fits the opening and slides under all five pins.'],
    [53,'The middle cut is too low. The blue driver pin still crosses the shear line, holding the plug against the shell. The arm at the back stays put.']],65,'Find the pin that still blocks the turn'),
   film('Picking a pin tumbler lock',`The picker holds turning pressure on the plug and starts at pin 1, the pin nearest the keyhole. If a pin feels springy, the hook moves one pin farther in. As soon as a pin resists, the picker stays on it and lifts until its driver clears the shear line. If the picker lifts too far, the key pin takes the driver’s place across that line and blocks the core. That’s an overset.

Watch the first pass. Pin 1 springs back down. Pin 2 feels stiff because the plug is pressing against its driver. When that driver clears, the plug turns a little and holds it up. The picker starts the next search at pin 1 again.`, 'output/three-pin/probe',[
    [0,'The first pass starts at pin 1, at the front.'],
    [32,'Pin 1 lifts easily against its spring.'],
    [52,'Both parts of pin 1 come back down with the hook. The picker moves on to pin 2.'],
    [92,'Pin 2 resists. The hook stays beneath it and lifts the binding driver.'],
    [138,'The middle driver clears the shear line. The plug turns and catches it.'],
    [147,'The lower key pin drops away. The blue driver stays up.'],
    [158,'The second pass starts back at pin 1.'],
    [176,'Pin 1 now binds. The picker feels the resistance and sets it here.'],
    [216,'The front driver clears. Both front and middle drivers are now set.'],
    [231,'The third pass starts at pin 1. Its key pin moves freely in the gap under the driver.'],
    [281,'Pin 2 also has free play. Its key pin moves while its driver stays up.'],
    [332,'Pin 3 resists. The hook lifts it until the last driver clears.'],
    [372,'All three drivers are set. The hook can come out.'],
    [424,'The turning tool rotates the unlocked plug.']],95,'Pause on the first binding pin','immediate-set'),
   pinSecurityChapter({...film('Security pins',`Security pins are shaped to make picking harder by creating false feedback like clicks and core movement designed to confuse and hamper anyone trying to pick the lock.

Sometimes the core turns farther than it would when an ordinary pin sets, then catches on a pin that still blocks the lock. Pickers call that a false set. Lifting the pin farther can push the core back against the turning tool. That backward turn is called counter-rotation.

Security pins come in countless shapes and sizes. Here are a few of the more common designs found in commercial locks.`, 'output/three-pin-spool/spool',
    spoolChapters.map(([frame,,text])=>[frame,text]),223,'Pause on the false set','spool-search'),replayFrom:326}),
   {...sequenceFilm('mixed'),featureId:'pin-mixed',title:'Picking a lock with mixed pins',slug:'mixed-pins',topic:'Mixed pins',
    lead:'All six chambers have security pins. Pin 2 pairs a serrated driver with a notched key pin, pin 4 has a serrated spool, and pin 6 has a mushroom driver. Each time the picker feels the turning tool push back, they check which pins have dropped. Pin 5 drops twice before the core can turn.'}
  ]},
 ...familyGuides
};

export const guides=Object.fromEntries(Object.entries(families).map(([id,guide])=>[id,chapterSequence(id,guide)]));
