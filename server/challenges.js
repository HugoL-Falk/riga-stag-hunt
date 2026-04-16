const CHALLENGES = [

  // ── LANDMARK CHALLENGES ───────────────────────────────────────────────────

  {
    id: 1, category: 'landmark', title: 'The Swedish Gate inscription', hint: 'Torņa iela 4', type: 'trivia', pts: 2,
    desc: 'Find the year inscribed above the Swedish Gate arch and submit it. Photo of the gate required.',
    answerField: { label: 'What year is inscribed above the arch?', correct: '1698' },
    bonus: [
      { id: '1a', pts: 1, text: 'How many coats of arms are carved into the Swedish Gate?', answerOnly: true, answerField: { label: 'How many coats of arms?', correct: '2' } },
      { id: '1b', pts: 2, text: 'Human toll booth: one team member stands inside the arch and charges at least two strangers "1 smile" to pass through. Video proof.', video: true },
      { id: '1c', pts: 2, text: 'Viking pose: all team members pass through the arch. One person does a full Viking pose — helmet hands, battle cry face.' },
    ]
  },

  {
    id: 2, category: 'landmark', title: 'Three Brothers house age', hint: 'Mazā Pils iela 17–21', type: 'trivia', pts: 2,
    desc: 'Correctly name the century the oldest of the Three Brothers was built. Then upload a photo at the houses.',
    answerField: { label: 'Which century was the oldest brother built?', correct: '15th' },
    bonus: [
      { id: '2a', pts: 1, text: 'How many windows does the oldest Brother have on its facade facing the street?', answerOnly: true, answerField: { label: 'How many windows?', correct: '8' } },
      { id: '2b', pts: 2, text: 'What colour is the oldest brother building? Photo at the houses required.', answerField: { label: 'What colour is the oldest brother?', correct: 'white' } },
      { id: '2c', pts: 2, text: 'Knocking on the door: someone knocks on the door of the oldest brother and waits exactly 10 seconds before accepting no one is home. Full disappointed face required.', video: true },
    ]
  },

  {
    id: 3, category: 'landmark', title: "Riga Cathedral's organ", hint: 'Herdera laukums 6', type: 'trivia', pts: 2,
    desc: "The Cathedral's organ is one of the largest in the world. How many pipes does it have? Look for the information board outside. Photo of team required.",
    answerField: { label: 'How many pipes does the organ have?', correct: '6718' },
    bonus: [
      { id: '3a', pts: 1, text: 'What year was Riga Cathedral founded? Look for the plaque outside.', answerOnly: true, answerField: { label: 'What year was the Cathedral founded?', correct: '1211' } },
      { id: '3b', pts: 2, text: 'Team sings a recognisable hymn for at least 10 seconds outside the Cathedral. Must be audible and deadpan serious.', video: true },
      { id: '3c', pts: 2, text: 'There is a weathervane animal on the Cathedral roof. What animal is it? Photo with the whole team pointing up at it.', answerField: { label: 'What animal is on the weathervane?', correct: 'rooster' } },
    ]
  },

  {
    id: 4, category: 'landmark', title: 'Riga Black Magic Bar', hint: 'Kaļķu iela 10 — bookshelf door', type: 'trivia', pts: 2,
    desc: 'Take a photo of the team as you enter Riga Black Magic Bar through the secret bookshelf entrance. Who invented the Black Balsam recipe?',
    answerField: { label: 'Who invented the Black Balsam recipe?', correct: 'kunze' },
    bonus: [
      { id: '4a', pts: 2, text: 'Every team member does a shot of Riga Black Balsam together. No substitutions. Photo proof.' },
      { id: '4b', pts: 1, text: 'How many herbs, flowers and buds are in the Black Balsam recipe? Take a photo of the bottle.', answerField: { label: 'How many herbs?', correct: '24' } },
      { id: '4c', pts: 2, text: 'Get a photo with the team and a genuinely smiling staff member. Charm is required.' },
    ]
  },

  {
    id: 5, category: 'landmark', title: 'Christmas tree plaque', hint: 'Town Hall Square', type: 'trivia', pts: 2,
    desc: "Find the plaque marking the world's first decorated Christmas tree. What year does it say? Photo of a team member sitting in another member's lap like Santa.",
    answerField: { label: 'What year was the first Christmas tree?', correct: '1510' },
    bonus: [
      { id: '5a', pts: 1, text: 'Which brotherhood erected the Christmas tree according to the plaque?', answerOnly: true, answerField: { label: 'Which brotherhood?', correct: 'blackheads' } },
      { id: '5b', pts: 2, text: 'Christmas tree huddle up: do a football-like huddle where you pump each other up for the hunt. 10 seconds minimum!', video: true },
    ]
  },

  {
    id: 6, category: 'landmark', title: "St. Peter's Church spire height", hint: 'Reformācijas Laukums 1', type: 'trivia', pts: 2,
    desc: "How tall in metres is St. Peter's Church spire? Find it on the information board. Photo of team in a human pyramid outside required.",
    answerField: { label: "How tall is St. Peter's spire in metres?", correct: '123' },
    bonus: [
      { id: '6a', pts: 1, text: "How many distinct tiers does the St. Peter's spire have?", answerOnly: true, answerField: { label: 'How many tiers?', correct: '3' } },
      { id: '6b', pts: 1, text: "What year was St. Peter's Church first mentioned in written records?", answerOnly: true, answerField: { label: 'What year?', correct: '1209' } },
      { id: '6c', pts: 2, text: 'A tourist takes the pyramid photo for you — you must physically hand them your phone. Full team must be in the photo.' },
    ]
  },

  {
    id: 7, category: 'landmark', title: 'Freedom Monument regions', hint: 'Brīvības bulvāris', type: 'trivia', pts: 2,
    desc: 'Name the three historical regions of Latvia represented by the figures held aloft at the top of the Freedom Monument. All three required.',
    answerField: { label: 'Name the three regions (space separated)', correct: 'vidzeme' },
    bonus: [
      { id: '7a', pts: 2, text: 'Shout "For Latvia!" as loud as you can while raising your hand, facing away from the monument! Short video evidence.', video: true },
      { id: '7b', pts: 2, text: 'The team does a sneaky burglar walk past the monument while someone records from a distance.', video: true },
    ]
  },

  {
    id: 8, category: 'landmark', title: 'House of the Blackheads', hint: 'Town Hall Square', type: 'trivia', pts: 2,
    desc: 'The current House of the Blackheads is a reconstruction. What year was it reopened? Look for the plaque.',
    answerField: { label: 'What year was it reopened?', correct: '1999' },
    bonus: [
      { id: '8a', pts: 1, text: 'How many arched windows are on the ground floor of the main facade?', answerOnly: true, answerField: { label: 'How many arched windows?', correct: '3' } },
      { id: '8b', pts: 2, text: 'Full team photo in front of the Blackheads where everyone recreates the poses of the statues on the facade.' },
      { id: '8c', pts: 1, text: 'Find the small Christmas tree plaque nearby and get the whole team pointing at it in one shot.' },
    ]
  },

  {
    id: 9, category: 'landmark', title: 'Cat House', hint: 'Meistaru iela', type: 'trivia', pts: 2,
    desc: 'The famous Cat House has metal cats on its turret rooftops with their tails raised. How many cats are there? Get a photo with the cats clearly visible.',
    answerField: { label: 'How many cats are on the roof?', correct: '2' },
    bonus: [
      { id: '9a', pts: 1, text: 'What street is the Cat House on?', answerOnly: true, answerField: { label: 'What street?', correct: 'meistaru' } },
      { id: '9b', pts: 2, text: 'Nature documentary: one team member narrates the rooftop cats as though they are wild predators stalking prey.', video: true },
    ]
  },

  {
    id: 10, category: 'landmark', title: 'Powder Tower cannonballs', hint: 'Smilšu iela 20', type: 'trivia', pts: 2,
    desc: 'How many cannonballs are embedded in the walls of the Powder Tower? Count them all and submit your total. Photo of the tower required.',
    answerField: { label: 'How many cannonballs?', correct: '12' },
    bonus: [
      { id: '10a', pts: 1, text: 'The Powder Tower dates back to approximately when? Find it on the information board.', answerOnly: true, answerField: { label: 'What year?', correct: '1330' } },
      { id: '10b', pts: 1, text: 'Who shot the cannonballs into the tower?', answerOnly: true, answerField: { label: 'Who shot them?', correct: 'russia' } },
      { id: '10c', pts: 2, text: 'Human cannonball: one person curls into a ball and rolls toward the tower wall as far as physics will allow.', video: true },
    ]
  },

  {
    id: 11, category: 'landmark', title: 'Riga Town Hall statue', hint: 'Town Hall Square', type: 'trivia', pts: 2,
    desc: 'There is a statue in front of Riga Town Hall of a legendary medieval figure who symbolises city freedom. What is his name?',
    answerField: { label: 'What is the name of the statue?', correct: 'roland' },
    bonus: [
      { id: '11a', pts: 1, text: 'How many statues of this figure are there in Riga Town Hall Square?', answerOnly: true, answerField: { label: 'How many statues?', correct: '2' } },
      { id: '11b', pts: 2, text: 'Knight someone: reenact a knighting by the statue — one person kneels, another uses a prop as a sword, rest claps as they are knighted.', video: true },
    ]
  },

  {
    id: 12, category: 'landmark', title: 'Sneaky pint at a pub', hint: 'Any pub in Old Town', type: 'shot', pts: 2,
    desc: 'Dip into a pub and grab a sneaky beer. Photo of the team with drinks in hand.',
    bonus: [
      { id: '12a', pts: 2, text: 'Balsam U-boat: order a Black Balsam shot and sink it into the beer. Video evidence of the reaction.', video: true },
      { id: '12b', pts: 1, text: 'Fish pose: the team holds up one team member in their arms like a caught fish. Look proud!' },
    ]
  },

  // ── QUICK MISSIONS (1pt) ──────────────────────────────────────────────────

  { id: 101, category: 'quick', title: 'Find the amber shop', hint: 'Old Town', type: 'photo', pts: 1, desc: "Amber is Latvia's national gemstone. Find an amber jewellery shop and photograph the team outside it.", bonus: [] },
  { id: 102, category: 'quick', title: 'Find a street cat', hint: 'Old Town', type: 'photo', pts: 1, desc: 'Old Town occasionally has street cats. Find one and photograph your team with it.', bonus: [] },
  { id: 103, category: 'quick', title: 'Spot a red tram', hint: 'Near Old Town', type: 'photo', pts: 1, desc: 'Get a photo with a Riga tram visible. The whole team must be in frame and at least one person must be touching the tram.', bonus: [] },
  { id: 104, category: 'quick', title: 'Latvian flag photo', hint: 'Anywhere in Old Town', type: 'photo', pts: 1, desc: 'Spot a Latvian flag (dark red–white–dark red) and get the whole team pointing at it dramatically.', bonus: [] },
  { id: 105, category: 'quick', title: 'Spot a building older than 1700', hint: 'Old Town', type: 'photo', pts: 1, desc: 'Find and photograph a building with a plaque or sign confirming it was built before 1700.', bonus: [] },
  { id: 106, category: 'quick', title: 'Find a fountain', hint: 'Old Town', type: 'photo', pts: 1, desc: 'Find any fountain in or near Old Town. Full team must be in the photo and at least one person must have wet hands.', bonus: [] },
  { id: 107, category: 'quick', title: 'Soviet propaganda pose', hint: 'Find a Soviet-era building', type: 'photo', pts: 1, desc: 'Find a Soviet-era building and strike your best communist propaganda poster pose in front of it. Fists raised, chins up.', bonus: [] },
  { id: 108, category: 'quick', title: 'Buy something for under €1', hint: 'Any shop', type: 'photo', pts: 1, desc: 'Purchase any item from a shop for under €1. Take a photo of the item.', bonus: [] },
  { id: 109, category: 'quick', title: 'Team window reflection', hint: 'Any shop window', type: 'photo', pts: 1, desc: "Get a photo of the whole team's reflections in a shop window. Everyone must be identifiable.", bonus: [] },
  { id: 110, category: 'quick', title: 'Find someone over 70', hint: 'Anywhere', type: 'social', pts: 1, desc: 'Politely approach someone who looks over 70 and ask for a photo together. They must agree and look at least neutral about it.', bonus: [] },
  { id: 111, category: 'quick', title: 'Spot a cat', hint: 'Old Town has a few', type: 'photo', pts: 1, desc: 'Find a cat anywhere in Old Town. Photo proof required.', bonus: [] },
  { id: 112, category: 'quick', title: 'Get a bartender to do a shot', hint: 'Any bar', type: 'shot', pts: 1, desc: 'Convince a bartender to do a shot with your team. Bartender must be visible with a glass raised.', bonus: [] },
  { id: 113, category: 'quick', title: 'Order in Latvian', hint: 'Any bar or café', type: 'shot', pts: 1, desc: 'One team member orders a round entirely in Latvian — no English allowed. Bartender must understand and fill the order.', video: true, answerField: { label: 'What did you order?' }, bonus: [] },
  { id: 114, category: 'quick', title: 'Invent a cocktail', hint: 'Any bar', type: 'shot', pts: 1, desc: "Ask the bartender to make you a cocktail they have personally invented or named. Photo of the drink with the bartender confirming it's their creation.", answerField: { label: 'What was the cocktail called?' }, bonus: [] },
  { id: 115, category: 'quick', title: 'Chug race', hint: 'Any bar', type: 'shot', pts: 1, desc: 'Two members from your team race to finish a beer. Stag must be one of the racers.', video: true, bonus: [] },
  { id: 116, category: 'quick', title: 'Worst beer face', hint: 'Any bar', type: 'photo', pts: 1, desc: 'Everyone downs a shot of something strong and the whole team pulls their best disgusted face at exactly the same moment.', bonus: [] },
  { id: 117, category: 'quick', title: 'Find a Soviet-era mosaic', hint: 'Look on building facades', type: 'photo', pts: 1, desc: 'Find a mosaic from the Soviet era. Photo of the team in front of it.', bonus: [] },

  // ── MEDIUM MISSIONS (2pt) ─────────────────────────────────────────────────

  { id: 201, category: 'medium', title: 'Buy a stranger a drink', hint: 'Any bar', type: 'social', pts: 2, desc: 'Buy a stranger a drink and get a photo with them holding it. They must look happy about it.', bonus: [] },
  { id: 202, category: 'medium', title: 'Spot a cyclist on cobblestones', hint: 'Old Town', type: 'photo', pts: 2, desc: 'Film a cyclist riding over cobblestones for at least 3 seconds. Whole team must be visible in the background.', video: true, bonus: [] },
  { id: 203, category: 'medium', title: 'Make a bouncer smile', hint: 'Any venue with a bouncer', type: 'social', pts: 2, desc: 'Get a bouncer or security guard to genuinely smile. Photo proof required. No bribing.', bonus: [] },
  { id: 204, category: 'medium', title: 'Couple pose recreation', hint: 'Anywhere', type: 'photo', pts: 2, desc: 'Find a couple and recreate their exact pose right next to them. Both the couple and your recreation must be in the same photo.', bonus: [] },
  { id: 205, category: 'medium', title: 'Buy a sub-€2 souvenir', hint: 'Any souvenir shop', type: 'photo', pts: 2, desc: 'Buy a souvenir that costs under €2 and wear or use it visibly for the rest of the hunt.', bonus: [] },
  { id: 206, category: 'medium', title: 'Get writing on your arm', hint: 'Find a local', type: 'social', pts: 2, desc: 'Get a local to write anything in Latvian on your arm with a pen. Must be legible. Photo of the writing.', answerField: { label: 'What did they write?' }, bonus: [] },
  { id: 207, category: 'medium', title: 'Name a mystery church', hint: 'Old Town has several', type: 'trivia', pts: 2, desc: "Find a church that is not the Cathedral or St. Peter's and correctly name it. Photo of the team in front of it.", answerField: { label: 'Name of the church?' }, bonus: [] },
  { id: 208, category: 'medium', title: 'Latvian Riflemen monument', hint: 'Near the river', type: 'trivia', pts: 2, desc: 'Find the Latvian Riflemen monument and find the year inscribed on it. Photo of the team at the monument required.', answerField: { label: 'What year is on the monument?', correct: '1970' }, bonus: [] },
  { id: 209, category: 'medium', title: 'Toast in 5 languages', hint: 'Any bar', type: 'shot', pts: 2, desc: 'Before drinking, the team must collectively say "cheers" in 5 different languages. Video of the toast with all 5 languages audible.', video: true, answerField: { label: 'Which 5 languages?' }, bonus: [] },
  { id: 210, category: 'medium', title: 'Spot the Daugava River', hint: 'Walk toward the river', type: 'photo', pts: 2, desc: 'Take a photo of the whole team at the riverbank of the Daugava with the river clearly visible behind you.', bonus: [] },
  { id: 211, category: 'medium', title: 'Split the G', hint: 'Any bar serving Guinness', type: 'shot', pts: 2, desc: 'Order a Guinness and split it at the G — has to be a decent split. Video evidence.', video: true, bonus: [] },
  { id: 212, category: 'medium', title: 'Brotherhood of Blackheads crest', hint: 'Look around Old Town', type: 'photo', pts: 2, desc: 'Find the Brotherhood of Blackheads crest somewhere in Old Town beyond just their house. Photo with a team member pointing at it.', bonus: [] },
  { id: 213, category: 'medium', title: 'Riga coat of arms', hint: 'Look on buildings and plaques', type: 'trivia', pts: 2, desc: 'Find the Riga city coat of arms on a building or plaque. What two objects are crossed on it? Take a photo.', answerField: { label: 'What two objects are crossed?', correct: 'keys' }, bonus: [] },

  // ── HARD MISSIONS (3pt) ───────────────────────────────────────────────────

  { id: 301, category: 'hard', title: 'Sing with a stranger', hint: 'Anywhere', type: 'social', pts: 3, desc: 'Get a complete stranger to sing at least one line of a song with you on camera. Must be audible.', video: true, bonus: [] },
  { id: 302, category: 'hard', title: 'Dance for a street musician', hint: 'Anywhere', type: 'social', pts: 3, desc: 'Find a street musician and dance in front of them for at least 10 seconds. Musician visible in shot.', video: true, bonus: [] },
  { id: 303, category: 'hard', title: 'Get a bicycle ride', hint: 'Anywhere', type: 'photo', pts: 3, desc: 'Get a photo of someone in your team being carried or riding with someone on a bicycle while they are actually riding.', bonus: [] },
  { id: 304, category: 'hard', title: 'Spot a Soviet Lada', hint: 'Look around Old Town and surroundings', type: 'photo', pts: 3, desc: 'Find a Soviet-era Lada car still in use. Get a photo with the whole team.', bonus: [] },
  {
    id: 305, category: 'hard', title: 'Convince a bar to give the stag a free drink', hint: 'Any bar', type: 'shot', pts: 3,
    desc: "Convince a bar to give the stag a complimentary drink by any means necessary — tell them it's his last day of freedom, perform, beg, whatever it takes.", video: true,
    bonus: [
      { id: '305a', pts: 2, text: 'The bar gives the entire team a free round, not just the stag.' }
    ]
  },
  { id: 306, category: 'hard', title: 'Locate the hidden courtyard', hint: 'Look for archways and unmarked passageways', type: 'photo', pts: 3, desc: 'Old Town has several hidden courtyards accessible through archways and passageways completely invisible from the street. Find one, photograph the team inside it, and note the address you entered from.', answerField: { label: 'What address did you enter from?' }, bonus: [] },
  { id: 307, category: 'hard', title: 'Find the face in the wall', hint: 'Look above doorways and on building corners', type: 'photo', pts: 3, desc: 'Several Old Town buildings have carved faces, masks or heads embedded in their walls. Find three on three different buildings and photograph each with a team member making the same expression. Upload the best one.', bonus: [] },
  { id: 308, category: 'hard', title: 'Find a barrel organ or hurdy-gurdy', hint: 'Street performers in Old Town', type: 'photo', pts: 3, desc: 'Find a barrel organ or hurdy-gurdy being played in Old Town. Take a photo or video of it with your team.', video: true, bonus: [] },
  { id: 309, category: 'hard', title: 'Bar crawl speedrun', hint: 'Old Town', type: 'shot', pts: 3, desc: 'Visit 4 different bars and have one drink in each — within 30 minutes. Photo of each drink at each bar with a visible timestamp on screen.', answerField: { label: 'Name the 4 bars you visited' }, bonus: [] },

  // ── ADDITIONAL CHALLENGES ────────────────────────────────────────────────

  { id: 118, category: 'quick', title: 'Spot a building that leans', hint: 'Old Town', type: 'photo', pts: 1,
    desc: 'Several Old Town buildings have settled unevenly over the centuries and visibly tilt. Find one that is noticeably not vertical and get a photo of your whole team leaning at the exact same angle as the building.',
    bonus: [] },

  { id: 119, category: 'quick', title: 'Find a drain with a face', hint: 'Look on building facades at head height', type: 'photo', pts: 1,
    desc: 'Some Old Town buildings have decorative downpipes and drainage spouts shaped like faces, animals or grotesques. Find one and photograph it close up with a team member making the exact same expression.',
    bonus: [] },

  { id: 120, category: 'quick', title: 'Find an interesting window display', hint: 'Any shop or apartment window', type: 'photo', pts: 1,
    desc: 'Find something genuinely unexpected visible through a shop or apartment window — a taxidermied animal, a doll collection, a religious icon, a model ship, anything surprising. Photo through the glass.',
    bonus: [] },

  { id: 121, category: 'quick', title: 'The cobblestone gap', hint: 'Any Old Town street', type: 'photo', pts: 1,
    desc: 'Find a gap or patch in the Old Town cobblestones where they have been replaced with different stones or tarmac — evidence of repairs over the centuries. Photograph it with a team member crouching next to it looking like a forensic investigator.',
    bonus: [] },

  { id: 214, category: 'medium', title: 'The narrowest alley', hint: 'Explore the side streets of Old Town', type: 'photo', pts: 2,
    desc: 'Find the narrowest passageway or alley in Old Town that a person can still walk through. Photograph your whole team in it simultaneously — everyone must be touching both walls at the same time.',
    bonus: [] },

  { id: 215, category: 'medium', title: 'Find a repurposed building', hint: 'Old Town', type: 'photo', pts: 2,
    desc: 'Find a building that has been converted from its original purpose — a church that is now a bar, a bank that is now a restaurant, a warehouse that is now a hotel. Find evidence of what it used to be (original signage, architectural features, or a plaque). Photo and answer field for what it used to be.',
    answerField: { label: 'What was this building originally?' },
    bonus: [] },


];

module.exports = CHALLENGES;
