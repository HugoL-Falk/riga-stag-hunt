export const SERVER = import.meta.env.VITE_SERVER_URL || ''
export const STORAGE_KEY = 'stag_identity_v3'
export const TYPE_LABELS = { photo: 'Photo', shot: 'Drinks', task: 'Task', trivia: 'Trivia', social: 'Social' }
export const CAT_LABELS = { landmark: 'Landmark', quick: 'Quick (1pt)', medium: 'Medium (2pt)', hard: 'Hard (3pt)' }

export const CHALLENGE_COORDS = {
  1:  { lat: 56.9514, lng: 24.1064, hint: 'Torņa iela 4' },
  2:  { lat: 56.9504, lng: 24.1043, hint: 'Mazā Pils iela 17–21' },
  3:  { lat: 56.9491, lng: 24.1048, hint: 'Herdera laukums 6' },
  4:  { lat: 56.9487, lng: 24.1089, hint: 'Kaļķu iela 10' },
  5:  { lat: 56.9474, lng: 24.1067, hint: 'Town Hall Square' },
  6:  { lat: 56.9474, lng: 24.1087, hint: 'Reformācijas Laukums 1' },
  7:  { lat: 56.9515, lng: 24.1133, hint: 'Brīvības bulvāris' },
  8:  { lat: 56.9473, lng: 24.1068, hint: 'Town Hall Square' },
  9:  { lat: 56.9490, lng: 24.1060, hint: 'Old Town' },
  10: { lat: 56.9496, lng: 24.1091, hint: 'Līvu laukums' },
  11: { lat: 56.9490, lng: 24.1055, hint: 'Old Town' },
  12: { lat: 56.9488, lng: 24.1067, hint: 'Tirgoņu iela 10' },
}

export const ADMIN_ANSWERS = {
  '1':          { q: 'Swedish Gate — year inscribed?', a: '1698' },
  '1_bonus_1a': { q: 'Swedish Gate — coats of arms?', a: '2' },
  '2':          { q: 'Three Brothers — century built?', a: '15th century (late 1400s)' },
  '2_bonus_2a': { q: 'Three Brothers — how many windows on oldest?', a: '8' },
  '2_bonus_2b': { q: 'Three Brothers — what colour is oldest?', a: 'White' },
  '3':          { q: 'Cathedral organ — how many pipes?', a: '6718' },
  '3_bonus_3a': { q: 'Cathedral — year founded?', a: '1211' },
  '3_bonus_3c': { q: 'Cathedral weathervane — what animal?', a: 'Rooster / cockerel' },
  '4':          { q: 'Black Balsam — who invented it?', a: 'Abraham Kunze (accept: Kunze)' },
  '4_bonus_4b': { q: 'Black Balsam — how many herbs?', a: '24' },
  '5':          { q: 'Christmas tree plaque — what year?', a: '1510' },
  '5_bonus_5a': { q: 'Christmas tree — which brotherhood?', a: 'Brotherhood of Blackheads' },
  '6':          { q: "St. Peter's spire — how tall in metres?", a: '123' },
  '6_bonus_6a': { q: "St. Peter's — how many tiers?", a: '3' },
  '6_bonus_6b': { q: "St. Peter's — year first mentioned?", a: '1209' },
  '7':          { q: 'Freedom Monument — three regions?', a: 'Vidzeme, Kurzeme, Latgale' },
  '8':          { q: 'House of Blackheads — year reopened?', a: '1999' },
  '8_bonus_8a': { q: 'Blackheads — how many arched windows?', a: '3' },
  '9':          { q: 'Cat House — how many cats?', a: '2' },
  '9_bonus_9a': { q: 'Cat House — what street?', a: 'Meistaru iela' },
  '10':         { q: 'Powder Tower — how many cannonballs?', a: '12 (verify on the day — count may vary by section)' },
  '10_bonus_10a': { q: 'Powder Tower — what year?', a: '1330' },
  '10_bonus_10b': { q: 'Powder Tower — who shot them?', a: 'Russia' },
  '11':         { q: 'Town Hall statue — what name?', a: 'Roland' },
  '11_bonus_11a': { q: 'Roland — how many statues in square?', a: '2' },
  '208':        { q: 'Latvian Riflemen monument — what year?', a: '1970' },
  '213':        { q: 'Riga coat of arms — what objects are crossed?', a: 'Two crossed keys' },
  '306':        { q: 'Hidden courtyard — address entered from?', a: 'Any valid Old Town address — judge on the day' },
  '207':        { q: 'Mystery church — name?', a: "St. John's, St. James's, St. George's, St. Jacob's, etc." },
}

export function isVideo(url) {
  return url && /\.(mp4|mov|webm|ogg|quicktime)$/i.test(url)
}

export async function compressImage(file, maxW = 1200, q = 0.65) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      c.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', q)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
