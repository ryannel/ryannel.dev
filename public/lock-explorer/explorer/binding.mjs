// Frame numbers match the first setting sequence in each inspected Blender film.
const lessons = {
  pin: {
    title: 'Why one pin binds first',
    lead: 'A turning tool gives the plug a slight twist. Pickers call that turning pressure tension. Each driver pin crosses the boundary between the plug and the shell, but there’s a little play around each pin. Tiny differences in the size and position of the holes mean the plug reaches one driver first. It presses that driver against the shell. This is binding.\n\nWhen the pick lifts that driver clear of the shear line, the plug turns a fraction and the picker may feel a click. Keeping tension on the plug holds its edge under the driver. The key pin can drop away while the driver stays up.',
    lastFrame: 157,
    moments: [
      [0, 14, 'Apply tension', 'The flat tool turns the plug. The middle driver runs out of room first and takes the turning load. The front pin still has room to move.'],
      [32, 67, 'Test the front pin', 'The hook lifts the front pin against its spring. When the hook lowers, the spring pushes both pins back down.'],
      [88, 105, 'Feel the middle pin bind', 'The hook now has to lift the middle driver past the edge pressing against it. That extra resistance tells the picker which pin is binding.'],
      [128, 144, 'Feel the plug move', 'As the driver clears the shear line, the resistance gives way. The plug turns until the next pin stops it. The picker feels that movement through the turning tool and may hear a click as the parts meet.'],
      [145, 155, 'Lower the pick', 'Turning pressure keeps the holes slightly out of line. The spring presses the blue driver onto the edge of the plug. The pale key pin drops with the hook. The driver is set.']
    ],
    sectionNote: 'Three of the five chambers are fitted with pins. The whole-lock view follows the hook. The close-up cuts through the middle chamber so you can see the driver resting on the plug as the key pin drops. A sound cue marks the moment the middle driver clears. A real set can be quiet.',
    source: ['https://www.mattblaze.org/papers/notes/picking/', 'Matt Blaze on binding and setting a driver']
  },
  wafer: {
    title: 'Why one wafer feels stiff',
    lead: 'The flat tool turns the plug while the hook lifts a wafer. Each wafer sticks into a groove in the housing. There’s a little room on either side of each tip, so when the plug turns, one tip reaches the wall of the groove first. The wall presses against that wafer and makes it harder to lift.',
    lastFrame: 101,
    moments: [
      [0, 14, 'Turn the plug', 'The flat tool at the mouth of the keyway takes up the play in the plug. Here the middle wafer meets the wall of the groove first.'],
      [20, 45, 'Lift the front wafer', 'The hook lifts the front wafer against its spring. The wafer follows the hook back down.'],
      [60, 73, 'Lift the middle wafer', 'The middle wafer rubs against the groove as the hook lifts it. The extra resistance comes from the turning tool pressing the wafer sideways.'],
      [80, 99, 'See what holds it up', 'When the tip clears the groove, the turning tool moves a little farther. The housing now sits under the tip and holds the wafer up as the hook leaves.']
    ]
  },
  lever: {
    title: 'How bolt pressure makes a lever bind',
    lead: 'In a lever lock the picker puts pressure on the bolt. The copper tool enters the keyhole and pushes the bolt towards the open position. A small post on the bolt, called the stump, meets the edge of a lever. The pressure makes that lever harder to lift with the silver wire.',
    lastFrame: 125,
    moments: [
      [0, 12, 'Load the bolt', 'The copper tool pushes on the bolt tail. The bolt moves until its stump presses against the rear lever.'],
      [20, 50, 'Lift the loose levers', 'The wire lifts the front and middle levers in turn. Each springs back down. The stump is still pressing against the rear lever.'],
      [68, 89, 'Feel the rear lever bind', 'The wire has to lift the rear lever against both its spring and the stump rubbing on its edge.'],
      [112, 121, 'See the stump enter the gate', 'When the slot in the rear lever reaches the stump, the bolt moves a little. The picker feels that through the copper tool. The stump now sits in the slot and holds the lever as the wire lowers.']
    ]
  },
  disc: {
    title: 'How turning pressure reaches the discs',
    lead: 'In this front-tensioned lock the copper tool turns a drive disc at the entrance. A lug on that disc meets a stop on the carrier, the cylinder that holds the stack. Turning pressure now pushes the carrier against the housing and forces the sidebar against a disc rim. The picker feels the difference through the silver tool that turns the individual discs.',
    lastFrame: 233,
    moments: [
      [0, 40, 'Engage the drive disc', 'The tooth on the hollow copper tool turns the front drive disc. Its lug still has room to move.'],
      [63, 93, 'Load the sidebar', 'The lug meets the carrier stop. As the carrier starts to turn, the housing pushes the sidebar against the rear disc.'],
      [120, 160, 'Turn the loose discs', 'The silver tip passes through the copper tool. The front and middle discs turn easily while the rear disc carries the load.'],
      [174, 186, 'Feel the rear disc bind', 'The rear disc takes more effort to turn because its rim is rubbing against the sidebar.'],
      [220, 230, 'See the load move', 'The notch in the rear disc reaches the sidebar. The bar moves into the notch until the middle disc stops it. The picker can now feel the resistance at the middle disc.']
    ]
  }
};

export function chapterSequence(family, guide) {
  const picking = family === 'warded' ? ['bypass','Bypassing'] :
    family === 'combination' ? ['manipulation','Dial manipulation'] : ['picking','Picking'];
  const sections = [
    ['opening','How it opens'],
    family === 'combination' ? ['different-combination','The wrong combination'] : ['different-key','The wrong key'],
    picking, ['security','Security features']
  ];
  const chapters = guide.chapters.map((chapter, index) => ({
    ...chapter, routeSlug: sections[index]?.[0] ?? chapter.slug, topic: sections[index]?.[1] ?? chapter.topic
  }));
  const lesson = lessons[family];
  if (lesson) {
    const manual = chapters[2];
    chapters.splice(2, 0, {
      ...lesson, routeSlug: 'binding', topic: 'Tension and binding', bindingSource: manual.asset,
      asset: 'output/binding/' + family + '-binding', captions: 'output/binding/' + family + '-binding.vtt', inspect: manual.inspect,
      source: lesson.source ?? manual.source, sectionNote: lesson.sectionNote ?? manual.sectionNote,
      cues: lesson.moments.map(([start,,,text]) => [start,text])
    });
  }
  return {...guide, chapters};
}
