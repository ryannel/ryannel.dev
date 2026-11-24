export function sharedSpool(selection) {
  return selection.lesson === 'security' && (selection.pin || 'spool') === 'spool' && selection.study !== 'isolated';
}

// Zero-based cues for the two views in the shared-spool film.
export const spoolChapters = [
  [0,'Start at pin 1','The two pins nearest the keyhole have straight drivers. Pin 3 has a spool driver.'],
  [32,'Check pin 1','Pin 1 lifts easily and springs back down. The pick moves on to pin 2.'],
  [92,'Pin 2 binds','Pin 2 resists. The pick stays under it and lifts.'],
  [138,'Pin 2 sets','The middle driver clears. Its key pin drops back down as the hook lowers.'],
  [176,'Pin 1 binds','Back at the front, pin 1 now resists. The picker lifts it.'],
  [216,'Pin 1 sets','As pin 1 clears, the core turns into the narrow waist of the spool at the back.'],
  [223,'False set','The turn stops against pin 3. Its wide base still blocks the core.'],
  [258,'Check pin 2','Only the middle key pin moves. Its driver is still set.'],
  [310,'Pin 3 binds','The hook reaches the spool. The core is already caught on its waist.'],
  [335,'Counter-rotation','The rising shoulder pushes the core back. The picker feels the turning tool push back too.'],
  [365,'Pin 1 drops','The front chamber moves back under its driver. The spring pushes pin 1 down. Pin 2 stays set.'],
  [397,'Pin 3 sets','The wide base clears and the core turns just far enough to catch it. Pin 1 is still blocking the lock.'],
  [420,'Pin 3 stays set','The rear key pin has dropped away. Its driver stays up as the hook returns to the front.'],
  [454,'Pin 1 binds again','Pin 1 resists. The picker lifts it again while pins 2 and 3 stay set.'],
  [495,'All three pins set','Pin 1 clears. All three drivers are now above the shear line.'],
  [550,'Opening turn','The hook is out. The turning tool rotates the core.'],
  [578,'Core unlocked','The core is unlocked.']
];

export function spoolEvents() {
  return spoolChapters.map(([frame,title,text])=>({frame,title,text}));
}

export const spoolParts = [
  ['Rear spool','Two wide ends and a narrow waist replace the ordinary rear driver. In the false set, the waist bears against the steel and brass lips. Its lower flange is still inside the plug.'],
  ['Front and middle plain drivers','These drivers have the same shape. Their chamber positions give them different amounts of support as the shared plug turns back.'],
  ['Ivory key pins and silver springs','Each lower pin supports its own driver until their faces separate. Each spring presses only on the driver beneath it.'],
  ['One hook and one turning tool','The coral-handled hook supplies lift. The flat silver tool moves with the plug. The two indicators describe their inputs qualitatively.']
];

export function spoolStatus(s) {
  if (s.unlocked) return 'Core unlocked';
  if (s.setCount===3) return 'All three drivers retained';
  if (s.pins[2].set && s.frontLost) return 'Rear spool retained · front driver blocking';
  if (s.frontLost) return 'Front support lost · middle driver retained';
  if (s.falseSet) return 'False set · rear spool blocking';
  return s.setCount + ' of 3 drivers retained';
}
