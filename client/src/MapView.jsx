import { useEffect, useRef, useState } from 'react'
import { CHALLENGE_COORDS } from './constants.js'

export default function MapView({ state, locations, identity, onChallengeClick, focusChallengeId, clearFocus, showPins = true }) {
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const playerMarkersRef = useRef({})
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [showOthers, setShowOthers] = useState(true)

  useEffect(() => {
    if (window.L) { setReady(true); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return
    const L = window.L
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([56.9490, 24.1070], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    L.control.attribution({ prefix: '© OpenStreetMap' }).addTo(map)
    mapRef.current = map
  }, [ready])

  // Focus challenge + user
  useEffect(() => {
    if (!focusChallengeId || !mapRef.current || !ready) return
    const L = window.L
    const coords = CHALLENGE_COORDS[focusChallengeId]
    if (!coords) return
    const pts = [[coords.lat, coords.lng]]
    const myLoc = identity?.userId && locations[identity.userId]
    if (myLoc) pts.push([myLoc.lat, myLoc.lng])
    if (pts.length === 1) mapRef.current.setView(pts[0], 17)
    else mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [60, 60] })
    markersRef.current[focusChallengeId]?.openPopup()
    clearFocus()
  }, [focusChallengeId, ready])

  // Challenge markers
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const L = window.L; const map = mapRef.current
    if (!showPins) {
      Object.values(markersRef.current).forEach(m => map.removeLayer(m))
      markersRef.current = {}
      return
    }
    state.challenges.filter(ch => CHALLENGE_COORDS[ch.id]).forEach(ch => {
      const coords = CHALLENGE_COORDS[ch.id]
      const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
      const ct = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null
      const bonusDone = ch.bonus?.filter(b => state.claims.some(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)).length || 0
      const color = mainClaim ? (ct?.color || '#1D9E75') : '#1a1a1a'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/><text x="16" y="20" font-size="${mainClaim?'11':'10'}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${mainClaim?'✓':ch.pts+'pt'}</text></svg>`
      const icon = L.divIcon({ html: svg, className:'', iconSize:[32,40], iconAnchor:[16,40], popupAnchor:[0,-44] })
      const popup = `<div style="font-family:sans-serif;min-width:160px"><b style="font-size:13px">${ch.title}</b><br/><span style="font-size:11px;color:#888">${coords.hint}</span><br/><br/><span style="font-size:12px">${mainClaim?`<span style="color:${ct?.color};font-weight:700">✓ ${ct?.name}</span>`:`Unclaimed · ${ch.pts}pt${ch.pts>1?'s':''}`}</span>${ch.bonus?.length?`<br/><span style="font-size:11px;color:#888">${bonusDone}/${ch.bonus.length} bonuses</span>`:''}<br/><button onclick="window.__mapChallenge(${ch.id})" style="margin-top:8px;width:100%;padding:6px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">View challenge</button></div>`
      if (markersRef.current[ch.id]) {
        markersRef.current[ch.id].setIcon(icon).setPopupContent(popup)
      } else {
        markersRef.current[ch.id] = L.marker([coords.lat, coords.lng], { icon }).addTo(map).bindPopup(popup, { closeButton:false, maxWidth:200 })
      }
    })
  }, [state.claims, state.teams, ready, showPins])

  // Player markers
  useEffect(() => {
    if (!ready || !mapRef.current) return
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
      const stale = Math.round((Date.now()-loc.updatedAt)/60000)
      const popup = `<div style="font-family:sans-serif;font-size:12px"><strong style="color:${color}">${loc.name}</strong><br/><span style="color:#888">${loc.teamName||''}${stale>0?` · ${stale}m ago`:' · just now'}</span></div>`
      if (playerMarkersRef.current[loc.userId]) {
        playerMarkersRef.current[loc.userId].setLatLng([loc.lat, loc.lng]).setIcon(icon).setPopupContent(popup)
      } else {
        playerMarkersRef.current[loc.userId] = L.marker([loc.lat, loc.lng], { icon, zIndexOffset:1000 }).addTo(map).bindPopup(popup, { closeButton:false })
      }
    })
    Object.keys(playerMarkersRef.current).forEach(uid => {
      if (!locations[uid] || (!showOthers && uid !== myId)) { map.removeLayer(playerMarkersRef.current[uid]); delete playerMarkersRef.current[uid] }
    })
  }, [locations, showOthers, identity, ready])

  useEffect(() => {
    window.__mapChallenge = (id) => { Object.values(markersRef.current).forEach(m => m.closePopup()); onChallengeClick(id) }
    return () => { delete window.__mapChallenge }
  }, [onChallengeClick])

  const claimedCount = state.challenges.filter(ch => CHALLENGE_COORDS[ch.id] && state.claims.some(c => c.challenge_id === String(ch.id) && !c.is_bonus)).length

  return (
    <div className="map-view">
      <div className="map-toolbar">
        <span className="map-stat">{showPins ? `${claimedCount}/${Object.keys(CHALLENGE_COORDS).length} landmarks done` : 'Riga Old Town'}</span>
        <label className="map-toggle"><input type="checkbox" checked={showOthers} onChange={e => setShowOthers(e.target.checked)} /> Show others</label>
      </div>
      <div ref={containerRef} className="map-container" />
      {!ready && <div className="map-loading">Loading map…</div>}
    </div>
  )
}
