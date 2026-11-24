import {glossaries} from './glossary.mjs';

function modelParts(family,keys){
  return Object.fromEntries(Object.entries(keys).map(([mesh,key])=>[mesh,glossaries[family][key]]));
}
// The six anatomy models each hold one pose while the viewer moves around them.
export const parts = {
  pin: {
    camera:[-.8,1.5,12],
    look: 'Follow the row of pins above the key. Each cut supports a different length of key pin.',
    items: modelParts('pin', {driver:'driver', lower:'lower', spring:'spring', plug:'plug', shell:'shell', key:'key', cam:'cam'})
  },
  wafer: {
    look: 'The key passes through a window in each of the five wafers.',
    items: modelParts('wafer', {key:'key', spring:'waferSpring', wafer:'wafers', housing:'housing', plug:'plug', cam:'cam'})
  },
  lever: {
    look: 'Look at the long slots in the blue plates. A small post on the bolt needs a clear path through all three.',
    camera:[-7,2.3,3.9],
    items: modelParts('lever', {key:'key',keyway:'keyway',leaf:'leaf',levers:'lever', stump:'stump', bolt:'bolt', pivot:'pivot', case:'case'})
  },
  disc: {
    look: 'Look across the top of the blue discs. Each disc has a notch that can receive the sidebar.',
    items: modelParts('disc', {key:'key', discs:'discs', frontDrive:'frontDrive', carrierShoulder:'carrierShoulder', bar:'sidebar', carrier:'carrier', housing:'housing', cam:'cam'})
  },
  warded: {
    camera:[-5,-5,10],
    look: 'Follow the red key into the case. The cuts in its wide end leave room for the fixed wards.',
    items: modelParts('warded', {wards:'wards', key:'wardKey', guide:'guide', bolt:'bolt', case:'case'})
  },
  combination: {
    camera:[6,10,10],
    look: 'Find the notches along the rims of the blue wheels. The fence spans all three wheels.',
    items: modelParts('combination', {wheels:'wheels', fence:'fence', dial:'dial', driveCam:'driveCam', bolt:'bolt', case:'case'})
  }
};
