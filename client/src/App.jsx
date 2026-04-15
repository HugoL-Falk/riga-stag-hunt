import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const SERVER = import.meta.env.VITE_SERVER_URL || ''
const socket = io(SERVER, { transports: ['websocket', 'polling'] })
const TYPE_LABELS = { photo: 'Photo', shot: 'Drinks', task: 'Task', trivia: 'Trivia', social: 'Social' }
const CAT_LABELS = { landmark: 'Landmark Challenges', quick: 'Quick Missions (1pt)', medium: 'Medium Missions (2pt)', hard: 'Hard Missions (3pt)' }
const STORAGE_KEY = 'stag_identity_v2'

const CHALLENGE_COORDS = {
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

// Admin correct answers for display in admin panel
const ADMIN_ANSWERS = {
  '2':    { q: 'Three Brothers — century built?', a: '15th century (late 1400s)' },
  '2_bonus_2a': { q: 'Three Brothers — middle brother style?', a: 'Mannerist (Renaissance/Mannerist, built 1646)' },
  '11':   { q: 'Oldest object — any date is valid', a: 'Judge by lowest year submitted' },
  '207':  { q: 'Mystery church name?', a: 'Any valid church: St. John\'s, St. James\'s, St. George\'s, St. Peter\'s chapel, etc.' },
}

function isVideo(url) { return url && /\.(mp4|mov|webm|ogg|quicktime)$/i.test(url) }

// Client-side image compression before upload
async function compressImage(file, maxWidthPx = 1200, quality = 0.65) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidthPx / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const touchStartX = useRef(null)
  const item = items[idx]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, items.length - 1))
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  return (
    <div className="lightbox"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return
        const diff = touchStartX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) > 50) setIdx(i => diff > 0 ? Math.min(i+1,items.length-1) : Math.max(i-1,0))
        touchStartX.current = null
      }}>
      <div className="lightbox-close">
        <button className="lightbox-back" onClick={onClose}>← Back</button>
        <span className="lightbox-title">{item.title}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, width:'100%', padding:'60px 8px' }}>
        {isVideo(item.url)
          ? <video className="lightbox-video" src={SERVER+item.url} controls autoPlay playsInline />
          : <img className="lightbox-media" src={SERVER+item.url} alt={item.title} />}
      </div>
      {items.length > 1 && (
        <div className="lightbox-nav">
          <button className="lightbox-nav-btn" onClick={() => setIdx(i => Math.max(i-1,0))} disabled={idx===0}>←</button>
          <span className="lightbox-counter">{idx+1} / {items.length}</span>
          <button className="lightbox-nav-btn" onClick={() => setIdx(i => Math.min(i+1,items.length-1))} disabled={idx===items.length-1}>→</button>
        </div>
      )}
    </div>
  )
}

function MediaThumb({ url, title, onClick, size = 44 }) {
  if (!url) return null
  const style = { width:size, height:size, borderRadius:6, objectFit:'cover', display:'block', cursor:'pointer', flexShrink:0 }
  if (isVideo(url)) return <div onClick={onClick} style={{ ...style, background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:size*0.38 }}>▶</div>
  return <img src={SERVER+url} style={style} alt={title||''} onClick={onClick} />
}

// ── Map ───────────────────────────────────────────────────────────────────────
function MapView({ state, locations, identity, onChallengeClick, focusChallengeId, clearFocus }) {
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const playerMarkersRef = useRef({})
  const mapContainerRef = useRef(null)
  const [showOthers, setShowOthers] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (window.L) { setMapReady(true); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setMapReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!mapReady || !mapContainerRef.current || mapRef.current) return
    const L = window.L
    const map = L.map(mapContainerRef.current, { zoomControl: true, attributionControl: false }).setView([56.9490, 24.1070], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    L.control.attribution({ prefix: '© OpenStreetMap' }).addTo(map)
    mapRef.current = map
  }, [mapReady])

  // Focus on challenge + user when triggered from card
  useEffect(() => {
    if (!focusChallengeId || !mapRef.current) return
    const L = window.L
    const coords = CHALLENGE_COORDS[focusChallengeId]
    if (!coords) return
    const points = [[coords.lat, coords.lng]]
    const myLoc = identity?.userId && locations[identity.userId]
    if (myLoc) points.push([myLoc.lat, myLoc.lng])
    if (points.length === 1) {
      mapRef.current.setView(points[0], 17)
    } else {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [60, 60] })
    }
    markersRef.current[focusChallengeId]?.openPopup()
    clearFocus()
  }, [focusChallengeId])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    const L = window.L
    const map = mapRef.current
    state.challenges.filter(ch => CHALLENGE_COORDS[ch.id]).forEach(ch => {
      const coords = CHALLENGE_COORDS[ch.id]
      const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
      const claimTeam = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null
      const bonusDone = ch.bonus?.filter(b => state.claims.some(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)).length || 0
      const color = mainClaim ? (claimTeam?.color || '#1D9E75') : '#1a1a1a'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/><text x="16" y="20" font-size="${mainClaim?'11':'10'}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${mainClaim?'✓':ch.pts+'pt'}</text></svg>`
      const icon = L.divIcon({ html: svg, className:'', iconSize:[32,40], iconAnchor:[16,40], popupAnchor:[0,-42] })
      const popupHtml = `<div style="font-family:sans-serif;min-width:160px"><div style="font-weight:700;font-size:13px;margin-bottom:4px">${ch.title}</div><div style="font-size:11px;color:#888;margin-bottom:6px">${coords.hint}</div><div style="font-size:12px">${mainClaim?`<span style="color:${claimTeam?.color};font-weight:700">✓ ${claimTeam?.name}</span>`:`<span style="color:#888">Unclaimed · ${ch.pts}pt${ch.pts>1?'s':''}</span>`}</div>${ch.bonus?.length?`<div style="font-size:11px;color:#888;margin-top:4px">${bonusDone}/${ch.bonus.length} bonuses</div>`:''}<button onclick="window.__mapChallenge(${ch.id})" style="margin-top:8px;width:100%;padding:6px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-family:sans-serif">View challenge</button></div>`
      if (markersRef.current[ch.id]) {
        markersRef.current[ch.id].setIcon(icon)
        markersRef.current[ch.id].setPopupContent(popupHtml)
      } else {
        markersRef.current[ch.id] = L.marker([coords.lat, coords.lng], { icon }).addTo(map).bindPopup(popupHtml, { closeButton:false, maxWidth:200 })
      }
    })
  }, [state.claims, state.teams, mapReady])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    const L = window.L; const map = mapRef.current
    const myId = identity?.userId
    Object.values(locations).forEach(loc => {
      if (!showOthers && loc.userId !== myId) {
        if (playerMarkersRef.current[loc.userId]) { map.removeLayer(playerMarkersRef.current[loc.userId]); delete playerMarkersRef.current[loc.userId] }
        return
      }
      const color = loc.teamColor || '#888'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="${color}" stroke="white" stroke-width="2.5"/><text x="14" y="14" font-size="11" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${(loc.name||'?')[0].toUpperCase()}</text></svg>`
      const icon = L.divIcon({ html: svg, className:'', iconSize:[28,28], iconAnchor:[14,14] })
      const stale = Math.round((Date.now() - loc.updatedAt) / 60000)
      const popup = `<div style="font-family:sans-serif;font-size:12px"><strong style="color:${color}">${loc.name}</strong><br/><span style="color:#888">${loc.teamName}${stale>0?` · ${stale}m ago`:' · just now'}</span></div>`
      if (playerMarkersRef.current[loc.userId]) {
        playerMarkersRef.current[loc.userId].setLatLng([loc.lat, loc.lng]).setIcon(icon).setPopupContent(popup)
      } else {
        playerMarkersRef.current[loc.userId] = L.marker([loc.lat, loc.lng], { icon, zIndexOffset:1000 }).addTo(map).bindPopup(popup, { closeButton:false })
      }
    })
    Object.keys(playerMarkersRef.current).forEach(uid => {
      if (!locations[uid] || (!showOthers && uid !== myId)) { map.removeLayer(playerMarkersRef.current[uid]); delete playerMarkersRef.current[uid] }
    })
  }, [locations, showOthers, identity])

  useEffect(() => {
    window.__mapChallenge = (id) => { Object.values(markersRef.current).forEach(m => m.closePopup()); onChallengeClick(id) }
    return () => { delete window.__mapChallenge }
  }, [onChallengeClick])

  const claimedCount = state.challenges.filter(ch => CHALLENGE_COORDS[ch.id] && state.claims.some(c => c.challenge_id === String(ch.id) && !c.is_bonus)).length

  return (
    <div className="map-view">
      <div className="map-toolbar">
        <span className="map-stat">{claimedCount}/{Object.keys(CHALLENGE_COORDS).length} landmarks done</span>
        <label className="map-toggle"><input type="checkbox" checked={showOthers} onChange={e => setShowOthers(e.target.checked)} /> Show others</label>
      </div>
      <div ref={mapContainerRef} className="map-container" />
      {!mapReady && <div className="map-loading">Loading map...</div>}
    </div>
  )
}

// ── Location hook ─────────────────────────────────────────────────────────────
function useLocationSharing(identity, enabled) {
  const watchRef = useRef(null)
  const userIdRef = useRef(identity?.userId || ('u_' + Math.random().toString(36).slice(2)))

  useEffect(() => {
    if (!enabled || !identity) {
      if (watchRef.current !== null) { navigator.geolocation?.clearWatch(watchRef.current); watchRef.current = null; socket.emit('location_remove', { userId: userIdRef.current }) }
      return
    }
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      pos => socket.emit('location_update', { userId: userIdRef.current, name: identity.name, teamId: identity.team?.id, teamColor: identity.team?.color, teamName: identity.team?.name, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
    return () => { if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null } }
  }, [enabled, identity])

  return userIdRef.current
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function AdminPanel({ state, onClose }) {
  const [pw, setPw] = useState('')
  const [authed, setAuthed] = useState(false)
  const [msg, setMsg] = useState('')

  async function login() {
    const res = await fetch(`${SERVER}/api/admin/force-claim`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw, team_id: 'test', challenge_id: 'test', is_bonus: false }) })
    if (res.status !== 403) setAuthed(true)
    else setMsg('Wrong password')
  }

  async function forceClaim(challengeId, teamId, isBonus = false) {
    const res = await fetch(`${SERVER}/api/admin/force-claim`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw, team_id: teamId, challenge_id: challengeId, is_bonus: isBonus }) })
    const d = await res.json()
    setMsg(res.ok ? 'Claimed!' : d.error)
    setTimeout(() => setMsg(''), 2000)
  }

  async function removeClaim(challengeId, isBonus = false) {
    const res = await fetch(`${SERVER}/api/admin/remove-claim`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw, challenge_id: challengeId, is_bonus: isBonus }) })
    const d = await res.json()
    setMsg(res.ok ? 'Removed!' : d.error)
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal admin-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3>Admin Panel</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#888' }}>✕</button>
        </div>
        {!authed ? (
          <>
            <p style={{ fontSize:13, color:'#666' }}>Enter admin password</p>
            <input className="modal-input" type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} autoFocus onKeyDown={e => e.key==='Enter'&&login()} />
            {msg && <p style={{ color:'#c00', fontSize:13 }}>{msg}</p>}
            <button className="modal-confirm" onClick={login} style={{ marginTop:4 }}>Login</button>
          </>
        ) : (
          <div className="admin-content">
            {msg && <div className="admin-toast">{msg}</div>}

            <div className="admin-section-title">Correct answers</div>
            {Object.entries(ADMIN_ANSWERS).map(([id, {q,a}]) => (
              <div key={id} className="admin-answer-row">
                <div className="admin-answer-q">{q}</div>
                <div className="admin-answer-a">✓ {a}</div>
              </div>
            ))}

            <div className="admin-section-title" style={{ marginTop:16 }}>Force-claim / override</div>
            <p style={{ fontSize:11, color:'#888', marginBottom:8 }}>Override who has claimed a challenge — useful if there's a dispute.</p>
            {state.challenges.filter(ch => ch.category === 'landmark').map(ch => {
              const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
              const claimTeam = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null
              return (
                <div key={ch.id} className="admin-ch-row">
                  <div className="admin-ch-title">{ch.pts}pt · {ch.title}</div>
                  {mainClaim ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, color: claimTeam?.color, fontWeight:600 }}>✓ {claimTeam?.name}</span>
                      <button className="admin-btn red" onClick={() => removeClaim(String(ch.id))}>Remove</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {state.teams.map(t => (
                        <button key={t.id} className="admin-btn" style={{ borderColor: t.color, color: t.color }} onClick={() => forceClaim(String(ch.id), t.id)}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(null)
  const [view, setView] = useState('hunt')
  const [identity, setIdentity] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } })
  const [filter, setFilter] = useState('all')
  const [unread, setUnread] = useState(0)
  const [showReset, setShowReset] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [messages, setMessages] = useState([])
  const [locations, setLocations] = useState({})
  const [sharing, setSharing] = useState(() => { const s = localStorage.getItem('stag_sharing'); return s === null ? null : s === 'true' })
  const [highlightChallenge, setHighlightChallenge] = useState(null)
  const [mapFocusId, setMapFocusId] = useState(null)
  const challengeRefs = useRef({})
  const viewRef = useRef(view)
  viewRef.current = view

  const userId = useLocationSharing(identity, sharing === true)

  useEffect(() => {
    if (identity && !identity.userId) {
      const updated = { ...identity, userId }
      setIdentity(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }
  }, [userId])

  useEffect(() => {
    socket.on('state_update', s => { setState(s); setMessages(s.messages || []) })
    socket.on('new_message', msg => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      if (viewRef.current !== 'chat') setUnread(u => u + 1)
    })
    socket.on('locations_update', locs => setLocations({ ...locs }))
    return () => { socket.off('state_update'); socket.off('new_message'); socket.off('locations_update') }
  }, [])

  useEffect(() => { if (view === 'chat') setUnread(0) }, [view])
  useEffect(() => {
    if (!state) return
    if (identity && state.teams.length === 0) { window._savedName = identity.name; localStorage.removeItem(STORAGE_KEY); setIdentity(null) }
  }, [state?.teams?.length])

  function saveIdentity(team, name) {
    const id = { team, name, userId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  function goToMap(challengeId) {
    setView('map')
    setMapFocusId(challengeId)
  }

  const handleMapChallengeClick = useCallback((id) => {
    setView('hunt'); setFilter('all'); setHighlightChallenge(id)
    setTimeout(() => { const el = challengeRefs.current[id]; if (el) el.scrollIntoView({ behavior:'smooth', block:'center' }) }, 100)
  }, [])

  if (!state) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:16, color:'#888' }}>Connecting...</div>

  const validTeam = identity ? state.teams.find(t => t.id === identity.team?.id) : null
  if (!identity || !validTeam) return <JoinScreen state={state} onJoin={saveIdentity} />

  const team = validTeam
  const allLandmarksDone = state.challenges.filter(c => c.category === 'landmark').every(c => state.claims.some(cl => cl.challenge_id === String(c.id) && !cl.is_bonus))

  return (
    <div className="app">
      <Header team={team} onDownload={() => window.open(`${SERVER}/api/download/photos`, '_blank')} onReset={() => setShowReset(true)} onAdmin={() => setShowAdmin(true)} />
      {allLandmarksDone && <div className="complete-banner">🏆 All landmark challenges done!</div>}
      {sharing === null && (
        <div className="location-banner">
          <span className="location-banner-text">📍 Share your location on the map?</span>
          <div className="location-banner-actions">
            <button className="loc-btn allow" onClick={() => { setSharing(true); localStorage.setItem('stag_sharing','true') }}>Yes</button>
            <button className="loc-btn deny" onClick={() => { setSharing(false); localStorage.setItem('stag_sharing','false') }}>No thanks</button>
          </div>
        </div>
      )}
      <Scoreboard state={state} activeTeamId={team.id} />
      <nav className="nav">
        <button className={`nav-btn ${view==='hunt'?'active':''}`} onClick={() => setView('hunt')}>Challenges</button>
        <button className={`nav-btn ${view==='map'?'active':''}`} onClick={() => setView('map')}>Map</button>
        <button className={`nav-btn ${view==='chat'?'active':''}`} onClick={() => setView('chat')}>
          Chat {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button className={`nav-btn ${view==='gallery'?'active':''}`} onClick={() => setView('gallery')}>Gallery</button>
      </nav>

      {view === 'hunt' && <HuntView state={state} team={team} filter={filter} setFilter={setFilter} highlightChallenge={highlightChallenge} setHighlightChallenge={setHighlightChallenge} challengeRefs={challengeRefs} onGoToMap={goToMap} />}
      {view === 'map' && <MapView state={state} locations={locations} identity={{ ...identity, userId }} onChallengeClick={handleMapChallengeClick} focusChallengeId={mapFocusId} clearFocus={() => setMapFocusId(null)} />}
      {view === 'chat' && <ChatView messages={messages} state={state} team={team} senderName={identity.name} />}
      {view === 'gallery' && <GalleryView state={state} />}
      {showReset && <ResetModal onClose={() => setShowReset(false)} />}
      {showAdmin && <AdminPanel state={state} onClose={() => setShowAdmin(false)} />}
    </div>
  )
}

// ── JoinScreen ────────────────────────────────────────────────────────────────
function JoinScreen({ state, onJoin }) {
  const [step, setStep] = useState(state.teams.length > 0 ? 'choose' : 'create')
  const [teamName, setTeamName] = useState('')
  const [name, setName] = useState(window._savedName || '')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function createTeam() {
    if (!teamName.trim()) return setErr('Enter a team name')
    if (!name.trim()) return setErr('Enter your name')
    setLoading(true); setErr('')
    try {
      const res = await fetch(`${SERVER}/api/teams`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: teamName }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onJoin(data, name)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo">🍺</div>
        <h1 className="join-title">Riga Stag Hunt</h1>
        <p className="join-sub">13 lads · Old Town · 1 hour</p>
        {step === 'choose' && (
          <>
            <p className="section-label">Pick your team</p>
            <div className="team-list">
              {state.teams.map(t => (
                <button key={t.id} className={`team-pick ${selectedTeam?.id===t.id?'selected':''}`} onClick={() => setSelectedTeam(selectedTeam?.id===t.id?null:t)} style={{ '--tc': t.color }}>
                  <span className="tdot" style={{ background: t.color }} />{t.name}
                  {selectedTeam?.id===t.id && <span style={{ marginLeft:'auto', color:t.color }}>✓</span>}
                </button>
              ))}
            </div>
            <input className="field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="big-btn" onClick={() => { if (!selectedTeam) return setErr('Select a team'); if (!name.trim()) return setErr('Enter your name'); onJoin(selectedTeam, name) }} disabled={!selectedTeam||!name.trim()}>Join team</button>
            <button className="big-btn ghost" onClick={() => { setStep('create'); setErr('') }}>+ Create new team</button>
          </>
        )}
        {step === 'create' && (
          <>
            <input className="field" placeholder="Team name (e.g. The Vikings)" value={teamName} onChange={e => setTeamName(e.target.value)} />
            <input className="field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="big-btn" onClick={createTeam} disabled={loading}>{loading?'Creating...':'Create team'}</button>
            {state.teams.length > 0 && <button className="big-btn ghost" onClick={() => { setStep('choose'); setErr('') }}>← Join existing team</button>}
          </>
        )}
      </div>
    </div>
  )
}

function Header({ team, onDownload, onReset, onAdmin }) {
  return (
    <header className="header">
      <div>
        <div className="header-title">Riga Stag Hunt</div>
        <div className="header-sub" style={{ color: team.color }}><span className="tdot" style={{ background: team.color }} /> {team.name}</div>
      </div>
      <div className="header-actions">
        <button className="dl-btn" onClick={onDownload}>↓ Photos</button>
        <button className="admin-btn-header" onClick={onAdmin}>Admin</button>
        <button className="reset-btn" onClick={onReset}>Reset</button>
      </div>
    </header>
  )
}

function Scoreboard({ state, activeTeamId }) {
  const sorted = [...state.teams].sort((a,b) => (state.scores[b.id]||0)-(state.scores[a.id]||0))
  const max = Math.max(1, ...sorted.map(t => state.scores[t.id]||0))
  return (
    <div className="scoreboard">
      <div className="scoreboard-title">Scoreboard</div>
      <div className="scoreboard-grid">
        {sorted.map((t,i) => {
          const pts = state.scores[t.id]||0
          return (
            <div key={t.id} className={`sc ${t.id===activeTeamId?'active':''} ${i===0&&pts>0?'first':''}`}>
              <div className="sc-rank">#{i+1}</div>
              <div className="sc-name"><span className="tdot" style={{ background: t.color }} />{t.name}</div>
              <div className="sc-pts">{pts}</div>
              <div className="sc-lbl">pts</div>
              {i===0&&pts>0&&<div className="sc-delta">leading</div>}
              <div className="sc-bar"><div className="sc-bar-fill" style={{ width:`${(pts/max)*100}%`, background: t.color }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HuntView({ state, team, filter, setFilter, highlightChallenge, setHighlightChallenge, challengeRefs, onGoToMap }) {
  const cats = ['all','landmark','quick','medium','hard']
  const filtered = filter==='all' ? state.challenges : state.challenges.filter(c => c.category===filter)
  const groups = {}
  filtered.forEach(c => { if (!groups[c.category]) groups[c.category]=[]; groups[c.category].push(c) })
  return (
    <div className="hunt-view">
      <div className="filter-row">
        {cats.map(c => <button key={c} className={`filter-btn ${filter===c?'active':''}`} onClick={() => setFilter(c)}>{c==='all'?'All':CAT_LABELS[c]?.split(' ')[0]}</button>)}
        {highlightChallenge && <button className="filter-btn" style={{ background:'#1D9E75', borderColor:'#1D9E75', color:'#fff' }} onClick={() => setHighlightChallenge(null)}>✕ Show all</button>}
      </div>
      <div className="clist">
        {Object.entries(groups).map(([cat, challenges]) => (
          <div key={cat}>
            <div className="cat-label">{CAT_LABELS[cat]||cat}</div>
            {challenges.map(ch => <ChallengeCard key={ch.id} ch={ch} state={state} team={team} highlighted={highlightChallenge===ch.id} cardRef={el => { if(el) challengeRefs.current[ch.id]=el }} onGoToMap={onGoToMap} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ChallengeCard ─────────────────────────────────────────────────────────────
function ChallengeCard({ ch, state, team, highlighted, cardRef, onGoToMap }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [answer, setAnswer] = useState('')
  const [answerState, setAnswerState] = useState(null) // null | 'checking' | 'correct' | 'wrong'
  const [bonusAnswers, setBonusAnswers] = useState({})
  const [bonusAnswerStates, setBonusAnswerStates] = useState({})
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()
  const bonusFileRefs = useRef({})

  useEffect(() => { if (highlighted) setExpanded(true) }, [highlighted])

  const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
  const claimTeam = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null
  const hasCoords = !!CHALLENGE_COORDS[ch.id]
  const acceptsVideo = ch.video
  const mediaAccept = acceptsVideo ? 'image/*,video/*' : 'image/*'

  async function validateAnswer(challengeId, isBonus, answerText, setStateFn) {
    if (!answerText.trim()) return
    setStateFn('checking')
    try {
      const res = await fetch(`${SERVER}/api/validate-answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ challenge_id: challengeId, is_bonus: isBonus, answer_text: answerText }) })
      const data = await res.json()
      setStateFn(data.correct ? 'correct' : 'wrong')
    } catch { setStateFn('wrong') }
  }

  async function handleClaim(file, challengeId, isBonus, answerText, answerOnly = false) {
    const key = isBonus ? challengeId : 'main'
    setUploading(key)

    let mediaFile = file
    if (file && file.type.startsWith('image/')) {
      mediaFile = await compressImage(file)
    }

    const fd = new FormData()
    if (mediaFile) fd.append('media', mediaFile)
    fd.append('team_id', team.id)
    fd.append('challenge_id', challengeId)
    fd.append('is_bonus', isBonus ? 'true' : 'false')
    if (answerText) fd.append('answer_text', answerText)
    if (answerOnly) fd.append('answer_only', 'true')

    try {
      const res = await fetch(`${SERVER}/api/claim`, { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to claim'); setUploading(null); return }
    } catch { alert('Upload failed. Check your connection.') }
    setUploading(null)
  }

  function buildLightboxItems() {
    const items = []
    if (mainClaim?.photo_url) items.push({ url: mainClaim.photo_url, title: ch.title })
    ch.bonus?.forEach(b => {
      const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
      if (bc?.photo_url) items.push({ url: bc.photo_url, title: `${ch.title} — bonus` })
    })
    return items
  }

  // Remaining unclaimed bonuses
  const unclaimedBonuses = ch.bonus?.filter(b => !state.claims.some(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)) || []
  const claimedBonuses = ch.bonus?.filter(b => state.claims.some(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)) || []

  return (
    <>
      {lightbox !== null && <Lightbox items={buildLightboxItems()} startIndex={lightbox} onClose={() => setLightbox(null)} />}
      <div ref={cardRef} className={`cc ${mainClaim?'fully-done':''} ${highlighted?'highlighted':''}`}>
        <div className="cc-top" onClick={() => setExpanded(e => !e)}>
          <div className={`pts-badge p${Math.min(ch.pts,3)}`}>{ch.pts}pt{ch.pts>1?'s':''}</div>
          <div className="cc-body">
            <div className="cc-row">
              <span className="cc-title">{ch.title}</span>
              <span className={`type-tag t${ch.type}`}>{TYPE_LABELS[ch.type]}</span>
              {acceptsVideo && <span className="video-tag">🎥</span>}
              {hasCoords && (
                <button className="map-pin-btn" onClick={e => { e.stopPropagation(); onGoToMap(ch.id) }} title="Show on map">📍</button>
              )}
            </div>
            <div className="cc-hint">{ch.hint}</div>
            {mainClaim ? (
              <div className="claimed-banner" style={{ background:`${claimTeam?.color}18`, border:`1px solid ${claimTeam?.color}44` }}>
                <div className="claimed-check" style={{ color: claimTeam?.color }}>✓</div>
                <div className="claimed-info">
                  <div className="claimed-team" style={{ color: claimTeam?.color }}>{claimTeam?.name}</div>
                  <div className="claimed-sub">{mainClaim.answer_text&&<span>{mainClaim.answer_text}{mainClaim.answer_correct?' ✓':''} · </span>}claimed</div>
                </div>
                {mainClaim.photo_url && <MediaThumb url={mainClaim.photo_url} title={ch.title} size={44} onClick={e => { e.stopPropagation(); setLightbox(0) }} />}
              </div>
            ) : (
              ch.bonus?.length > 0 && (
                <div className="bonus-summary">
                  {ch.bonus.map(b => { const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`); return <span key={b.id} className={`bonus-dot ${bc?'got':''}`}>+{b.pts}</span> })}
                  <span style={{ fontSize:11, color:'#aaa' }}> bonus</span>
                </div>
              )
            )}

            {/* Show bonus status even when main is claimed */}
            {mainClaim && ch.bonus?.length > 0 && (
              <div className="bonus-summary" style={{ marginTop: 4 }}>
                {ch.bonus.map(b => {
                  const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
                  const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                  return (
                    <span key={b.id} className={`bonus-dot ${bc?'got':''}`} title={bc?`${bt?.name}`:b.text.slice(0,40)}>
                      {bc ? `✓ +${b.pts}` : `+${b.pts}`}
                    </span>
                  )
                })}
                {unclaimedBonuses.length > 0 && <span style={{ fontSize:11, color:'#888' }}> {unclaimedBonuses.length} bonus{unclaimedBonuses.length>1?'es':''} available</span>}
              </div>
            )}
          </div>
          <div className="expand-icon">{expanded?'▲':'▼'}</div>
        </div>

        {expanded && (
          <div className="cc-expanded">
            <p className="cc-desc">{ch.desc}</p>

            {/* Answer field with validate button */}
            {ch.answerField && !mainClaim && (
              <div className="answer-field">
                <div className="answer-label">{ch.answerField.label}</div>
                <div className="answer-input-row">
                  <input className="answer-input" placeholder={ch.answerField.placeholder} value={answer}
                    onChange={e => { setAnswer(e.target.value); setAnswerState(null) }} />
                  <button className="answer-check-btn"
                    onClick={() => validateAnswer(String(ch.id), false, answer, setAnswerState)}
                    disabled={!answer.trim() || answerState==='checking'}>
                    {answerState==='checking' ? '…' : answerState==='correct' ? '✓' : answerState==='wrong' ? '✗' : '✓?'}
                  </button>
                </div>
                {answerState==='correct' && <div className="answer-feedback correct">✓ Correct! {ch.answerField.correct ? 'Now upload your photo.' : ''}</div>}
                {answerState==='wrong' && <div className="answer-feedback wrong">✗ Not quite — try again!</div>}
              </div>
            )}

            {/* Claim button — for answerOnly challenges, no photo needed */}
            {!mainClaim && (
              <div className="claim-area">
                {ch.answerField && ch.answerField.correct && !ch.answerOnly ? (
                  // Has a correct answer AND needs photo — require correct answer first
                  answerState === 'correct' ? (
                    <>
                      <input ref={fileRef} type="file" accept={mediaAccept} capture={acceptsVideo?undefined:'environment'} style={{ display:'none' }}
                        onChange={e => e.target.files[0] && handleClaim(e.target.files[0], String(ch.id), false, answer)} />
                      <button className="claim-btn primary" onClick={() => fileRef.current.click()} disabled={uploading==='main'}>
                        {uploading==='main' ? 'Uploading…' : `📷 Upload photo to claim (+${ch.pts}pt${ch.pts>1?'s':''})`}
                      </button>
                    </>
                  ) : (
                    <div className="claim-hint">Answer correctly above to unlock the upload button</div>
                  )
                ) : (
                  // Normal photo challenge or answerOnly
                  <>
                    <input ref={fileRef} type="file" accept={mediaAccept} capture={acceptsVideo?undefined:'environment'} style={{ display:'none' }}
                      onChange={e => e.target.files[0] && handleClaim(e.target.files[0], String(ch.id), false, answer)} />
                    <button className="claim-btn primary" onClick={() => fileRef.current.click()} disabled={uploading==='main'}>
                      {uploading==='main' ? 'Uploading…' : `${acceptsVideo?'📷/🎥':'📷'} Upload proof to claim (+${ch.pts}pt${ch.pts>1?'s':''})`}
                    </button>
                    {acceptsVideo && <div className="media-hint">Photo or video accepted</div>}
                  </>
                )}
              </div>
            )}

            {/* Bonuses — show even when main is claimed */}
            {ch.bonus?.length > 0 && (
              <div className="bonus-section">
                <div className="bonus-header">Bonus objectives</div>
                {ch.bonus.map(b => {
                  const bonusClaimId = `${ch.id}_bonus_${b.id}`
                  const bc = state.claims.find(c => c.challenge_id === bonusClaimId)
                  const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                  const bAcceptsVideo = b.video
                  const isAnswerOnly = b.answerOnly
                  const bAnswerState = bonusAnswerStates[b.id]
                  const allItems = buildLightboxItems()
                  const bonusIdx = allItems.findIndex(i => i.url === bc?.photo_url)

                  return (
                    <div key={b.id} className={`bonus-row ${bc?'done':''}`}>
                      <span className={`bonus-badge ${bc?'got':''}`}>+{b.pts}pt{b.pts>1?'s':''}</span>
                      <div className="bonus-body">
                        <p className="bonus-text">{b.text}</p>
                        {bc ? (
                          <div className="bonus-claimed" style={{ color: bt?.color }}>
                            <span>✓ {bt?.name}</span>
                            {bc.answer_text && <span style={{ color:'#666', fontWeight:400 }}> {bc.answer_text}</span>}
                            {bc.photo_url && <MediaThumb url={bc.photo_url} size={32} onClick={() => bonusIdx>=0&&setLightbox(bonusIdx)} />}
                          </div>
                        ) : (
                          <>
                            {b.answerField && (
                              <div className="answer-field" style={{ marginBottom:6 }}>
                                <div className="answer-input-row">
                                  <input className="answer-input" style={{ fontSize:13, padding:'7px 9px' }}
                                    placeholder={b.answerField.placeholder}
                                    value={bonusAnswers[b.id]||''}
                                    onChange={e => { setBonusAnswers(a => ({ ...a, [b.id]: e.target.value })); setBonusAnswerStates(s => ({ ...s, [b.id]: null })) }} />
                                  <button className="answer-check-btn"
                                    onClick={() => validateAnswer(bonusClaimId, true, bonusAnswers[b.id]||'', st => setBonusAnswerStates(s => ({ ...s, [b.id]: st })))}
                                    disabled={!bonusAnswers[b.id]?.trim() || bAnswerState==='checking'}>
                                    {bAnswerState==='checking'?'…':bAnswerState==='correct'?'✓':bAnswerState==='wrong'?'✗':'✓?'}
                                  </button>
                                </div>
                                {bAnswerState==='correct' && <div className="answer-feedback correct">✓ Correct!</div>}
                                {bAnswerState==='wrong' && <div className="answer-feedback wrong">✗ Not quite!</div>}
                              </div>
                            )}
                            {isAnswerOnly ? (
                              // Answer-only bonus: claim button appears after correct answer
                              (b.answerField?.correct ? bAnswerState === 'correct' : true) && (
                                <button className="claim-btn small" disabled={uploading===bonusClaimId}
                                  onClick={() => handleClaim(null, bonusClaimId, true, bonusAnswers[b.id], true)}>
                                  {uploading===bonusClaimId ? 'Claiming…' : `Claim bonus +${b.pts}pt${b.pts>1?'s':''}`}
                                </button>
                              )
                            ) : (
                              (!b.answerField?.correct || bAnswerState==='correct') && (
                                <>
                                  <input ref={el => bonusFileRefs.current[b.id]=el} type="file"
                                    accept={bAcceptsVideo?'image/*,video/*':'image/*'}
                                    style={{ display:'none' }}
                                    onChange={e => e.target.files[0] && handleClaim(e.target.files[0], bonusClaimId, true, bonusAnswers[b.id])} />
                                  <button className="claim-btn small" onClick={() => bonusFileRefs.current[b.id]?.click()} disabled={uploading===bonusClaimId}>
                                    {uploading===bonusClaimId ? 'Uploading…' : `${bAcceptsVideo?'📷/🎥':'📷'} Claim bonus`}
                                  </button>
                                </>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── ChatView ──────────────────────────────────────────────────────────────────
function ChatView({ messages, state, team, senderName }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const messagesEndRef = useRef()
  const imageRef = useRef()

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages.length])

  async function selectImage(file) {
    const compressed = await compressImage(file, 1200, 0.65)
    setPendingImage(compressed)
    setPendingPreview(URL.createObjectURL(compressed))
  }

  function clearImage() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingImage(null); setPendingPreview(null)
  }

  async function send() {
    if ((!text.trim() && !pendingImage) || sending) return
    setSending(true)
    const fd = new FormData()
    fd.append('team_id', team.id); fd.append('team_name', team.name); fd.append('team_color', team.color); fd.append('sender_name', senderName)
    fd.append('text', text.trim() || '')
    if (pendingImage) fd.append('image', pendingImage)
    try {
      await fetch(`${SERVER}/api/messages`, { method:'POST', body: fd })
      setText(''); clearImage()
    } catch { alert('Message failed to send') }
    setSending(false)
  }

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">No messages yet. Say something!</p>}
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.team_id===team.id?'mine':''}`}>
            <div className="msg-meta">
              <span className="tdot" style={{ background: m.team_color }} />
              <span className="msg-name">{m.sender_name}</span>
              <span className="msg-team" style={{ color: m.team_color }}>{m.team_name}</span>
              <span className="msg-time">{new Date(m.sent_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div className="msg-bubble" style={m.team_id===team.id?{background:team.color,color:'#fff',border:'none'}:{}}>
              {m.text && m.text !== '📷' && <div>{m.text}</div>}
              {m.image_url && (
                <img src={SERVER+m.image_url} className="chat-img-thumb" alt="attachment"
                  onClick={() => window.open(SERVER+m.image_url,'_blank')} />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending image preview */}
      {pendingPreview && (
        <div className="chat-img-preview">
          <img src={pendingPreview} alt="preview" />
          <button className="chat-img-remove" onClick={clearImage}>✕</button>
        </div>
      )}

      <div className="chat-input-row">
        <input ref={imageRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => e.target.files[0]&&selectImage(e.target.files[0])} />
        <button className="chat-img-btn" onClick={() => imageRef.current.click()} title="Attach image">📷</button>
        <input className="chat-input" placeholder="Message all teams…" value={text}
          onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter'&&!e.shiftKey&&send()} />
        <button className="send-btn" onClick={send} disabled={sending||(!text.trim()&&!pendingImage)} style={{ background: team.color }}>→</button>
      </div>
    </div>
  )
}

// ── GalleryView ───────────────────────────────────────────────────────────────
function GalleryView({ state }) {
  const [lightbox, setLightbox] = useState(null)
  const claimsWithMedia = state.claims.filter(c => c.photo_url)
  const groups = {}
  claimsWithMedia.forEach(c => { const baseId = c.challenge_id.split('_bonus_')[0]; if (!groups[baseId]) groups[baseId]=[]; groups[baseId].push(c) })
  function getCh(id) { return state.challenges.find(c => String(c.id)===id) }
  function getTeam(id) { return state.teams.find(t => t.id===id) }
  return (
    <div className="gallery-view">
      {lightbox && <Lightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <div className="gallery-header">
        <span>{claimsWithMedia.length} file{claimsWithMedia.length!==1?'s':''} uploaded</span>
        <a className="dl-btn" href={`${SERVER}/api/download/photos`} download style={{ background:'#1a1a1a', padding:'6px 11px', borderRadius:7, color:'#fff', textDecoration:'none', fontSize:12 }}>↓ Download all</a>
      </div>
      <div className="gallery-grid">
        {Object.keys(groups).length===0 && <p className="empty-gallery">No photos yet — go claim some challenges!</p>}
        {Object.entries(groups).map(([baseId, claims]) => {
          const ch = getCh(baseId); if (!ch) return null
          const mainC = claims.find(c => !c.is_bonus)
          const mainTeam = mainC ? getTeam(mainC.team_id) : null
          const groupItems = claims.map(c => ({ url: c.photo_url, title: ch.title+(c.is_bonus?' (bonus)':'') }))
          return (
            <div key={baseId} className="gallery-group">
              <div className="gallery-group-header">
                <span className="gallery-group-title">{ch.title}</span>
                {mainTeam && <span className="gallery-group-team" style={{ color: mainTeam.color }}><span className="tdot" style={{ background: mainTeam.color }} />{mainTeam.name}</span>}
              </div>
              <div className="gallery-media-grid">
                {claims.map((c,ci) => (
                  <div key={c.id} className="gallery-item" onClick={() => setLightbox({ items:groupItems, index:ci })}>
                    {isVideo(c.photo_url) ? <div className="gallery-item-video">▶</div> : <img src={SERVER+c.photo_url} alt={ch.title} loading="lazy" />}
                    {c.is_bonus && <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, padding:'3px 5px' }}>bonus</div>}
                  </div>
                ))}
              </div>
              {mainC?.answer_text && <div className="gallery-answer">Answer: <span className={mainC.answer_correct?'answer-correct':'answer-wrong'}>{mainC.answer_text}{mainC.answer_correct?' ✓':''}</span></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ResetModal ────────────────────────────────────────────────────────────────
function ResetModal({ onClose }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  async function doReset() {
    setLoading(true); setErr('')
    try {
      const res = await fetch(`${SERVER}/api/reset`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ secret: code }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error||'Wrong code')
      onClose()
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Reset the hunt?</h3>
        <p>This deletes all teams, scores, photos and messages. Cannot be undone.</p>
        <input className="modal-input" type="password" placeholder="Enter reset code" value={code} onChange={e => setCode(e.target.value)} autoFocus onKeyDown={e => e.key==='Enter'&&doReset()} />
        {err && <p style={{ color:'#c00', fontSize:13 }}>{err}</p>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-confirm" onClick={doReset} disabled={!code||loading}>{loading?'Resetting…':'Reset everything'}</button>
        </div>
      </div>
    </div>
  )
}
