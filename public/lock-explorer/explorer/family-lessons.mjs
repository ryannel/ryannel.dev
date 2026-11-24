import {openingAsset} from '../whole-presentation.mjs';

const patents={
  wafer:['US7225651B2','Master Lock’s wafer and sidebar drawings'],
  lever:['US3402581A','True and false gates in the lever drawing'],
  disc:['US3789638A','True and false gates around a disc'],
  combination:['US3045466A','Diebold’s spring-operated fence']
};
const sectionNotes={
  wafer:['Three of the five wafer slots are occupied. The close-up cuts through the middle wafer and its groove in the housing.',
    'The close-up looks from the back at the last wafer. The other two wafers and their teeth are cut away in this view. The model uses a single sliding bar to show the height check.'],
  lever:['Both views use the mortice case from the key chapter. In the close-up the nearer plates are cut away to expose the lever on the wire.',
    'The front lever has a shallow notch above its gate. The camera and the keyhole stay in the same positions as in the picking chapter.'],
  disc:['This example takes tension at the front. The close-up starts at the drive disc, then looks back at the sidebar above the rear disc. The front drive disc is separate from the three discs with gates. The slot, lug and clearances are enlarged.',
    'The front disc has both a shallow gate and a deep gate. The other two discs each have one deep gate. This cutaway shows the turning load directly at the carrier shoulder.'],
  warded:['The close-up looks down through the ward rings at the key bit and bolt talon.',
    'The close-up cuts through the ward rings so you can see where the bit catches.'],
  combination:['Each comparison starts with the wheels already in position. The differences between the wheel rims are enlarged so you can see the fence change height. In the close-up, part of the lever is cut away to show where its nose touches the cam.',
    'The trigger sits outside the cutaway. The moving end of the spring shows when the trigger lets the fence drop.']
};

function lesson(family,kind,title,lead,steps,stop,label){
  const opening=kind==='correct'||kind==='wrong';
  const asset=opening?openingAsset(family,kind):
    (family==='lever'&&['manual','security'].includes(kind)?'output/lever-case/':'output/family-sections/')+family+'-'+kind;
  const source=kind==='security'&&(family==='warded'?
    ['https://pegsandtails.wordpress.com/2012/02/19/back-spring-locks/','A dismantled warded cupboard lock']:
    ['https://patents.google.com/patent/'+patents[family][0]+'/en',patents[family][1]]);
  return {title,lead,asset,study:family+'-'+kind,clip:kind==='wrong'?'explorer/clips/'+family+'-wrong.mp4':undefined,
    captions:'output/family-sections/'+family+'-'+kind+'.vtt', steps,
    cues:steps.map(([frame,,text])=>[frame,text]),stop,label,source,
    sectionNote:opening?null:sectionNotes[family][Number(kind==='security')],
    inspect:opening?null:family+'-'+kind,mediaRevision:family==='wafer'&&kind==='manual'?'wafer-marks-3':family==='wafer'?'wafer-search-1':'family-2'};
}

export const familyGuides={
  wafer:{
    name:'Wafer',hint:'The key slides through a row of spring-loaded plates.',
    chapters:[
      lesson('wafer','correct','How a wafer lock opens',
        'The key passes through a window in each blue plate. These plates are called wafers. Their windows sit at different heights, so each cut on the key lifts its wafer a different distance.',[
          [0,'At rest','The springs push the bottoms of the wafers into a groove in the housing.'],
          [53,'Key fully in','All five wafers now fit inside the plug. Look along their bottom edges.'],
          [68,'Plug turns','The wafers turn with the plug. The cam turns behind the door.'],
          [128,'Door opens','The cam has cleared the frame. The door can swing open.']
        ],53,'Look along the wafer edges'),
      lesson('wafer','wrong','A low cut leaves one wafer in the groove',
        'This key fits the same windows, but one cut is too low. Follow the middle wafer as the key goes in.',[
          [0,'Key enters','Each spring holds its wafer against the edge of the key.'],
          [53,'Middle wafer catches','The middle wafer still reaches into the housing groove. That one plate holds the plug and cam still.']
        ],61,'See the wafer in the groove'),
      {...lesson('wafer','manual','Picking a wafer lock',
        'In this single-sided wafer lock, one hand keeps light turning pressure on the plug with a turning tool at the mouth of the keyway. The other hand moves a hook through the windows in the wafers. The tip lifts the upper edge of one window at a time.\n\nA loose wafer lifts against its spring and follows the hook back down. A binding wafer feels stiffer because its tip is pressing against the side of the housing groove. When it clears the groove, the picker feels the plug turn a little. The groove is now out of line, so the housing holds that wafer up while the hook moves on.',[
          [0,'Start at the front','The flat tool turns the plug at the entrance. The hook reaches through the front wafer’s window.'],
          [24,'Front wafer lifts freely','Watch the front spring. It compresses as the hook lifts the wafer.'],
          [40,'Front wafer springs back','The hook lowers and the wafer comes back down. Try the middle wafer next.'],
          [63,'Middle wafer binds','The hook passes through the front window and lifts the upper edge of the middle one. This wafer resists.'],
          [80,'Middle wafer clears','The two white marks shift as the plug turns. The housing now supports the middle wafer, so the hook can move away.'],
          [104,'Back to the front','The first wafer now binds. This time the hook lifts it clear.'],
          [143,'Front wafer clears','The plug turns a little farther as the front wafer clears. Two wafers now stay up.'],
          [195,'Middle wafer still clear','The hook returns to the middle window. The middle wafer is still up.'],
          [251,'Rear wafer clears','The last wafer clears. Watch the small advance just before the plug turns to open.'],
          [313,'Plug turns','All three wafers turn with the plug as the hook withdraws.']
        ],80,'Pause on the first set'),source:['https://covertinstruments.com/blogs/dead-drops/how-to-pick-a-wafer-lock','Single-wafer picking and raking']},
      {...lesson('wafer','security','A sidebar checks the wafer heights',
        'A sidebar adds a second check on the height of each wafer. Lifting a wafer clear of the housing can still leave the notch in its side too high or too low for the bar.\n\nThe picker can feel the plug turn a little and stop even after the wafers have cleared the housing. Each notch has to line up with the sidebar. Only then can the bar slide out of the housing and let the plug turn.',[
          [0,'Start at the front','The hook tests the front wafer while the turning tool loads the plug.'],
          [24,'First wafer lifts','The spring compresses. When the hook lowers, the wafer returns with it.'],
          [63,'Middle wafer binds','The middle wafer resists. The hook lifts it clear before moving on.'],
          [80,'Middle wafer stays up','Watch the middle wafer as the hook lowers and returns to the front.'],
          [136,'Front wafer clears','The first wafer now stays up too.'],
          [179,'Middle wafer still clear','The hook checks the middle window on its way to the rear wafer.'],
          [224,'The plug stops','All three tips are clear. The rear notch still sits below the copper sidebar tooth.'],
          [260,'Rear notch rises','The hook lifts the rear wafer farther. Its sloping notch lets the tooth move inward.'],
          [275,'Sidebar seats','The bar slides clear of the brass housing.'],
          [326,'Plug turns','The turning tool carries all three wafers and the sidebar around together.']
        ],242,'Pause where the plug stops'),
        replayFrom:210,replayLabel:'Replay the sidebar catch',mediaRevision:'wafer-search-1',
        
        heading:'Wafer lock security',
        introduction:'In a basic wafer lock, the plug can turn once every wafer clears the housing. These two designs add a sidebar. One checks the wafer heights. The other grips the wafers under turning pressure.'}
    ]},
  lever:{
    name:'Lever',hint:'Slots in a stack of levers make a passage for the bolt.',
    chapters:[
      lesson('lever','correct','How a lever lock opens',
        'The key does two jobs as it turns. Its stepped bit lifts the levers, then pushes the bolt. The small post on the bolt is called the stump. Each lever has a slot, called a gate, that the stump must pass through.',[
          [0,'Bolt extended','The bolt reaches into the frame. The levers sit across the path of its stump.'],
          [139,'Gates aligned','Each step on the key holds a lever at the height its gate needs.'],
          [173,'Bolt moving','The key now draws the bolt back. The stump travels through the aligned gates.'],
          [259,'Door opens','The bolt has cleared the frame, and the door swings open.']
        ],145,'See the passage through the levers'),
      lesson('lever','wrong','The wrong key leaves one gate out of line',
        'A wrong key can lift every lever and still leave one gate out of line. The bolt may even start to move before its stump catches.',[
          [0,'Key enters','The key fits into the lock and can turn under the levers.'],
          [144,'Third gate out of line','The third lever leaves solid metal in the path of the stump.'],
          [176,'Stump stops','The stump has met that lever. The bolt head is still in the frame.']
        ],180,'See where the stump stops'),
      lesson('lever','manual','Picking a lever lock',
        'The copper tool presses on the bolt. That brings the stump against one of the levers. The picker feels for that lever with the bent end of the silver wire. A loose lever lifts against its spring and follows the wire back down. The lever bearing against the stump takes more pressure to lift.\n\nAs its gate reaches the stump, the bolt moves a little. The stump now sits inside the gate and keeps the lever from falling back while the wire moves on. Once all three gates line up the bolt can slide through the stack.',[
          [0,'Bolt under pressure','Both tools enter the same keyhole. The copper flag pushes on the bolt tail.'],
          [20,'Front lever lifts','The wire lifts the front lever. Its spring brings it back down as the wire lowers.'],
          [46,'Middle lever lifts','The middle lever moves too. The bolt has stayed in the same place through both lifts.'],
          [68,'Rear lever binds','The wire reaches the rear lever. Its edge is the one bearing on the stump.'],
          [112,'Rear gate catches the stump','The stump enters the rear gate. The wire lowers and the gate stays at the stump.'],
          [149,'Middle gate aligned','The middle gate now admits the stump. The front lever still holds the bolt.'],
          [202,'Front gate aligned','The three gates form a passage through the stack.'],
          [260,'Bolt withdrawn','The pressure tool draws the bolt inside the faceplate.']
        ],112,'Pause as the stump enters the rear gate'),
      lesson('lever','security','False gates in a lever',
        'A false gate is a shallow notch in a lever. Under pressure the stump can enter it and the picker feels the bolt move. The floor of the notch stops the bolt while its head is still in the frame.\n\nEasing pressure lets the stump back out and frees the lever for another lift. In this lock it backs out far enough to free the front lever while still reaching into the other two gates. The next lift brings the true gate to the stump and the bolt can withdraw.',[
          [0,'Search the stack','The wire tests the front and middle levers. Their springs push them back down.'],
          [68,'Rear lever binds','The stump bears on the rear lever first.'],
          [112,'Rear gate aligned','The stump moves into the rear gate and the wire moves on.'],
          [149,'Front lever holds','The middle gate is clear. The front lever still blocks the bolt.'],
          [178,'False gate','The stump enters the short notch. The notch ends before the bolt can withdraw.'],
          [198,'Stump backs out','The pressure tool lets the bolt move forward a little. The stump clears the shallow notch.'],
          [237,'True gate','The front lever rises until the long gate reaches the stump.'],
          [260,'Bolt withdrawn','The pressure tool carries the stump through the three gates.']
        ],178,'Pause in the false gate')
    ]},
  disc:{
    name:'Disc detainer',hint:'The key turns a stack of discs to line up their gates.',
    chapters:[
      lesson('disc','correct','How a disc detainer opens',
        'Each blue disc has a notch in its rim, called a gate. The bar across the rims is the sidebar. As the key turns, its angled cuts pick up the discs at different points in the turn.',[
          [0,'Key enters','The blade passes through the openings in all three discs.'],
          [62,'Discs turning','One cut has picked up its disc. The other cuts reach theirs later in the turn.'],
          [125,'Gates aligned','The gates form a channel along the stack. The sidebar moves into it and clears the housing.'],
          [148,'Carrier turns','The lug on the front drive disc meets the carrier shoulder. Turning the key now turns the carrier and its rear cam.'],
          [202,'Door opens','The cam has swung clear of the frame.']
        ],131,'See the sidebar in the gates'),
      lesson('disc','wrong','One disc holds the sidebar out',
        'The cuts on this key turn one disc through the wrong angle. Its gate ends up beside the sidebar, leaving a solid piece of rim directly underneath the bar.',[
          [0,'Key enters','The key fits the openings and starts to turn the discs.'],
          [120,'Gate missed','One rim still supports the sidebar. The bar reaches into the housing and the carrier stays locked.']
        ],134,'Find the rim supporting the bar'),
      lesson('disc','manual','Picking a disc detainer',
        'In this lock, the picker applies tension through the front drive disc. The copper outer tool turns the disc until its lug meets a stop on the carrier. Holding that turn presses the sidebar between the housing and the rim of the rear disc.\n\nThe silver pick slides through the hollow tensioner. The front and middle discs turn freely, but the rear disc is harder to turn because the sidebar presses against it. As its gate comes into line, the sidebar settles against the next rim. Once all three gates line up, the sidebar clears the housing and the carrier can turn.',[
          [0,'Outer tensioner enters','The copper tooth fits into the blue drive disc.'],
          [34,'Front disc turns','Only the front drive disc turns.'],
          [63,'Lug meets the stop','The lug now pushes against the carrier stop.'],
          [90,'Sidebar under load','The brass housing presses the sidebar against the rear disc.'],
          [120,'Inner pick tests the first disc','The silver tip starts its turn.'],
          [133,'Front disc moves','The inner pick turns the first gated disc easily.'],
          [157,'Middle disc moves','The middle disc also turns easily.'],
          [174,'Rear disc binds','The tip reaches the rear disc, which carries the load from the sidebar.'],
          [220,'Rear gate aligned','The rear gate gives the sidebar room to move. The middle rim now supports it.'],
          [257,'Middle gate aligned','The front rim still holds the sidebar in the housing.'],
          [310,'Sidebar seats','The last gate lines up. The sidebar clears the housing.'],
          [395,'Carrier turns','The seated sidebar and all three discs turn with the carrier.']
        ],90,'Pause on the loaded sidebar'),
      lesson('disc','security','False gates in a disc',
        'A false gate catches the sidebar before a disc reaches its true gate. The picker feels the load change as the bar enters the notch. A shallow notch gives the bar some room, but its outer edge still catches on the housing.\n\nEasing the turn lets the bar leave the shallow notch. The tip can then turn the disc farther. In this stack the other two gates are already in place. When the front disc reaches its deep gate the bar moves clear and the whole carrier turns.',[
          [0,'Search the discs','The turning tip tests the front and middle discs before it reaches the loaded rear rim.'],
          [112,'Rear gate aligned','The rear gate clears. The sidebar now rests on the middle rim.'],
          [149,'Front rim holds','The rear and middle gates are ready. The front rim alone holds the bar out.'],
          [178,'False gate','The sidebar enters the shallow notch. Its outer edge still reaches between the brass walls.'],
          [198,'Bar clears the notch','Pressure eases. The sidebar has room to move out while the front disc turns.'],
          [237,'True gate','The deep front gate lets the sidebar drop clear of the housing.'],
          [287,'Carrier turns','The seated bar and all three discs turn together.']
        ],178,'Pause with the sidebar in the false gate')
    ]},
  warded:{
    name:'Warded',hint:'Fixed barriers leave the key a path to the bolt.',
    chapters:[
      lesson('warded','correct','How a warded lock opens',
        'The fixed rings around the key are called wards. They stay fixed while the key turns. The part that sticks out from the key shaft is its bit. Slots in the bit leave room for the wards as the key turns.',[
          [0,'Key enters','The hollow key slides over a guide pin that keeps it centred.'],
          [120,'Bit past the wards','Each slot has left room for a ward. The far end of the bit can now reach the bolt.'],
          [145,'Talon driven','The bit pushes a projection on the bolt called the talon. The bolt slides back.'],
          [202,'Door opens','The bolt has cleared the frame. The door can swing open.']
        ],120,'See the bit beyond the wards'),
      lesson('warded','wrong','A shallow key slot catches on a ward',
        'This key fits over the guide pin, but one slot is too shallow. The key stops turning as soon as that part of its bit meets a ward.',[
          [0,'Key enters','The hollow shaft fits the guide pin just as the matching key did.'],
          [58,'Bit meets ward','The bit has struck a fixed barrier before it reaches the talon. The bolt stays extended.']
        ],67,'Pause at the first obstruction'),
      lesson('warded','manual','Bypassing the wards',
        'The wards stay still. A skeleton key leaves out much of the metal between the shaft and the working tip, so it can turn inside the rings. The tip beyond the rings still has a job to do. Once it meets the talon, turning the key slides the bolt out of the keeper.',[
          [0,'Working tip','The narrow bit has a projecting tip at its far end. The close-up looks back at the bolt talon.'],
          [39,'Key seated','The tip is now beyond the wards. Only the narrow connecting strip has to turn between them.'],
          [99,'Tip approaches the talon','The connecting strip clears the wards. The working tip has reached the face of the talon.'],
          [158,'Bolt moving','The rounded tip is pressing the talon and drawing the bolt out of its keeper.'],
          [185,'Keeper clear','The bolt head is out of its keeper. The wards have stayed still throughout.']
        ],158,'See the tip drive the bolt'),
      lesson('warded','security','Wards at different depths',
        'A slot in a key only clears a ward at the same depth. Here the bit passes the front ward, then stops against the rear one. The person turning the key feels a hard stop before the bolt moves.\n\nA skeleton key leaves out the metal that caught. Its narrow strip turns inside the rings while the tip beyond them still reaches the talon. The tip pushes the bolt clear of the keeper.',[
          [0,'Fixed wards','The rings sit at different depths along the key.'],
          [53,'Rear ward catches','The front slot clears its ward. The rear slot is too shallow and the bolt stays still.'],
          [115,'Blocked bit withdrawn','The fuller bit comes out. The wards stay fixed to the case.'],
          [147,'Skeleton key clears the wards','The narrow strip passes inside the rings. Its working tip turns beyond them.'],
          [196,'Bolt withdrawn','The tip pushes the talon on the bolt until the bolt head clears the keeper.']
        ],53,'Pause where the rear ward catches')
    ]},
  combination:{
    name:'Combination',hint:'One dial lines up three wheels so the bolt can slide back.',
    chapters:[
      lesson('combination','correct','How the combination opens the lock',
        'Behind the dial are three blue wheels. Turning the dial turns the silver disc in front of them, called the drive cam. A pin on the cam catches the nearest wheel. As that wheel turns, it catches the middle wheel, which then catches the far one. When the dial changes direction, the pin has to come round again before it catches. The two wheels closer to the dial can then turn while the far wheel stays at the first number.\n\nEach wheel has a notch in its rim called a gate. Once all three gates line up, a bar called the fence drops into them. The fence is part of a lever. As it drops, the tip of the lever fits into a pocket in the cam. Turning the dial now pulls the lever and bolt back together.',[
          [0,'Dial turns','The silver drive cam turns with the dial.'],
          [19,'Near wheel starts turning','The pin on the cam catches the copper lug on the near wheel and pushes it round.'],
          [87,'First number','The far wheel stays at the first number as the dial turns back.'],
          [161,'Second number','The middle wheel stops at the second number. The near wheel can still turn.'],
          [221,'Third number','The last wheel lines up. All three notches are under the fence.'],
          [254,'Cam turns','The wheels stay still as the pocket in the cam comes round to the tip of the lever.'],
          [288,'Fence drops','The fence drops into the wheel gates. The tip of the lever, called the nose, fits into the cam pocket.'],
          [313,'Bolt slides back','The turning cam pulls the lever and bolt back together.'],
          [404,'Door opens','The bolt is clear of the frame and the door swings open.']
        ],288,'Pause as the fence drops'),
      lesson('combination','wrong','Why one wrong number keeps the lock shut',
        'The first two numbers are right. The notches in the far and middle wheels sit under the copper bar, called the fence. The wheel nearest the dial stops short. Its notch is off to one side. The fence rests on the solid rim of that one wheel.\n\nYou can still turn the dial. As the pocket in the cam comes round, the tip of the lever sits too high to catch in it. The bolt stays in the door frame.',[
          [0,'Dial turns','The dial turns the cam and the wheels begin to turn one after another.'],
          [225,'Near wheel stops short','The near wheel’s notch is beside the fence. Its rim is directly underneath.'],
          [288,'Bolt stays locked','One wheel holds up the fence. The lever sits too high for the cam to pull the bolt back.']
        ],291,'Pause on the wheel holding the fence up'),
      {...lesson('combination','manual','What you can feel through the dial',
        'The small brass tip in the close-up is the nose of the lever. As the grey cam turns, the edge of its pocket touches the nose. You can feel that touch as a little resistance at the dial. The dial reading where it happens is called a contact point.\n\nHere the near wheel holds up the fence. Lining up the far wheel makes no difference to the reading. When the near wheel’s gate comes round, the fence drops onto the middle wheel. The brass tip drops with it, so the cam meets it at a different dial position. That change gives the technician a clue that a gate has lined up, even though the bolt is still locked.',[
          [0,'Near wheel holds the fence up','The copper fence rests on the near blue wheel. The grey cam turns with the dial.'],
          [32,'First contact','The pocket edge touches the brass tip. This is the resistance felt at the dial.'],
          [94,'Far wheel’s gate lines up','The far gate lines up. The near rim still holds the fence at the same height, so the reading stays the same.'],
          [156,'Near wheel’s gate lines up','The fence drops onto the middle wheel. The brass tip sits lower and meets the cam at a different dial reading.'],
          [218,'Middle wheel holds the fence up','Moving the far wheel makes no difference while the fence rests on the middle wheel.'],
          [280,'Middle wheel’s gate lines up','The middle gate lines up. The far wheel is now the only one holding up the fence.'],
          [310,'All three gates line up','The fence drops into all three gates. The lever nose fits into the cam pocket.'],
          [372,'Bolt slides back','The turning cam pulls back the bolt.']
        ],156,'Pause where the reading changes'),
        comparisonFrames:[[94,'Near wheel holds the fence'],[156,'Fence drops onto the middle wheel']]},
      lesson('combination','security','Spring-held fence',
        'A spring holds the fence above the wheels. With a gap between them, a wheel can turn its gate under the fence without moving the lever. The technician loses the change in resistance they would usually feel at the dial.\n\nOnce per turn, a trigger lets the fence drop. If a wheel rim catches it, the spring lifts it clear again. With the right combination, all three gates are under the fence when it drops. The lever nose can then enter the cam pocket and the dial pulls back the bolt.',[
          [0,'Spring holds the fence up','The spring holds the fence just above the blue wheels.'],
          [36,'Fence touches a rim','The trigger lets the fence drop. A wheel rim stops it and the spring lifts it again.'],
          [79,'One gate lines up','A gate is under the fence, but there’s still a gap between the fence and the wheels.'],
          [115,'Another rim catches','The fence drops a little farther this time. Another wheel still holds it up.'],
          [154,'All three gates line up','All three gates are in position. The spring still holds the fence above them.'],
          [190,'Fence drops into the gates','The trigger releases the fence. This time the lever nose reaches the cam pocket.'],
          [216,'Bolt slides back','The cam pulls back the bolt.']
        ],36,'Pause when the fence touches a wheel')
    ]}
};

function variant(family,slug,name,lead,steps,stop,label,sectionNote,source){
  return {...lesson(family,slug,name,lead,steps,stop,label),slug,sectionNote,source};
}
export const familyChoices={
  wafer:['Sidebar notches',variant('wafer','clamp','A sidebar that grips the wafer',
    'Each wafer has a row of teeth along its side. Turning the plug pushes a small bar into those teeth and grips the wafer wherever it happens to be. A wafer at the wrong height feels just as solid as one that’s clear. Easing the turn frees them both.\n\nA jiggler has a wavy edge that moves several wafers together. The picker rocks the blade up and down and slides it a little as they feel for the plug to turn. Here the rear wafer catches. Easing the pressure frees the teeth and the wafers follow the blade again. When the blade holds both tips clear and the teeth can mesh, the plug turns with it.',[
      [0,'Jiggler enters','The wavy edge passes through the windows in both blue wafers.'],
      [43,'Rocking the blade','As the handle rocks, the far end of the blade rises and falls inside the rear wafer.'],
      [83,'Teeth grip','The copper teeth hold both wafers. The rear tip is still in the brass slot, so the turn stops.'],
      [105,'Wafers move again','The picker eases the turn. Small strokes of the blade lift the wafers and let their springs push them back down.'],
      [216,'Both tips clear','During this stroke the blade brings both wafer tips clear of the brass. The teeth line up on both bars.'],
      [228,'Plug turns','The teeth grip with both tips clear. The blade carries the plug past the point where it caught before.']
    ],83,'Pause where the teeth grip','Mercurio’s patent describes the toothed bars. Grim Workshop documents jiggler picking on ordinary wafer locks. This two-wafer cutaway tests that technique in a model. A physical pick of Mercurio’s cylinder remains unverified.',
    ['https://patents.google.com/patent/US4015458A/en','Mercurio’s toothed sidebar'])],
  lever:['False gates',variant('lever','detector','A detector that catches an overlift',
    'The silver wire lifts the front blue lever while the copper tool presses on the bolt. A normal lift leaves the detector alone. Lift the lever too far and it pushes up the copper arm above it. A hooked spring catches the arm. Even when the wire lowers, the arm stays caught and holds the bolt.\n\nThe owner can feel that something has changed. The right key goes in, but the bolt is stuck. Turning the key a little farther in the locking direction pushes the bolt forward. A bevel on the bolt moves the spring aside, freeing the detector. The key can then turn back and withdraw the bolt.',[
      [0,'Tools in the keyhole','Both tools pass through the keyhole below the levers. The bolt projects on the left.'],
      [28,'Normal lift','The silver wire lifts the front blue lever. There is still space under the copper detector bar.'],
      [88,'Detector trips','The lever has pushed the copper bar high enough for the hooked spring to catch it.'],
      [137,'Wire lowered','The wire and the front lever are back down. The hooked spring still holds the detector.'],
      [145,'Owner’s key','The owner’s key is now in the same keyhole. The detector is still caught.'],
      [193,'Bolt moves forward','The key turns in the locking direction. The bolt moves a short distance to the left and its bevel pushes the spring aside.'],
      [211,'Detector released','The detector drops clear of the bolt.'],
      [246,'Bolt withdrawn','The key turns back and pulls the bolt inside the faceplate.']
    ],137,'Pause with the detector caught','The case and keyhole are the ones used in the earlier lever chapters. This cutaway fits the Chubb detector principle into that case. The key lifts the three levers together. The gates and individual key cuts are omitted. The film cuts from the picking tools to the seated owner’s key for the regulating stroke.',
    ['https://chubbarchive.co.uk/page29','The Chubb Archive on detector locks'])],
  disc:['False gates',variant('disc','blocking','A bar that holds the discs in place',
    'The silver sidebar can only drop when all three gates line up beneath it. The pick turns the middle disc first. Its gate is now in place, but the front and rear rims still hold the sidebar up.\n\nThe copper bar underneath is the return bar. When it rises into the smaller notches, it holds all three discs where they are. The middle disc is in the right place and the other two are trapped in the wrong places. Once the return bar drops away, the pick can turn the front and rear discs. Only then can the sidebar drop.',[
      [0,'Three gates out of line','The close-up shows the middle disc. Its gate starts to the side of the silver sidebar.'],
      [27,'Pick reaches the middle','The tip reaches the middle disc through the opening in the front disc.'],
      [68,'Middle gate aligned','The pick has turned the middle gate under the sidebar. The other two rims still hold the bar up.'],
      [116,'Back at the front','The middle disc stays where the pick left it. The close-up now shows the copper return bar below the stack.'],
      [150,'Return bar rises','The ramp begins to lift the return bar towards the small notches.'],
      [198,'Return bar engages','All three discs are held together. Only the middle gate lines up.'],
      [285,'Return bar clears','The return bar drops clear and the discs can turn separately again.'],
      [313,'Front gate aligned','The pick turns the front gate into line. The rear rim still holds the sidebar up.'],
      [350,'Three gates aligned','The rear gate reaches the other two. The silver sidebar seats in all three.'],
      [374,'Discs held in alignment','The return bar engages again, this time with all three gates aligned.']
    ],198,'Pause with the discs blocked','The wide view keeps all three discs visible. The first close-up isolates the middle disc. The three-disc example uses one return bar and a straightened ramp to illustrate disc blocking. The order in which the gates are aligned is specific to this cutaway.',
    ['https://www.abloy.com/au/en/products/keying-platforms/abloy-protec','ABLOY on the PROTEC disc blocking system'])],
  warded:['Wards at different depths',variant('warded','keyhole','A ward at the keyhole',
    'A ward at the keyhole catches the bit as it goes in. The picker feels a hard stop at the face of the lock, before the bit can reach anything inside.\n\nA bit with a slot that clears the projection can pass through the keyhole. Its shape must also clear any wards farther inside and still reach the bolt.',[
      [0,'First key approaches','A fixed brass projection reaches into the opening.'],
      [36,'Bit catches at the face','The first bit reaches the entrance ward. It cannot slide any farther in.'],
      [82,'Key withdrawn','The faceplate and the ward stay in place as the key comes out.'],
      [110,'Slotted bit enters','A slot down the second bit leaves a path for the projection.'],
      [139,'Beyond the entrance','The bit is through the plate. A lock can still have more wards farther inside.'],
      [179,'Bit touches the talon','The slotted bit turns behind the ward until it reaches the projection on the bolt.'],
      [218,'Bolt moves','The bit pushes the talon and the steel bolt slides through its guides.']
    ],36,'See where the first bit stops','The wide view keeps the faceplate in place. The close-up shows the leading edge of the bit meeting the entrance ward.',
    ['https://www.gutenberg.org/ebooks/63128','A. C. Hobbs on warded locks and keyholes'])],
  combination:['Spring-held fence',variant('combination','roller','Contact rollers',
        'A small roller sits at the edge of the cam pocket, where the lever nose normally touches the cam. The roller sticks out farther on one side. When that side faces the nose, the two touch sooner and the technician feels resistance at a different number on the dial.\n\nIn the first two turns, the blue wheel stays still. The roller turns between contacts and the technician gets two different readings from the same wheel setting. That makes a change in the reading hard to trust. A gate may have lined up under the fence, or the roller may simply have turned.',[
      [0,'Roller at the pocket edge','The copper roller sits beside the cam pocket. The dot marks one side of the roller.'],
      [38,'First contact','The roller touches the lever nose. The technician feels the contact through the dial.'],
      [64,'Cam turns back','The cam turns back and the roller moves clear of the nose.'],
      [90,'Roller turns','A different side of the roller now faces the nose. The wheel hasn’t moved.'],
      [126,'Contact at a different number','This side of the roller reaches the nose sooner, with the wheel still in the same position.'],
      [192,'Wheel gate lines up','The fence drops into the wheel gate, lowering the nose.'],
      [230,'First side touches again','The same side of the roller now meets the nose at its new height.'],
      [301,'Second side touches again','Turning the roller changes the reading again, even with the fence down in the gate.']
    ],126,'Compare the two roller contacts','The close-up shows one side of the cam pocket. The dot makes it easier to follow the roller as it turns. The readings below the film show how many degrees the cam turns before contact. The film exaggerates the wheel movement so you can see the fence drop.',
    ['https://patents.google.com/patent/US5749252A/en','Contact rollers in a combination lock'])],
};
for(const [index,mode] of ['correct','wrong'].entries()){
  const chapter=familyGuides.combination.chapters[index];
  const study='combination-'+mode;
  const stem='output/combination-reader/'+study;
  Object.assign(chapter,{clip:stem+'.mp4',poster:stem+'-poster.jpg',inspectionFile:stem+'-inspection.json',
    inspect:study,detailName:'wheel',mediaRevision:'wheel-views-1',
    sectionNote:'The four circles show the drive cam and the three wheels at the same instant. The near wheel is closest to the cam. Beside each blue wheel, the copper dot is the same fence seen end-on. The dot beside the silver cam is the lever nose.'});
}
const ordinarySources={
  lever:['https://www.gutenberg.org/files/63128/63128-h/63128-h.htm','A. C. Hobbs on levers under bolt pressure'],
  disc:['https://www.sparrowslockpicks.com/products/sparrows-disc-pick','The inner pick and outer tensioner'],
  warded:['https://www.gutenberg.org/files/63128/63128-h/63128-h.htm','A. C. Hobbs on wards and skeleton keys'],
  combination:['https://patents.google.com/patent/US5749252A/en','Dial contact and wheel position']
};
for(const [family,source] of Object.entries(ordinarySources))familyGuides[family].chapters[2].source=source;
familyGuides.disc.chapters[2].toolSource=['https://patents.google.com/patent/US4195503A/en','Drive surfaces on a torque tumbler'];
const securityIntroductions={
  lever:['Lever lock security','A false gate catches the bolt at the wrong lever height. A detector catches an overlift and can keep the bolt locked even after the lever drops.'],
  disc:['Disc detainer security','False gates can make a disc feel correctly aligned. A second bar can hold the discs together before the picker has finished aligning them.'],
  warded:['Warded lock security','Wards are fixed pieces of metal. A ward at the keyhole can stop a bit going in. A ward deeper in the lock can let the bit enter and still stop it turning.'],
  combination:['Combination lock security','A change in resistance at the dial can give away the position of a wheel. Some locks use a spring to keep the fence off the wheels. Others use rollers to change where the dial meets resistance, even when the wheels haven’t moved.']
};
for(const [family,[name,alt]] of Object.entries(familyChoices)){
  const primary=familyGuides[family].chapters[3];
  if(securityIntroductions[family]){
    [primary.heading,primary.introduction]=securityIntroductions[family];
  }
  primary.choice=name;
  primary.variants=[alt];
  if(family==='wafer'){alt.mediaRevision='wafer-rocking-2';alt.toolSource=['https://grimworkshop.com/blogs/news/how-to-use-jiggler-key-picks-for-lock-picking','Grim Workshop on wafer jigglers'];}
  if(family==='disc')alt.mediaRevision='disc-blocking-middle-1';
  if(family==='lever'){
    alt.mediaRevision='detector-mortice-1';
  }
  if(family!=='wafer'){
    familyGuides[family].chapters[2].mediaRevision=family==='disc'?'disc-tension-1':family==='combination'?'dial-contact-2':'family-study-3';
    primary.mediaRevision='family-study-3';
  }
  for(const study of [primary,alt])study.thumbnail='output/assembly-films/'+study.study+'-feature.jpg';
  alt.choice={wafer:'Toothed sidebar',lever:'Detector lever',disc:'Disc blocking',warded:'Keyhole ward',combination:'Contact rollers'}[family];
}
