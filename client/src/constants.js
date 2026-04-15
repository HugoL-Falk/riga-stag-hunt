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
  '2':          { q: 'Three Brothers — oldest century?', a: '15th century (late 1400s)' },
  '2_bonus_2a': { q: 'Three Brothers — middle brother style?', a: 'Mannerist (built 1646)' },
  '11':         { q: 'Oldest object — judge lowest year submitted', a: 'Compare team answers' },
  '207':        { q: 'Mystery church name?', a: "St. John's, St. James's, St. George's, etc." },
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
