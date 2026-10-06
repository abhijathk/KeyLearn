/**
 * TIME KEEPERS' VOICE, DAY AND NIGHT (owner, 6 Oct 2026).
 *
 * Two whole banks rather than a day script with a few night lines mixed in.
 * The old mix had the dark half of every pool saying daylight things — a
 * child walking at two in the morning was told about the paddy shining and
 * the market trading — and the day half saying night things, because the
 * lamp lines had been written for the day table.
 *
 * Each bank is true at ANY hour of its half. What is only true at some hours
 * lives in `VILLAGE_SLICES` and is added on top for the hour the road is at:
 *
 *   day    morning 6-10 · midday 10-16 · lateday 16-18
 *   night  lamps 18-20 · shutting 20-22 · deep 22-4 · predawn 4-6
 *
 * The facts they lean on are the world's, and change with it:
 *   - the temple's lamps burn 18:00-20:00; the shrine's own lamp day and night;
 *   - every milestone's lamp is lit for the whole of the night;
 *   - the market (MARKET_ROW_HOURS): the tea shop 6-20, the rest from 8,
 *     shut between 18 and 21 one at a time;
 *   - after dark the village has mostly gone in.
 *
 * Rules every list keeps (village-says.test.ts holds them):
 *   - `First` is said once ever, `B1`/`B2`/`B3` are familiarity bands, a bare
 *     key is said at any distance;
 *   - the first line of a list never names the guide — it is the only line a
 *     child on the "predictable" setting ever hears;
 *   - the guide is always `{guide}`, never his name, so switching him off
 *     can filter him out;
 *   - nothing from the other worlds, and no place names: it is "a village".
 *
 * Tokens: {name} {guide} {mate} {years} {year} {stone} {stage}, plus
 * {friend} (joins), {letter} (wake, stuck), {finger} (stuck), {chapter} and
 * {land} (crossed).
 */

type Bank = Readonly<Record<string, readonly string[]>>;

export const VILLAGE_DAY = {
  // ── starting out ──────────────────────────────────────────────────────
  startFirst: [
    "You're {years} years from home, and the road only goes one way. Off we go.",
  ],
  startB1: [
    "No cars, no phones, no wires — just a red road. Off we go!",
    "{name} steps onto the road. None of this has been invented yet!",
    "Coconut palms, red earth, and not one screen anywhere. Let's walk!",
    "The sun is up and the road is waiting. Every letter is a step.",
    "{name} squints at the sky. No aeroplanes. Not one. Let's walk!",
  ],
  startB2: [
    "Back on the red road. Every letter is a step.",
    "{guide} is waiting up ahead. Every letter is a step towards him.",
    "Bright day, dry road. Let's walk!",
    "Same stones, same palms, a new stretch of road. Off we go.",
    "{name} knows the first few stones by heart now. Let's go.",
  ],
  startB3: [
    "You know the way by now. Off we go.",
    "{guide} doesn't even wave any more — he just falls in beside you.",
    "Same road, same stones. Let's see how far today.",
    "Daylight, a dry road and good fingers. Off we go.",
    "Back again. The road looks pleased to see you.",
  ],
  start: [
    "Back on the red road. Every letter is a step.",
    "Bright day, dry road. Let's walk!",
  ],

  // ── waiting for the child ─────────────────────────────────────────────
  idleFirst: [
    "{name} is staring at a well with a rope and a bucket. No tap. No pipe.",
  ],
  idleB1: [
    "{name} is staring at a well with a bucket on a rope. They've only ever seen taps.",
    "{guide} is showing {name} something. One key and you're off.",
    "{name} is trying to work out where the wires go. There aren't any.",
    "{name} is watching a cart go by. No engine. Just a very patient animal.",
    "A dragonfly lands on {name}'s shoulder. Press a key to shoo it!",
  ],
  idleB2: [
    "{name} is waiting — press the glowing key!",
    "{name} looks back at you. Ready to walk on?",
    "A dragonfly lands on {name}'s shoulder. Press a key to shoo it!",
    "{name} kicks a pebble down the road. Press the glowing key.",
    "{guide} points up the road. One key and you're off.",
  ],
  idleB3: [
    "{name} knows the next milestone is round the bend. Press a key.",
    "Still here. {name} could walk this stretch with their eyes shut.",
    "{name} is counting the stones still to come. One key and off you go.",
    "{name} leans on a milestone and waits. Press the glowing key.",
    "The road is not going anywhere. Neither is {name}, yet.",
  ],
  idle: [
    "{name} is waiting — press the glowing key!",
    "{name} looks back at you. Ready to walk on?",
  ],
  idleYoung: [
    "{name} peeps up at you — press the glowing key!",
    "{name} is poking a stick into the red mud. Press a key!",
    "{name} chews a blade of grass and blinks — one glowing key, please!",
    "{name} plops down in the dust. Press a key to bounce them up!",
    "{name} is counting coconuts. The glowing key stops them!",
  ],
  idleOld: [
    "{name} stands tall, waiting for your next key.",
    "{name} scans the road ahead. One glowing key and you walk on.",
    "{name} watches smoke rise from a cooking fire. Press the glowing key.",
    "{name} gives a slow, steady nod. Ready when you are.",
    "{name} shades their eyes and waits, calm and patient.",
  ],
  wave: [
    "{name} waves. Hello — still there?",
    "{name} stops and waves. Ready when you are!",
    "{name} turns round and gives you a big wave.",
    "{name} waves, just in case you were looking.",
    "{name} waves from a patch of sunlight. Ready?",
    "{guide} waves from further up the road. Shall we?",
  ],
  waveYoung: [
    "Hiiii! {name} is waving BOTH arms!",
    "{name} waves and waves and waves!",
    "Yoo-hoo! {name} can see you!",
    "{name} is doing a great big hello wave!",
  ],
  waveOld: [
    "{name} waves. Still with me?",
    "A wave from {name}. Ready when you are.",
    "{name} looks back up the road and waves.",
  ],
  crouch: [
    "{name} crouches down at the roadside. No rush!",
    "{name} is having a little rest. Press a key when you're ready.",
    "{name} kneels in the red earth — they've never seen soil this colour.",
    "{name} rests on one knee and watches the fields.",
    "{name} crouches to look at an ant carrying a whole grain of rice.",
    "A breather by the road. {guide} waits too.",
  ],
  crouchYoung: [
    "{name} is waiting for youuu!",
    "{name} sits on their heels by the road. Ready?",
    "{name} is being very, very patient!",
  ],
  crouchOld: [
    "{name} settles by the roadside. Take your time.",
    "{name} drops to a crouch. In your own time.",
    "No hurry. {name} will hold this spot.",
  ],
  sit: [
    "{name} sits down in the shade. Press any key when you're ready!",
    "Comfy here! One key and we're off again.",
    "{name} is sitting under a palm, watching the fields.",
    "{name} crosses their legs by the road. Come back whenever.",
    "{name} watches the grass shift in the wind. One key wakes them.",
  ],
  sitYoung: [
    "{name} is sitting down! Press a key and we can go!",
    "{name} is having a sit-down in the shade. Wake them with a key!",
    "Plonk! {name} sits in the red earth. Press a key when you want to walk!",
  ],
  sitOld: [
    "{name} takes a seat. Press a key whenever you want to carry on.",
    "{name} sits down to wait it out. No rush.",
    "{name} settles cross-legged in the shade. Pick it up whenever.",
  ],

  // ── typing ────────────────────────────────────────────────────────────
  cheer: [
    "Lovely steady walking!",
    "You kept going — that's the whole trick!",
    "Nice and steady, just like that!",
    "The road is easy when you walk it like that!",
    "Sun on your back and the keys going right!",
    "Good, clean steps down the red road!",
    "{guide} can barely keep up with you!",
  ],
  cheerYoung: [
    "WOW! Look at those fingers go!",
    "You did that all by yourself!",
    "{name} does a little skip down the red road!",
    "Super typing! The road is flying by!",
    "Hooray! Even the palm trees are waving!",
    "{guide} has never seen anybody move like that!",
  ],
  cheerCool: [
    "Clean. Keep that rhythm.",
    "Nice run building.",
    "{name} nods, impressed.",
    "That's the pace. Steady and sharp.",
    "Easy in the sunshine. Keep it going.",
    "Smooth — {guide} is jogging to keep up.",
  ],
  streak: [
    "TEN perfect steps down the red road!",
    "Ten in a row — not a stone out of place!",
    "Ten straight — your fingers know {year} by heart!",
    "Ten in a row. Even the buffalo looked up.",
    "Ten in a row! {guide} is counting on his fingers.",
  ],
  miss: [
    "Whoops — {name} stopped. The glowing key shows the way.",
    "Oops! No rush — find the glowing key.",
    "Not that one — but you're SO close. Look for the glow!",
    "Wrong step! Peek at the glowing key and try again.",
    "{name} stubbed a toe on a stone. {guide} helps them up!",
  ],
  stumble: [
    "Oof! Take a breath — then look for the glowing key.",
    "That one got away. Shake your hands out and try the glow.",
    "Everybody stumbles here. Breathe, then find the glow.",
    "Rest your hands in your lap for a second. Then the glowing key.",
    "{guide} waits. Nobody hurries anybody on this road.",
  ],
  stuck: [
    "Look — the {letter} key! Your {finger} presses it.",
    "The {letter} key is right there, under your {finger}.",
    "Try this: find your {finger}, then press {letter} gently.",
  ],
  stuckSpace: [
    "Look — the space bar! A thumb presses it.",
    "The big long key at the bottom — give it a thumb tap.",
    "The gap between two words is the space bar. Thumb!",
  ],
  wake: [
    "The {letter} key is awake — back to the road!",
    "{letter} is your friend now. Onward!",
    "You woke {letter} up! The road carries on.",
  ],

  // ── the road ──────────────────────────────────────────────────────────
  milestoneFirst: [
    "Your first milestone! +10. Somebody carved that number by hand.",
    "Your first milestone! +10. {guide} explains: the number is how far you have come.",
  ],
  milestoneB1: [
    "You reached the stone! +10. Older than all of you, that stone.",
    "That number was carved long before you were born. +10!",
    "A stone with a little lamp on top. It waits for night. +10!",
    "MILESTONE! +10 — {guide} reads the number out loud.",
  ],
  milestoneB2: [
    "Another milestone behind you. +10!",
    "Stone passed! {name} looks back at how far you've come. +10.",
    "That's another one. +10.",
    "Warm from the sun, that stone. +10!",
  ],
  milestoneB3: [
    "Stone {stone}. +10. You know this road now.",
    "Another one down. +10. On to the next.",
    "Stone {stone}, in broad daylight. +10.",
    "{name} touches the stone as they pass, the way {guide} does. +10.",
  ],
  milestone: [
    "Another milestone behind you. +10!",
    "Stone passed! {name} looks back at how far you've come. +10.",
  ],
  grow: [
    "A new key joined your trail — the road opens up!",
    "New key! You're a {stage} now.",
    "Another letter is yours. {stage} suits you.",
    "A new key — the road ahead just got longer.",
    "One more letter learned. {guide} is impressed, and says so.",
  ],
  growYoung: [
    "A NEW KEY! That's another letter you know!",
    "Look — a brand new key on your road!",
    "One more letter! You're a {stage} now!",
  ],
  growOld: [
    "Another key. Not many left on this road now.",
    "A new letter — {stage}, and earning it.",
    "One more key. The whole board is nearly yours.",
  ],
  joins: [
    "{friend} has come to walk with you!",
    "Look who's caught up — {friend}!",
    "{friend} falls in beside you. The village has never seen anything like it.",
    "{friend} comes running down the sunny road to join you!",
  ],
  crossed: [
    "A whole new stretch of road, and nobody here has a map.",
    "Chapter {chapter}! New palms, new stones, same brave typist.",
    "You crossed over — welcome to {land}!",
    "New land, new road. The next stone is waiting.",
  ],
  graduate: [
    "That's the WHOLE alphabet — every letter on this road is yours.",
    "Twenty-six letters, learned {years} years before you were born.",
    "Every key, in broad daylight. Nobody on this road has done that.",
    "You know every single letter! {guide} has never met anyone who could.",
  ],
  timerEnd: [
    "Time to head home — all the way home. Wonderful walking today!",
    "That's the day's walking done. Rest those fingers!",
    "The road will still be here tomorrow, warm in the sun.",
    "Good walking. The stones will keep your place.",
    "{guide} waves goodbye from the roadside. Same time tomorrow?",
  ],

  // ── day coming back, from the settings (day only) ─────────────────────
  daybreak: [
    "Daylight! The milestone lamps can rest now.",
    "The sun is up. The road is red again.",
    "Day again. {name} blinks in the bright light.",
    "Morning has come round. Off we go, in the sunshine.",
    "{guide} stretches. The night is over.",
  ],

  // ── the village ───────────────────────────────────────────────────────
  villageFirst: [
    "A village! Houses, a market, a well, a temple. People live here.",
  ],
  villageB1: [
    "A temple, with a stone lamp standing in front of it.",
    "Seven little shops in one long row — that's the market.",
    "The stone bench round the big tree is called an althara.",
    "A lamp is burning inside the temple, even in daylight. It never goes out.",
    "{guide} says everybody here buys their tea from the same shop.",
  ],
  villageB2: [
    "The market is up ahead. Mind the cart.",
    "Past the althara, then the temple. You know this bit.",
    "There is a queue at the well. There usually is.",
    "The tea shop is busy. It usually is.",
    "{guide} waves at somebody outside the market.",
  ],
  villageB3: [
    "Same cart, same spot, still half unloaded.",
    "Through the village and out the other side. You barely look up.",
    "The shrine lamp is still burning. It always is.",
    "Market, temple, well. You could draw this village from memory.",
    "The village again. {guide} nods at somebody outside the market.",
  ],
  village: [
    "The market is up ahead. Mind the cart.",
    "Through the village and out the other side.",
  ],

  // ── the buffalo ───────────────────────────────────────────────────────
  buffaloNoticeFirst: [
    "{name} has stopped dead. They have never been near anything this big.",
  ],
  buffaloNoticeB1: [
    "The buffalo has looked up. {name} has only seen these in books.",
    "{name} goes very quiet. It is much bigger up close.",
    "A big dark head comes up out of the grass. It is looking at you.",
    "A head comes up in the field. {guide} says: don't run.",
  ],
  buffaloNoticeB2: [
    "That buffalo is watching you. Steady now.",
    "Head up in the field. You know this one.",
    "It has stopped chewing. That is never a good sign.",
    "{guide} has already stopped walking. So should you.",
  ],
  buffaloNoticeB3: [
    "Here we go. It always does this by the third stone.",
    "The buffalo looks up. {name} barely glances at it.",
    "Same buffalo, same field, same look.",
    "Sun on its horns and that look again. Fingers ready.",
  ],
  buffaloNotice: [
    "That buffalo is watching you. Steady now.",
    "Same buffalo, same field, same look.",
  ],
  buffaloWarn: [
    "Head down — keep typing!",
    "Hooves shifting in the mud — go, go, go!",
    "Don't stop now — type!",
    "It's coming. Fingers moving!",
    "{guide} is shouting something — GO!",
  ],
  buffaloCharge: [
    "It's running! Keep going — don't look back!",
    "The buffalo is charging — type!",
    "Hooves behind you — faster!",
    "Dust everywhere — keep typing!",
    "Go, {name}, go!",
  ],
  buffaloSafeFirst: [
    "It stopped. It was never going to reach you — but nobody told {name} that.",
    "It stopped. {guide} is laughing — he knew all along it would.",
  ],
  buffaloSafeB1: [
    "The buffalo stops short and snorts. You're fine.",
    "Back to the grass it goes. It only wanted its field.",
    "{name} is still shaking. The buffalo is already eating again.",
    "Back to the grass it goes. {guide} says they always do that.",
  ],
  buffaloSafeB2: [
    "It pulled up. Just showing off.",
    "All that fuss — and it only wanted the field. Walk on.",
    "Back to the grass. You barely broke step.",
    "It is chewing again as if nothing happened. Walk on.",
  ],
  buffaloSafeB3: [
    "Told you. Walk on.",
    "It never gets any further than that. Never has.",
    "{name} does not even look round this time.",
    "Same buffalo, same stop, same sulk.",
  ],
  buffaloSafe: [
    "It pulled up. Just showing off.",
    "Back to the grass. Walk on.",
  ],

  // ── being looked at ───────────────────────────────────────────────────
  staredFirst: [
    "Everyone has stopped to look at you. Nobody here dresses like that.",
  ],
  staredB1: [
    "Two women by the well have stopped talking to watch you pass.",
    "A boy is staring at your shoes. He has never seen shoes like that.",
    "A man with a basket on his head has stopped dead to look at you.",
    "Somebody in a doorway calls somebody else to come and look.",
  ],
  staredB2: [
    "Heads turn as you pass. You are getting used to it.",
    "A child points at you and then runs to tell somebody.",
    "They still look. Just not for quite so long.",
    "Somebody at the market says something to {guide} and nods at you.",
  ],
  staredB3: [
    "Nobody looks up any more. You are just the children from the road.",
    "A nod from the tea shop. That's new.",
    "Only the smallest children still stare.",
    "Somebody waves at {name} by name. That's new.",
  ],
  stared: [
    "Heads turn as you pass. You are getting used to it.",
    "They still look. Just not for quite so long.",
  ],
} as const satisfies Bank;

export const VILLAGE_NIGHT = {
  // ── starting out ──────────────────────────────────────────────────────
  startFirst: [
    "You're {years} years from home, it's dark, and the road only goes one way. Off we go.",
  ],
  startB1: [
    "No street lights — just little lamps on the milestones. Off we go.",
    "It is properly dark here. Darker than you have ever seen. Every letter is a step.",
    "{name} looks up. More stars than they knew there were. Let's walk.",
    "Every milestone has a flame on top tonight. Follow them.",
    "{guide} says nobody here walks at night without a lamp. Lucky there are so many.",
  ],
  startB2: [
    "Night on the red road. Every letter is a step.",
    "Lamps on the milestones, stars overhead. Let's walk.",
    "The road is a line of little flames. Off we go.",
    "Dark fields, bright stones. Let's walk!",
    "{guide} is waiting by the first lamp. Off we go.",
  ],
  startB3: [
    "You know this road in the dark by now. Off we go.",
    "Night again. The lamps know the way, and so do you.",
    "Same stones, same small flames. Let's see how far tonight.",
    "Dark road, steady fingers. Off we go.",
    "{guide} just nods and falls in beside you, lamp to lamp.",
  ],
  start: [
    "Night on the red road. Every letter is a step.",
    "Lamps on the milestones, stars overhead. Let's walk.",
  ],

  // ── waiting for the child ─────────────────────────────────────────────
  idleFirst: [
    "{name} is staring at a flame burning on top of a stone. No switch. No wire.",
  ],
  idleB1: [
    "{name} is staring at the lamp on the milestone. They've only ever seen bulbs.",
    "It is very dark out past the lamps. Press the glowing key.",
    "{name} is watching a flame in a stone. It has not gone out yet.",
    "Something rustles out in the dark fields. Press a key and keep moving!",
    "{guide} is pointing out stars to {name}. One key and you're off.",
  ],
  idleB2: [
    "{name} is waiting in the lamplight — press the glowing key!",
    "The road waits between one lamp and the next. One glowing key.",
    "{name} looks back down the line of lamps. Ready?",
    "A moth is circling the milestone lamp. Press a key to walk on.",
    "{guide} holds a hand near the flame to warm it. Ready when you are.",
  ],
  idleB3: [
    "{name} could walk this in the dark. Nearly is. Press a key.",
    "{name} counts the lamps still to come. One key and off you go.",
    "{name} leans on a warm milestone in the dark. Press the glowing key.",
    "The next lamp is just round the bend. Press a key.",
    "Still here. The flames are steady, and so is {name}.",
  ],
  idle: [
    "{name} is waiting in the lamplight — press the glowing key!",
    "The road waits between one lamp and the next. One glowing key.",
  ],
  idleYoung: [
    "{name} peeps out of the dark at you — press the glowing key!",
    "{name} is making shadow shapes in the lamplight. Press a key!",
    "{name} is counting stars. The glowing key stops them!",
    "{name} yawns a big yawn. Press a key to wake them up!",
  ],
  idleOld: [
    "{name} stands in the lamplight, waiting for your next key.",
    "{name} looks out into the dark. One glowing key and you walk on.",
    "{name} watches the flame on the milestone. Ready when you are.",
    "{name} waits, calm, in a small circle of light.",
  ],
  wave: [
    "{name} waves in the lamplight. Still there?",
    "A wave out of the dark — {name} is still with you.",
    "{name} waves from beside a milestone lamp. Ready?",
    "{name} turns round in the dark and waves.",
    "{guide} waves from the next pool of light. Shall we?",
  ],
  waveYoung: [
    "Hiiii! {name} is waving in the dark!",
    "{name} waves and waves, right under the lamp!",
    "Yoo-hoo! {name} can see you from here!",
  ],
  waveOld: [
    "{name} waves from the lamplight. Still with me?",
    "A wave out of the dark. Ready when you are.",
    "{name} looks back down the lit road and waves.",
  ],
  crouch: [
    "{name} crouches down inside a pool of lamplight, and waits.",
    "{name} kneels by the milestone, close to the flame.",
    "{name} is having a little rest in the dark. Press a key when you're ready.",
    "{name} crouches and watches the stars come out. No rush.",
    "A breather by the lamp. {guide} waits too.",
  ],
  crouchYoung: [
    "{name} is waiting for youuu, right by the lamp!",
    "{name} curls up small in the lamplight. Ready?",
    "{name} is being very, very patient in the dark!",
  ],
  crouchOld: [
    "{name} settles by the lamp. Take your time.",
    "{name} drops to a crouch in the light. In your own time.",
    "No hurry. {name} will keep this lamp company.",
  ],
  sit: [
    "{name} sits down under a lamp. Press a key when you're ready.",
    "{name} sits with their back to a warm milestone. One key and we're off.",
    "{name} is sitting in the dark, looking at the stars.",
    "{name} crosses their legs in the lamplight. Come back whenever.",
    "{name} sits and listens to the frogs in the fields. One key wakes them.",
  ],
  sitYoung: [
    "{name} is sitting by the lamp! Press a key and we can go!",
    "{name} is having a sleepy sit-down. Wake them with a key!",
    "Plonk! {name} sits in the lamplight. Press a key when you want to walk!",
  ],
  sitOld: [
    "{name} takes a seat by the lamp. Press a key whenever you want to carry on.",
    "{name} sits down to wait out the dark. No rush.",
    "{name} settles cross-legged under the flame. Pick it up whenever.",
  ],

  // ── typing ────────────────────────────────────────────────────────────
  cheer: [
    "Lovely steady walking, even in the dark!",
    "You kept going — lamp to lamp!",
    "Nice and steady, just like that!",
    "The dark is easy when you walk it like that!",
    "Good, clean steps down the night road!",
    "Not one wrong step under the stars!",
    "{guide} can barely keep up with you!",
  ],
  cheerYoung: [
    "WOW! Look at those fingers go, in the dark!",
    "You did that all by yourself!",
    "{name} does a little skip from lamp to lamp!",
    "Super typing! Even the stars are watching!",
    "Hooray! The lamps are flickering for you!",
    "{guide} has never seen anybody move like that at night!",
  ],
  cheerCool: [
    "Clean. Keep that rhythm.",
    "Nice run, lamp to lamp.",
    "{name} nods, impressed.",
    "Steady in the dark. That's the pace.",
    "Sharp, even at this hour.",
    "Smooth — {guide} is jogging to keep up.",
  ],
  streak: [
    "TEN perfect steps down the night road!",
    "Ten in a row — from one lamp to the next!",
    "Ten straight — your fingers know {year} by heart!",
    "Ten in a row, in the dark. That is real walking.",
    "Ten in a row! {guide} is counting on his fingers.",
  ],
  miss: [
    "Whoops — {name} stopped. The glowing key shows the way.",
    "Oops! It's dark, take your time — find the glowing key.",
    "Not that one — but you're SO close. Look for the glow!",
    "Wrong step in the dark! Peek at the glowing key and try again.",
    "{name} tripped on a stone in the dark. {guide} helps them up!",
  ],
  stumble: [
    "Oof! Take a breath — then look for the glowing key.",
    "That one got away. Shake your hands out and try the glow.",
    "Everybody stumbles in the dark. Breathe, then find the glow.",
    "Rest your hands for a second. The lamps will wait.",
    "{guide} waits by the lamp. Nobody hurries anybody on this road.",
  ],
  stuck: [
    "Look — the {letter} key! Your {finger} presses it.",
    "The {letter} key is right there, under your {finger}.",
    "Try this: find your {finger}, then press {letter} gently.",
  ],
  stuckSpace: [
    "Look — the space bar! A thumb presses it.",
    "The big long key at the bottom — give it a thumb tap.",
    "The gap between two words is the space bar. Thumb!",
  ],
  wake: [
    "The {letter} key is awake — back to the road!",
    "{letter} is your friend now. On to the next lamp!",
    "You woke {letter} up! The night road carries on.",
  ],

  // ── the road ──────────────────────────────────────────────────────────
  milestoneFirst: [
    "Your first milestone! +10. Somebody lit that lamp on top by hand.",
    "Your first milestone! +10. {guide} explains: the number is how far you have come.",
  ],
  milestoneB1: [
    "You reached the stone! +10. Its little lamp is burning just for the road.",
    "A number carved in stone, a flame on top. +10!",
    "Another stone, found in the dark. +10!",
    "MILESTONE! +10 — {guide} reads the number by the lamplight.",
  ],
  milestoneB2: [
    "Another milestone behind you. +10!",
    "Another stone, found in the dark. +10!",
    "Lamp passed! {name} looks back at the line of flames. +10.",
    "That's another one. +10.",
  ],
  milestoneB3: [
    "Stone {stone}. +10. You'd find it with your eyes shut.",
    "Another lamp behind you. +10. On to the next.",
    "Stone {stone}, burning away. +10.",
    "{name} warms their hands at the stone as they pass. +10.",
  ],
  milestone: [
    "Another milestone behind you. +10!",
    "Another stone, found in the dark. +10!",
  ],
  grow: [
    "A new key joined your trail — the road opens up!",
    "New key! You're a {stage} now.",
    "Another letter is yours. {stage} suits you.",
    "A new key — one more lamp's worth of road.",
    "One more letter learned, at night. {guide} is impressed.",
  ],
  growYoung: [
    "A NEW KEY! That's another letter you know!",
    "Look — a brand new key, glowing in the dark!",
    "One more letter! You're a {stage} now!",
  ],
  growOld: [
    "Another key. Not many left on this road now.",
    "A new letter — {stage}, and earning it in the dark.",
    "One more key. The whole board is nearly yours.",
  ],
  joins: [
    "{friend} has come to walk with you, even at night!",
    "Look who's caught up in the dark — {friend}!",
    "{friend} steps into the lamplight beside you.",
    "{friend} falls in beside you. Nobody here has ever seen anything like it.",
  ],
  crossed: [
    "A whole new stretch of road, and you crossed it in the dark.",
    "Chapter {chapter}! New stones, new lamps, same brave typist.",
    "You crossed over in the night — welcome to {land}!",
    "New land, new road. The next lamp is waiting.",
  ],
  graduate: [
    "That's the WHOLE alphabet — every letter on this road is yours.",
    "Twenty-six letters, learned {years} years before you were born.",
    "Every key, by lamplight. Nobody on this road has done that.",
    "You know every single letter! {guide} has never met anyone who could.",
  ],
  timerEnd: [
    "Time to stop. The milestone lamps will burn all night. Wonderful walking!",
    "That's tonight's walking done. Rest those fingers!",
    "The road keeps its lamps lit until morning. It will keep your place too.",
    "Good walking. Off to bed — the stones will wait.",
    "{guide} waves goodnight from the lamplight. Same time tomorrow?",
  ],

  // ── night falling (night only) ────────────────────────────────────────
  nightfallFirst: [
    "The sun has gone, and little flames are coming on along the road. Nobody flicked a switch.",
  ],
  nightfallB1: [
    "It's getting dark. Every milestone has a flame on top now.",
    "{name} has never seen a road this dark. Or this full of little fires.",
    "No street lights here. Just oil, burning in stone.",
    "The fields have gone dark. The road has not.",
  ],
  nightfallB2: [
    "Night is coming down. The milestone lamps are lit.",
    "The fields have gone dark. The road has not.",
    "Stars are coming out. Keep walking, lamp to lamp.",
    "Darker now. The road knows the way.",
  ],
  nightfallB3: [
    "Night again. You know the way in the dark by now.",
    "Lamps on, fields gone dark. Same as always.",
    "{name} doesn't even slow down when the light goes.",
    "Dark comes quickly here. You hardly notice any more.",
  ],
  nightfall: [
    "Night is coming down. The milestone lamps are lit.",
    "The fields have gone dark. The road has not.",
  ],

  // ── the village ───────────────────────────────────────────────────────
  villageFirst: [
    "A village, at night! Houses, a market, and a temple with a lamp that never goes out.",
  ],
  villageB1: [
    "A temple in the dark, and inside it one small lamp that never goes out.",
    "A lamp glows in a window here and there. No electric light anywhere.",
    "The market row looks different by lamplight.",
    "The big tree is just a shape against the stars now.",
    "{guide} lowers his voice. It is night in the village.",
  ],
  villageB2: [
    "Through the village in the dark. Quietly.",
    "The shrine lamp is burning. It always is.",
    "Mind the cart — it is hard to see in the dark.",
    "Past the big tree, then the temple. You know this bit, even at night.",
    "{guide} nods at a lamp in a window.",
  ],
  villageB3: [
    "The village at night again. You know every shadow.",
    "Same cart, same spot, a shape in the dark.",
    "The shrine lamp is still burning. It always is.",
    "Through the dark village and out the other side.",
    "{guide} walks through without slowing down.",
  ],
  village: [
    "Through the village in the dark. Quietly.",
    "The shrine lamp is burning. It always is.",
  ],

  // ── the buffalo ───────────────────────────────────────────────────────
  buffaloNoticeFirst: [
    "{name} has stopped dead. Something enormous is breathing out there in the dark.",
  ],
  buffaloNoticeB1: [
    "Two eyes in the dark field, catching the lamplight. It's the buffalo.",
    "{name} goes very quiet. It is even bigger in the dark.",
    "A huge shape lifts its head out in the black field.",
    "Something big is out there. {guide} says: don't run.",
  ],
  buffaloNoticeB2: [
    "That buffalo is watching you from the dark. Steady now.",
    "Eyes in the field again. You know this one.",
    "It has stopped chewing, out there in the black.",
    "{guide} has already stopped walking. So should you.",
  ],
  buffaloNoticeB3: [
    "Here we go. Even at night it does this.",
    "Two eyes in the dark. {name} barely glances at them.",
    "Same buffalo, same field, same look — just darker.",
    "A snort out of the dark. Fingers ready.",
  ],
  buffaloNotice: [
    "That buffalo is watching you from the dark. Steady now.",
    "Two eyes in the dark field. Steady.",
  ],
  buffaloWarn: [
    "Head down — keep typing!",
    "Hooves in the dark — go, go, go!",
    "Don't stop now — type!",
    "It's coming out of the dark. Fingers moving!",
    "{guide} is shouting something — GO!",
  ],
  buffaloCharge: [
    "It's running! Keep going — don't look back!",
    "The buffalo is charging out of the dark — type!",
    "Hooves behind you — faster!",
    "Run for the next lamp — keep typing!",
    "Go, {name}, go!",
  ],
  buffaloSafeFirst: [
    "It stopped at the edge of the lamplight. It was never going to reach you — but nobody told {name} that.",
    "It stopped. {guide} is laughing — he knew all along it would.",
  ],
  buffaloSafeB1: [
    "The buffalo stops short in the dark and snorts. You're fine.",
    "Back into the black field it goes. It only wanted its grass.",
    "{name} is still shaking. The buffalo is already eating again.",
    "Back into the dark it goes. {guide} says they always do that.",
  ],
  buffaloSafeB2: [
    "It pulled up at the edge of the light. Just showing off.",
    "All that fuss in the dark — and it only wanted the field. Walk on.",
    "Back into the dark. You barely broke step.",
    "You can hear it chewing again. Walk on.",
  ],
  buffaloSafeB3: [
    "Told you. Walk on.",
    "It never gets any further than that, night or day.",
    "{name} does not even look round this time.",
    "Same buffalo, same stop, same sulk — in the dark.",
  ],
  buffaloSafe: [
    "It pulled up at the edge of the light. Just showing off.",
    "Back into the dark. Walk on.",
  ],

  // ── being looked at ───────────────────────────────────────────────────
  staredFirst: [
    "Somebody with a lamp has stopped to look at you. Nobody here dresses like that.",
  ],
  staredB1: [
    "A face at a window, lit by a lamp, watching you pass.",
    "Somebody walking home with a lantern has stopped dead to look at you.",
    "A door opens a crack. Somebody wants to see who is out this late.",
    "A dog barks at you from a dark yard, then thinks better of it.",
  ],
  staredB2: [
    "A face at a window again. You are getting used to it.",
    "Somebody calls goodnight. You think it was to you.",
    "Somebody looks up from their lamp as you pass.",
    "Somebody by the tea shop says something to {guide} and nods at you.",
  ],
  staredB3: [
    "Nobody looks up any more, not even in the dark.",
    "A wave from a lit doorway. That's new.",
    "Only the dogs still notice you at night.",
    "Somebody calls goodnight to {name} by name. That's new.",
  ],
  stared: [
    "A face at a window, watching you pass.",
    "Somebody looks up from their lamp as you pass.",
  ],
} as const satisfies Bank;

/** The hours the road can be at, and what is only true at some of them. */
export type VillageSlice =
  | "morning"
  | "midday"
  | "lateday"
  | "lamps"
  | "shutting"
  | "deep"
  | "predawn";

/**
 * Which slice an hour falls in. `night` is the night switch, because the hour
 * alone is ambiguous at the edges: a night staged at 18:12 is night, and a day
 * staged at 17:50 is day, whatever the numbers suggest.
 */
export function villageSlice(hour: number, night: boolean): VillageSlice {
  const h = ((hour % 24) + 24) % 24;
  if (!night) {
    return h < 10 ? "morning" : h < 16 ? "midday" : "lateday";
  }
  if (h >= 18 && h < 20) return "lamps";
  if (h >= 20 && h < 22) return "shutting";
  if (h >= 4 && h < 18) return "predawn";
  return "deep";
}

/**
 * LINES THAT ARE ONLY TRUE AT SOME HOURS, by bare context. Added on top of the
 * day or night bank, so they come up often at their hour and never at any
 * other. A context with nothing here simply uses the bank.
 */
export const VILLAGE_SLICES: Readonly<
  Record<VillageSlice, Readonly<Record<string, readonly string[]>>>
> = {
  morning: {
    clock: [
      "Early morning. Only the tea shop is open yet.",
      "Morning on the road. The dew is still on the grass.",
      "Early. The market opens at eight.",
    ],
    daybreak: [
      "Morning! The tea shop is taking its shutters down.",
      "Early morning, and the mist is lifting off the fields.",
    ],
    start: [
      "Early. The tea shop is the only thing open. Off we go.",
      "Morning on the red road. Dew on the grass. Let's walk!",
      "The village is waking up. Every letter is a step.",
    ],
    idle: [
      "{name} is watching the morning mist lift off the fields. Press a key.",
      "Smoke from a breakfast fire somewhere. One glowing key.",
    ],
    village: [
      "Only the tea shop is open yet. Everybody else opens at eight.",
      "Shutters still down on the market. Except the tea shop — it opens at six.",
      "Somebody is sweeping the steps of the temple. Morning.",
    ],
    timerEnd: [
      "A good morning's walking. Go and have breakfast!",
      "Done before most of the village is even up. Well walked!",
    ],
    milestone: ["A cold stone in the morning. +10!"],
  },
  midday: {
    clock: [
      "Midday. The sun is high and every shop is open.",
      "The middle of the day. Hot, bright and busy.",
    ],
    daybreak: [
      "Broad daylight. The whole market is open.",
      "The sun is high. Every shutter is up.",
    ],
    start: [
      "The sun is high and the road is bright. Let's walk!",
      "Midday, and everything is wide awake. Off we go.",
    ],
    idle: [
      "{name} has found a patch of shade. Press a key to coax them out.",
      "It is hot. {name} fans their face. One glowing key.",
    ],
    village: [
      "Every shutter in the market is open. Busy, busy.",
      "The shutters are all open. Somebody is buying rice.",
      "The whole market row is trading. Somebody is arguing about the price of rice.",
      "The well is busy. Everybody wants cold water at this hour.",
    ],
    sit: ["{name} sits in the shade of a palm, out of the hot sun."],
    timerEnd: ["Out of the midday sun with you. Wonderful walking!"],
  },
  lateday: {
    clock: [
      "Late afternoon. Long shadows on the road.",
      "The sun is getting low. The light is going gold.",
    ],
    daybreak: ["Daylight — late in the day, with long gold shadows."],
    start: [
      "Late afternoon. Long shadows on the red road. Off we go.",
      "The sun is getting low. Plenty of road before dark. Let's walk!",
    ],
    idle: [
      "{name} is watching their shadow stretch out across the road. Press a key.",
      "The light is going gold. One glowing key.",
    ],
    village: [
      "The market is still open. Last shopping before dark.",
      "Everybody is out — the day is cooling off.",
    ],
    timerEnd: ["The sun is going down. A good day's walking!"],
  },
  lamps: {
    clock: [
      "Evening — lamp-lighting time. Every lamp at the temple is lit.",
      "Early evening. The market is still trading by lamplight.",
    ],
    start: [
      "Lamp-lighting time. Every lamp at the temple is lit. Off we go.",
      "Evening. The market is still trading under its lamps. Let's walk.",
    ],
    nightfall: [
      "It's getting dark. Somebody is going round the temple lighting the lamps.",
      "The temple's lamps are coming on — the stone one, the brass one, the hanging ones.",
      "Evening. The market is still open, though, under its own lamps.",
      "Lamp-lighting time. Every lamp at the temple, one by one.",
    ],
    village: [
      "Every lamp at the temple is lit. For two hours they'll all burn.",
      "Most of the market is still open, a lamp burning in each shop.",
      "The stone lamp in front of the temple is lit. So is the one in the shrine.",
    ],
    idle: ["{name} is watching the temple lamps flicker. Press a key."],
    timerEnd: ["The temple lamps are all lit. A good evening's walking!"],
  },
  shutting: {
    clock: [
      "Late evening. The shutters are coming down, one by one.",
      "Getting late. The temple lamps are out, all but the shrine's.",
    ],
    start: [
      "Late. The shutters are coming down one by one. Off we go.",
      "The temple lamps have gone out, all but the shrine's. Let's walk.",
    ],
    nightfall: [
      "Dark now. The temple lamps are out — all but the one in the shrine.",
      "Shutters are coming down along the market. Night is here.",
      "Late evening. Most of the village has gone in.",
    ],
    village: [
      "The shops are shutting, one shutter at a time.",
      "The temple's evening lamps are out. Only the shrine lamp is left.",
      "The tea shop is putting its stools up for the night.",
    ],
    idle: ["A shutter rattles down somewhere. Press a key."],
    timerEnd: ["The market's shutting up. Time we did too. Wonderful walking!"],
  },
  deep: {
    clock: [
      "The middle of the night. Everybody is asleep.",
      "Deep night. Just the stars and the milestone lamps.",
    ],
    start: [
      "The middle of the night. Everybody is asleep. Quietly — off we go.",
      "Deep night. Just the stars and the milestone lamps. Let's walk.",
    ],
    nightfall: [
      "Deep night. Every shutter is down and every house is dark.",
      "The whole village is asleep. Only the lamps are awake.",
      "Middle of the night. Even the dogs have stopped barking.",
    ],
    village: [
      "Every shutter is down. Every door is shut. Shhh.",
      "The whole village is asleep. Only the shrine lamp is awake.",
      "Not one light in the market. Tiptoe.",
      "The village, asleep. You tiptoe without thinking.",
    ],
    idle: [
      "It is very, very late. {name} yawns. Press a key.",
      "Everyone is asleep but you, {name} and the lamps. One glowing key.",
    ],
    timerEnd: [
      "It is the middle of the night — straight to bed! Wonderful walking.",
    ],
  },
  predawn: {
    clock: [
      "Nearly morning, but still dark.",
      "Before dawn. The tea shop opens at six.",
    ],
    start: [
      "Nearly morning, but still dark. Off we go.",
      "The sky is just starting to think about getting light. Let's walk.",
    ],
    nightfall: [
      "Still dark, but morning is not far off now.",
      "The stars are fading. The milestone lamps are not.",
    ],
    village: [
      "Still dark. The tea shop opens at six — not long now.",
      "Somebody is up already, lighting a fire for breakfast.",
      "The village is beginning to stir in the dark.",
    ],
    idle: ["The sky is going grey at the edges. Press a key."],
    timerEnd: ["Nearly morning! What a time to be walking. Well done."],
  },
};
