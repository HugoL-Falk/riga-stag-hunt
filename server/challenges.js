const CHALLENGES = [
  // --- MAIN LANDMARK CHALLENGES ---
  {
    id: 1, category: 'landmark', title: 'Swedish Gate Viking pose', hint: 'Torņa iela 4', type: 'photo', pts: 1,
    desc: 'All team members pass through the Swedish Gate arch. One person does a full Viking pose — helmet hands, battle cry face.',
    bonus: [
      { id: '1a', pts: 1, text: 'Someone sings at least one line of an ABBA song loudly while walking through the arch.', video: true },
      { id: '1b', pts: 1, text: 'A stranger spontaneously laughs or reacts and gets pulled into the photo.' },
    ]
  },
  {
    id: 2, category: 'landmark', title: 'Three Brothers house age', hint: 'Mazā Pils iela 17–21', type: 'trivia', pts: 2,
    desc: 'Correctly name the century the oldest of the Three Brothers was built. Upload a photo at the houses.',
    answerField: { label: 'Which century was the oldest brother built?', placeholder: 'e.g. 15th century', correct: '15th' },
    bonus: [
      { id: '2a', pts: 1, text: 'Also correctly name the architectural style of the middle brother.', answerField: { label: 'Architectural style of the middle brother?', placeholder: 'e.g. Mannerist', correct: 'mannerist' } },
      { id: '2b', pts: 2, text: 'Recreate a 15th-century merchant portrait — one person as the merchant, rest as servants. Serious faces only.' },
    ]
  },
  {
    id: 3, category: 'landmark', title: 'Cathedral choir photo', hint: 'Herdera laukums 6', type: 'photo', pts: 1,
    desc: 'Recreate a solemn church choir outside Riga Cathedral — hands clasped, eyes to heaven. Full team required.',
    bonus: [
      { id: '3a', pts: 1, text: 'At least one person looks genuinely moved — real or performed tears both accepted.' },
      { id: '3b', pts: 2, text: 'Team sings a recognisable hymn for at least 10 seconds outside.', video: true },
    ]
  },
  {
    id: 4, category: 'landmark', title: 'Black Balsam shot', hint: 'Kaļķu iela 10 — bookshelf door', type: 'shot', pts: 2,
    desc: 'Enter the Riga Black Magic Bar through the secret bookshelf entrance. Every team member does a shot of Riga Black Balsam together. No substitutions.',
    bonus: [
      { id: '4a', pts: 1, text: 'Ask the bartender one fact about the 24-herb recipe and correctly repeat it back.', answerField: { label: 'What fact did the bartender share?', placeholder: 'Type the fact here...' } },
      { id: '4b', pts: 2, text: 'Get a photo with a genuinely smiling staff member. Charm is required.' },
    ]
  },
  {
    id: 5, category: 'landmark', title: 'Christmas tree plaque speech', hint: 'Town Hall Square', type: 'task', pts: 2,
    desc: "Find the plaque marking the world's first decorated Christmas tree (1510). One member delivers a 30-second completely made-up history speech with full confidence.",
    bonus: [
      { id: '5a', pts: 1, text: 'At least one passerby stops and listens for the full 30 seconds.', video: true },
      { id: '5b', pts: 2, text: 'A stranger asks a follow-up question believing the story is real. Must answer fully in character.', video: true },
    ]
  },
  {
    id: 6, category: 'landmark', title: "St. Peter's human pyramid", hint: 'Reformācijas Laukums 1', type: 'photo', pts: 3,
    desc: "Attempt a human pyramid outside St. Peter's Church. Genuine effort required. At least two layers to score.",
    bonus: [
      { id: '6a', pts: 1, text: 'Three full layers achieved and held for at least 3 seconds.' },
      { id: '6b', pts: 1, text: 'A tourist takes the photo for you — meaning you physically handed them your phone.' },
      { id: '6c', pts: 1, text: 'The person on top points dramatically at the church spire at the moment of the photo.' },
    ]
  },
  {
    id: 7, category: 'landmark', title: 'Freedom Monument silence', hint: 'Brīvības bulvāris', type: 'task', pts: 2,
    desc: 'Whole team stands in complete silence for 30 seconds at the Freedom Monument. Any giggling restarts the clock. End with a loud "For Latvia!" shouted at a stranger.',
    bonus: [
      { id: '7a', pts: 1, text: 'The stranger you shout at says something back — laughing counts.', video: true },
      { id: '7b', pts: 2, text: 'One person holds a deadpan military salute for the full 30 seconds without cracking.', video: true },
    ]
  },
  {
    id: 8, category: 'landmark', title: 'House of the Blackheads selfie', hint: 'Town Hall Square', type: 'photo', pts: 1,
    desc: 'Full team photo in front of the House of the Blackheads. Everyone must make a completely different facial expression — no duplicates.',
    bonus: [
      { id: '8a', pts: 1, text: 'Someone accurately recreates the exact pose of one of the statues on the facade.' },
      { id: '8b', pts: 1, text: 'Find the small Christmas tree plaque nearby and get two members pointing at it in one shot.' },
    ]
  },
  {
    id: 9, category: 'landmark', title: 'Recruit a local', hint: 'Anywhere in Old Town', type: 'task', pts: 3,
    desc: 'Convince a genuine local (not a tourist) to say "Priekā!" on camera with the team. Team must also attempt a full Latvian sentence.',
    video: true,
    bonus: [
      { id: '9a', pts: 1, text: 'The local teaches your team another Latvian word and confirms your pronunciation on camera.', video: true, answerField: { label: 'What Latvian word did you learn?', placeholder: 'Type the word here...' } },
      { id: '9b', pts: 2, text: 'The local joins the group photo with their arm around someone from the team.' },
    ]
  },
  {
    id: 10, category: 'landmark', title: 'Līvu Square stand-up', hint: 'Līvu laukums', type: 'task', pts: 3,
    desc: 'One team member performs a 20-second stand-up comedy routine to strangers. The rest of the team must laugh hysterically.',
    video: true,
    bonus: [
      { id: '10a', pts: 1, text: 'A stranger genuinely laughs — not just out of politeness.', video: true },
      { id: '10b', pts: 2, text: 'A second team member heckles, and the performer responds in character without breaking.', video: true },
    ]
  },
  {
    id: 11, category: 'landmark', title: 'Oldest thing spotted', hint: 'Anywhere in Old Town', type: 'trivia', pts: 2,
    desc: 'Photograph the oldest-dated object you can find — a door, stone, plaque, anything with a date. Team with the oldest verified date wins.',
    answerField: { label: 'What date/year is on the object?', placeholder: 'e.g. 1488' },
    bonus: [
      { id: '11a', pts: 1, text: 'A legible date or inscription is clearly visible in the photo without zooming in.' },
      { id: '11b', pts: 1, text: 'A team member poses next to the object looking equally ancient and weathered.' },
    ]
  },
  {
    id: 12, category: 'landmark', title: 'First back to Victory Pub', hint: 'Tirgoņu iela 10', type: 'shot', pts: 1,
    desc: 'Full team back at Victory Pub with everyone present. First team through the door claims this one.',
    bonus: [
      { id: '12a', pts: 1, text: 'Your team has a round already waiting on the table before the second team walks in.' },
      { id: '12b', pts: 2, text: 'Someone from your team greets the last-place team at the door with slow ceremonial applause.', video: true },
    ]
  },

  // --- QUICK MISSIONS (1pt) ---
  { id: 101, category: 'quick', title: 'Buy a stranger a drink', hint: 'Any bar', type: 'social', pts: 1, desc: 'Buy a stranger a drink and get a photo with them holding it. They must look happy about it.', bonus: [] },
  { id: 102, category: 'quick', title: 'Find your team colour', hint: 'Anywhere', type: 'photo', pts: 1, desc: 'Find a stranger wearing your team colour and get a photo with them. They must be wearing it visibly — no cheating with tiny details.', bonus: [] },
  { id: 103, category: 'quick', title: 'Pet a dog', hint: 'Anywhere', type: 'photo', pts: 1, desc: 'Find a dog, get permission from the owner, and get a photo of the whole team petting it. Owner must be visible in the shot.', bonus: [] },
  { id: 104, category: 'quick', title: 'Latvian flag photo', hint: 'Anywhere in Old Town', type: 'photo', pts: 1, desc: 'Spot a Latvian flag (dark red–white–dark red) and get the whole team pointing at it dramatically.', bonus: [] },
  { id: 105, category: 'quick', title: 'Dance for a street musician', hint: 'Anywhere', type: 'photo', pts: 1, desc: 'Find a street musician and dance in front of them for at least 10 seconds. Photo or video proof, musician visible in shot.', video: true, bonus: [] },
  { id: 106, category: 'quick', title: 'Learn a Latvian insult', hint: 'Ask a local', type: 'social', pts: 1, desc: 'Get a local to teach you a Latvian insult on camera. Must be a real local, must say it clearly.', video: true, answerField: { label: 'What insult did you learn?', placeholder: 'Type it here...' }, bonus: [] },
  { id: 107, category: 'quick', title: 'Soviet propaganda pose', hint: 'Find a Soviet-era building', type: 'photo', pts: 1, desc: 'Find a Soviet-era building and strike your best communist propaganda poster pose in front of it. Fists raised, chins up.', bonus: [] },
  { id: 108, category: 'quick', title: 'Mystery menu item', hint: 'Any restaurant or bar', type: 'photo', pts: 1, desc: 'Order something from a menu without knowing what it is — point at a random item and say yes. Photo of the dish when it arrives.', answerField: { label: 'What did you end up ordering?', placeholder: 'e.g. Pig ear soup...' }, bonus: [] },
  { id: 109, category: 'quick', title: 'Team window reflection', hint: 'Any shop window', type: 'photo', pts: 1, desc: "Get a photo of the whole team's reflections in a shop window. Everyone must be identifiable. No mirror cheating.", bonus: [] },
  { id: 110, category: 'quick', title: 'Find someone over 70', hint: 'Anywhere', type: 'social', pts: 1, desc: 'Politely approach someone who looks over 70 and ask for a photo together. They must agree and look at least neutral about it.', bonus: [] },
  { id: 111, category: 'quick', title: 'Spot a cat', hint: 'Old Town has a few', type: 'photo', pts: 1, desc: 'Find a cat anywhere in Old Town. Photo proof required. Bonus if it lets you touch it.', bonus: [] },
  { id: 112, category: 'quick', title: 'Get a bartender to do a shot with you', hint: 'Any bar', type: 'shot', pts: 1, desc: 'Convince a bartender to do a shot with your team. Photo proof — bartender must be visible with a glass raised.', bonus: [] },

  // --- DRINK TASKS (mix of quick and medium) ---
  {
    id: 113, category: 'quick', title: 'Order in Latvian', hint: 'Any bar or café', type: 'shot', pts: 1,
    desc: 'One team member orders a round entirely in Latvian — no English allowed. "Viens alus, lūdzu" = one beer please. Bartender must understand and fill the order. Video of the order.',
    video: true,
    answerField: { label: 'What did you order?', placeholder: 'e.g. Five beers and a Black Balsam' },
    bonus: []
  },
  {
    id: 114, category: 'quick', title: 'Invent a cocktail', hint: 'Any bar', type: 'shot', pts: 1,
    desc: 'Ask the bartender to make you a cocktail they have personally invented or named. Photo of the drink with the bartender confirming it\'s their creation.',
    answerField: { label: 'What was the cocktail called?', placeholder: 'e.g. The Riga Sunset' },
    bonus: []
  },
  {
    id: 115, category: 'quick', title: 'Chug race', hint: 'Any bar', type: 'shot', pts: 1,
    desc: 'Two members from your team race to finish a beer. Photo of the empty glasses raised triumphantly. Stag must be one of the racers.',
    video: true,
    bonus: []
  },
  {
    id: 116, category: 'quick', title: 'Worst beer face', hint: 'Any bar', type: 'photo', pts: 1,
    desc: 'Everyone downs a shot of something strong and the whole team pulls their best disgusted face at exactly the same moment. Photo proof.',
    bonus: []
  },
  {
    id: 201, category: 'medium', title: 'Absinthe challenge', hint: 'Find a bar that serves absinthe', type: 'shot', pts: 2,
    desc: 'Find a bar that serves absinthe and have the whole team do a round the traditional way — spoon, sugar cube, flame. Photo of the ritual in progress.',
    bonus: [
      { id: '201a', pts: 1, text: 'Get the bartender to explain the history of absinthe while you drink it. Video proof.', video: true }
    ]
  },
  {
    id: 202, category: 'medium', title: 'Mystery shot roulette', hint: 'Any bar', type: 'shot', pts: 2,
    desc: 'Ask the bartender to line up 4 mystery shots — one for each team member. Nobody knows what they are until they drink them. Photo of the lineup before, video of the reactions after.',
    video: true,
    answerField: { label: 'What were the shots? (ask the bartender after)', placeholder: 'e.g. Sambuca, Jäger, Tequila, ?' },
    bonus: [
      { id: '202a', pts: 1, text: 'At least one shot is something nobody has ever heard of.' }
    ]
  },
  {
    id: 203, category: 'medium', title: 'Make a bouncer smile', hint: 'Any venue with a bouncer', type: 'social', pts: 2, desc: 'Get a bouncer or security guard to genuinely smile. Photo proof required. No bribing.', bonus: [] },
  {
    id: 204, category: 'medium', title: 'Couple pose recreation', hint: 'Anywhere', type: 'photo', pts: 2, desc: 'Find a couple and recreate their exact pose right next to them. Both the couple and your recreation must be in the same photo.', bonus: []
  },
  {
    id: 205, category: 'medium', title: 'Buy a sub-€2 souvenir', hint: 'Any souvenir shop', type: 'photo', pts: 2, desc: 'Buy a souvenir that costs under €2 and wear or use it visibly for the rest of the hunt. Photo of the purchase receipt plus wearing/using it.', bonus: []
  },
  {
    id: 206, category: 'medium', title: 'Get writing on your arm', hint: 'Find a local', type: 'social', pts: 2, desc: 'Get a local to write anything in Latvian on your arm with a pen. Must be legible. Photo of the writing.', answerField: { label: 'What did they write?', placeholder: 'Type it here...' }, bonus: []
  },
  {
    id: 207, category: 'medium', title: 'Name a mystery church', hint: 'Old Town has several', type: 'trivia', pts: 2, desc: "Find a church that is not the Cathedral or St. Peter's and correctly name it. Photo of the team in front of it.", answerField: { label: 'Name of the church?', placeholder: "e.g. St. John's Church" }, bonus: []
  },
  {
    id: 208, category: 'medium', title: 'Pub golf — hole in one', hint: 'Any bar', type: 'shot', pts: 2,
    desc: 'Down any drink in exactly the number of sips matching your assigned hole number (ask the stag to assign each team a number 1–6). Wrong number of sips = penalty shot. Photo of the scorecards.',
    answerField: { label: 'Which hole number were you assigned?', placeholder: 'e.g. 3' },
    bonus: [
      { id: '208a', pts: 1, text: 'Every member of the team gets a hole-in-one. No penalties.' }
    ]
  },
  {
    id: 209, category: 'medium', title: 'Toast in 5 languages', hint: 'Any bar', type: 'shot', pts: 2,
    desc: 'Before drinking, the team must collectively say "cheers" in 5 different languages. Video of the toast with all 5 languages audible.',
    video: true,
    answerField: { label: 'Which 5 languages did you use?', placeholder: 'e.g. English, Latvian, French, German, Spanish' },
    bonus: [
      { id: '209a', pts: 1, text: 'One of the languages is Latvian — "Priekā!" — said with genuine conviction.' }
    ]
  },

  // --- HARD MISSIONS (3pt) ---
  { id: 301, category: 'hard', title: 'Sing with a stranger', hint: 'Anywhere', type: 'social', pts: 3, desc: 'Get a complete stranger to sing at least one line of a song with you on camera. Must be audible.', video: true, bonus: [] },
  { id: 302, category: 'hard', title: 'Silent communication challenge', hint: 'Anywhere', type: 'task', pts: 3, desc: 'Find someone who speaks no English and successfully communicate something to them using only gestures — then have them communicate something back.', video: true, bonus: [] },
  { id: 303, category: 'hard', title: 'Moving bicycle photo', hint: 'Anywhere', type: 'photo', pts: 3, desc: 'Get a photo of your whole team taken by someone on a bicycle while they are actually riding. The photographer must be visibly on a moving bike in the photo.', bonus: [] },
  {
    id: 304, category: 'hard', title: 'Bar crawl speedrun', hint: 'Old Town', type: 'shot', pts: 3,
    desc: 'Visit 4 different bars and have one drink in each — within 30 minutes. Photo of each drink at each bar with a visible timestamp on the screen.',
    answerField: { label: 'Name the 4 bars you visited', placeholder: 'e.g. Victory Pub, Black Magic, ...' },
    bonus: [
      { id: '304a', pts: 1, text: 'All 4 bars are in walking distance and you made it without running.' },
      { id: '304b', pts: 2, text: 'One of the 4 drinks was a Black Balsam shot.' }
    ]
  },
  {
    id: 305, category: 'hard', title: 'Convince a bar to make the stag a free drink', hint: 'Any bar', type: 'shot', pts: 3,
    desc: "Convince a bar to give the stag a complimentary drink by any means necessary — tell them it's his last day of freedom, perform, beg, whatever it takes. Photo of the stag with the free drink.",
    video: true,
    bonus: [
      { id: '305a', pts: 2, text: 'The bar gives the entire team a free round, not just the stag.' }
    ]
  },
];

module.exports = CHALLENGES;
