import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import Lightbox from './Lightbox.jsx'
import MapView from './MapView.jsx'
import ResultsView from './ResultsView.jsx'
import AdminPanel from './AdminPanel.jsx'
import { SERVER, STORAGE_KEY, TYPE_LABELS, CAT_LABELS, CHALLENGE_COORDS, isVideo, compressImage } from './constants.js'
import './App.css'

const socket = io(SERVER, { transports: ['websocket', 'polling'] })

// ── Location hook ──────────────────────────────────────────────────────────────
function useLocation(identity, enabled) {
  const watchRef = useRef(null)
  const uid = useRef(identity?.userId || ('u_' + Math.random().toString(36).slice(2)))
  useEffect(() => {
    if (!enabled || !identity) {
      if (watchRef.current !== null) { navigator.geolocation?.clearWatch(watchRef.current); watchRef.current = null; socket.emit('location_remove', { userId: uid.current }) }
      return
    }
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      pos => socket.emit('location_update', { userId: uid.current, name: identity.name, teamId: identity.team?.id, teamColor: identity.team?.color, teamName: identity.team?.name, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
    return () => { if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null } }
  }, [enabled, identity])
  return uid.current
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(huntStatus, huntStartTime, countdownMinutes) {
  const [remaining, setRemaining] = useState(null)
  const [toast30, setToast30] = useState(false)
  const [toast10, setToast10] = useState(false)
  const shown30 = useRef(false)
  const shown10 = useRef(false)

  useEffect(() => {
    if (huntStatus !== 'active' || !huntStartTime) { setRemaining(null); return }
    function tick() {
      const elapsed = (Date.now() - huntStartTime) / 1000
      const total = countdownMinutes * 60
      const rem = Math.max(0, total - elapsed)
      setRemaining(rem)
      const remMin = rem / 60
      if (remMin <= 30.05 && remMin > 29.9 && !shown30.current) { shown30.current = true; setToast30(true); setTimeout(() => setToast30(false), 6000) }
      if (remMin <= 10.05 && remMin > 9.9 && !shown10.current) { shown10.current = true; setToast10(true); setTimeout(() => setToast10(false), 6000) }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [huntStatus, huntStartTime, countdownMinutes])

  return { remaining, toast30, toast10 }
}

function formatTime(secs) {
  if (secs === null) return ''
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2,'0')}`
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(null)
  const [view, setView] = useState('chat')
  const [identity, setIdentity] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } })
  const [filter, setFilter] = useState('all')
  const [unread, setUnread] = useState(0)
  const [showAdmin, setShowAdmin] = useState(false)
  const [messages, setMessages] = useState([])
  const [locations, setLocations] = useState({})
  const [sharing, setSharing] = useState(() => { const s = localStorage.getItem('stag_sharing'); return s === null ? null : s === 'true' })
  const [highlightChallenge, setHighlightChallenge] = useState(null)
  const [mapFocusId, setMapFocusId] = useState(null)
  const [claimToast, setClaimToast] = useState(null)
  const challengeRefs = useRef({})
  const viewRef = useRef(view)
  viewRef.current = view
  const prevHuntStatus = useRef(null)

  const userId = useLocation(identity, sharing === true)
  const { remaining, toast30, toast10 } = useCountdown(state?.huntStatus, state?.huntStartTime, state?.countdownMinutes)

  // Persist userId on identity
  useEffect(() => {
    if (identity && !identity.userId) {
      const updated = { ...identity, userId }
      setIdentity(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }
  }, [userId])

  useEffect(() => {
    socket.on('state_update', s => {
      setState(s); setMessages(s.messages || [])
      // Handle hunt status transitions
      if (prevHuntStatus.current && prevHuntStatus.current !== s.huntStatus) {
        if (s.huntStatus === 'active') setView('hunt')
        if (s.huntStatus === 'finished') setView('chat')
      }
      prevHuntStatus.current = s.huntStatus
    })
    socket.on('new_message', msg => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      if (viewRef.current !== 'chat') setUnread(u => u + 1)
    })
    socket.on('locations_update', locs => setLocations({ ...locs }))
    return () => { socket.off('state_update'); socket.off('new_message'); socket.off('locations_update') }
  }, [])

  useEffect(() => { if (view === 'chat') setUnread(0) }, [view])

  // Reset identity when hunt resets (teams cleared)
  useEffect(() => {
    if (!state) return
    if (identity && state.teams.length === 0) {
      window._savedName = identity.name
      localStorage.removeItem(STORAGE_KEY); setIdentity(null)
    }
  }, [state?.teams?.length])

  // Re-validate player still exists
  useEffect(() => {
    if (!state || !identity) return
    if (identity.playerId && !state.players.find(p => p.id === identity.playerId)) {
      window._savedName = identity.name
      localStorage.removeItem(STORAGE_KEY); setIdentity(null)
    }
  }, [state?.players?.length])

  function saveIdentity(player, team) {
    const id = { playerId: player.id, name: player.name, team, userId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id)); setIdentity(id)
  }

  const goToMap = useCallback((challengeId) => {
    setView('map'); setMapFocusId(challengeId)
  }, [])

  const handleMapChallengeClick = useCallback((id) => {
    setView('hunt'); setFilter('all'); setHighlightChallenge(id)
    setTimeout(() => { const el = challengeRefs.current[id]; if (el) el.scrollIntoView({ behavior:'smooth', block:'center' }) }, 100)
  }, [])

  if (!state) return <div className="loading-screen">Connecting…</div>

  const validTeam = identity?.team ? state.teams.find(t => t.id === identity.team.id) : null
  const validPlayer = identity?.playerId ? state.players.find(p => p.id === identity.playerId) : null

  if (!identity || !validTeam || !validPlayer) {
    return <JoinScreen state={state} onJoin={saveIdentity} />
  }

  const team = validTeam
  const player = validPlayer
  const { huntStatus, resultsEnabled } = state

  // What's visible depends on hunt state
  const showChallenges = huntStatus === 'active'
  const showResults = huntStatus === 'finished' && resultsEnabled
  const showWaiting = huntStatus === 'waiting'
  const showFinished = huntStatus === 'finished' && !resultsEnabled

  const navTabs = [
    { id:'chat', label:'Chat' },
    { id:'map', label:'Map' },
    ...(showChallenges ? [{ id:'hunt', label:'Challenges' }] : []),
    ...(showChallenges ? [{ id:'gallery', label:'Gallery' }] : []),
    ...(showResults ? [{ id:'results', label:'Results 🏆' }] : []),
  ]

  // Ensure view is valid for current state
  const validView = navTabs.find(t => t.id === view) ? view : navTabs[0].id

  return (
    <div className="app">
      <Header team={team} player={player} onAdmin={() => setShowAdmin(true)} remaining={remaining} huntStatus={huntStatus} />

      {/* Countdown toasts */}
      {toast30 && <div className="time-toast warn">⏰ 30 minutes remaining!</div>}
      {toast10 && <div className="time-toast danger">🚨 10 minutes left — wrap it up!</div>}
      {claimToast && <div className="time-toast success">{claimToast}</div>}

      {/* Location prompt */}
      {sharing === null && huntStatus !== 'waiting' && (
        <div className="location-banner">
          <span>📍 Share your location on the map?</span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="loc-btn allow" onClick={() => { setSharing(true); localStorage.setItem('stag_sharing','true') }}>Yes</button>
            <button className="loc-btn deny" onClick={() => { setSharing(false); localStorage.setItem('stag_sharing','false') }}>No thanks</button>
          </div>
        </div>
      )}

      {/* Scoreboard — hidden during active hunt, shown otherwise */}
      {huntStatus !== 'active' && showResults && <Scoreboard state={state} activeTeamId={team.id} />}

      <nav className="nav">
        {navTabs.map(t => (
          <button key={t.id} className={`nav-btn ${validView===t.id?'active':''}`} onClick={() => setView(t.id)}>
            {t.label}{t.id==='chat'&&unread>0&&<span className="badge">{unread}</span>}
          </button>
        ))}
      </nav>

      {/* Main content area */}
      {showWaiting && validView !== 'chat' && validView !== 'map' && (
        <WaitingRoom state={state} player={player} team={team} />
      )}
      {showFinished && validView !== 'chat' && validView !== 'map' && (
        <FinishedScreen />
      )}

      {validView === 'hunt' && showChallenges && (
        <HuntView state={state} team={team} filter={filter} setFilter={setFilter}
          highlightChallenge={highlightChallenge} setHighlightChallenge={setHighlightChallenge}
          challengeRefs={challengeRefs} onGoToMap={goToMap}
          onClaimed={msg => { setClaimToast(msg); setTimeout(() => setClaimToast(null), 3000) }} />
      )}
      {validView === 'map' && (
        <MapView state={state} locations={locations} identity={{ ...identity, userId }}
          onChallengeClick={handleMapChallengeClick} focusChallengeId={mapFocusId}
          clearFocus={() => setMapFocusId(null)} showPins={huntStatus === 'active'} />
      )}
      {validView === 'chat' && (
        <ChatView messages={messages} state={state} team={team} player={player} huntStatus={huntStatus} />
      )}
      {validView === 'gallery' && showChallenges && <GalleryView state={state} />}
      {validView === 'results' && showResults && <ResultsView state={state} />}

      {showAdmin && <AdminPanel state={state} onClose={() => setShowAdmin(false)} />}
    </div>
  )
}

// ── JoinScreen ────────────────────────────────────────────────────────────────
function JoinScreen({ state, onJoin }) {
  const [step, setStep] = useState(state.teams.length > 0 ? 'choose' : 'create')
  const [name, setName] = useState(window._savedName || '')
  const [teamName, setTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function createTeam() {
    if (!name.trim()) return setErr('Enter your name')
    if (!teamName.trim()) return setErr('Enter a team name')
    setLoading(true); setErr('')
    try {
      const tr = await fetch(`${SERVER}/api/teams`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: teamName }) })
      const team = await tr.json()
      if (!tr.ok) throw new Error(team.error)
      const pr = await fetch(`${SERVER}/api/players/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: name.trim(), team_id: team.id }) })
      const player = await pr.json()
      if (!pr.ok) throw new Error(player.error)
      onJoin(player, team)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  async function joinTeam() {
    if (!name.trim()) return setErr('Enter your name')
    if (!selectedTeam) return setErr('Select a team')
    setLoading(true); setErr('')
    try {
      const pr = await fetch(`${SERVER}/api/players/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: name.trim(), team_id: selectedTeam.id }) })
      const player = await pr.json()
      if (!pr.ok) throw new Error(player.error)
      onJoin(player, selectedTeam)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div style={{ fontSize:40, textAlign:'center' }}>🍺</div>
        <h1 className="join-title">Riga Stag Hunt</h1>
        <p className="join-sub">13 lads · Old Town · 1 hour</p>

        <input className="field" placeholder="Your name" value={name} onChange={e => { setName(e.target.value); setErr('') }} />

        {step === 'choose' && state.teams.length > 0 && (
          <>
            <p className="section-label">Pick your team</p>
            <div className="team-list">
              {state.teams.map(t => (
                <button key={t.id} className={`team-pick ${selectedTeam?.id===t.id?'selected':''}`}
                  onClick={() => setSelectedTeam(selectedTeam?.id===t.id?null:t)} style={{ '--tc': t.color }}>
                  <span className="tdot" style={{ background: t.color }} />{t.name}
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#aaa' }}>{state.players.filter(p=>p.team_id===t.id).length} joined</span>
                  {selectedTeam?.id===t.id && <span style={{ color:t.color }}>✓</span>}
                </button>
              ))}
            </div>
            {err && <p className="form-err">{err}</p>}
            <button className="big-btn" onClick={joinTeam} disabled={loading||!selectedTeam||!name.trim()}>{loading?'Joining…':'Join team'}</button>
            <button className="big-btn ghost" onClick={() => { setStep('create'); setErr('') }}>+ Create new team</button>
          </>
        )}

        {(step === 'create' || state.teams.length === 0) && (
          <>
            <input className="field" placeholder="New team name" value={teamName} onChange={e => { setTeamName(e.target.value); setErr('') }} />
            {err && <p className="form-err">{err}</p>}
            <button className="big-btn" onClick={createTeam} disabled={loading||!name.trim()||!teamName.trim()}>{loading?'Creating…':'Create team & join'}</button>
            {state.teams.length > 0 && <button className="big-btn ghost" onClick={() => { setStep('choose'); setErr('') }}>← Join existing team</button>}
          </>
        )}
      </div>
    </div>
  )
}

// ── WaitingRoom ───────────────────────────────────────────────────────────────
function WaitingRoom({ state, player, team }) {
  const [readying, setReadying] = useState(false)
  const isReady = !!player.ready

  async function toggleReady() {
    setReadying(true)
    await fetch(`${SERVER}/api/players/${player.id}/ready`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ready: !isReady }) })
    setReadying(false)
  }

  return (
    <div className="waiting-room">
      <div className="waiting-title">Waiting for the hunt to start…</div>
      <p className="waiting-sub">The organiser will start the hunt shortly. Get chatting and get your team ready!</p>

      <button className={`ready-btn ${isReady?'ready':''}`} onClick={toggleReady} disabled={readying}>
        {isReady ? '✓ You are ready!' : 'Tap when you\'re ready'}
      </button>

      <div className="teams-list">
        {state.teams.map(t => {
          const members = state.players.filter(p => p.team_id === t.id)
          const allReady = members.length > 0 && members.every(p => p.ready)
          return (
            <div key={t.id} className={`waiting-team ${allReady?'all-ready':''}`}>
              <div className="waiting-team-header">
                <span className="tdot" style={{ background: t.color }} />
                <span className="waiting-team-name" style={{ color: t.color }}>{t.name}</span>
                {allReady && <span className="all-ready-badge">All ready!</span>}
              </div>
              <div className="waiting-members">
                {members.map(m => (
                  <div key={m.id} className="waiting-member">
                    <span className={`ready-dot ${m.ready?'ready':''}`} />
                    <span>{m.name}</span>
                  </div>
                ))}
                {members.length === 0 && <span style={{ fontSize:12, color:'#aaa' }}>No members yet</span>}
              </div>
            </div>
          )
        })}
        {/* Unassigned */}
        {state.players.filter(p => !p.team_id).length > 0 && (
          <div className="waiting-team">
            <div className="waiting-team-header"><span style={{ fontSize:13, color:'#888' }}>No team</span></div>
            {state.players.filter(p => !p.team_id).map(m => (
              <div key={m.id} className="waiting-member"><span className={`ready-dot ${m.ready?'ready':''}`} /><span>{m.name}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── FinishedScreen ────────────────────────────────────────────────────────────
function FinishedScreen() {
  return (
    <div className="finished-screen">
      <div className="finished-icon">🎉</div>
      <h2 className="finished-title">Hunt complete!</h2>
      <p className="finished-sub">Make your way back to the pub. Results will be revealed shortly…</p>
      <p className="finished-hint">Keep chatting while you wait!</p>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ team, player, onAdmin, remaining, huntStatus }) {
  return (
    <header className="header">
      <div>
        <div className="header-title">Riga Stag Hunt</div>
        <div className="header-sub" style={{ color: team.color }}>
          <span className="tdot" style={{ background: team.color }} /> {team.name} · {player.name}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {huntStatus === 'active' && remaining !== null && (
          <div className={`countdown ${remaining < 600 ? 'danger' : remaining < 1800 ? 'warn' : ''}`}>
            ⏱ {formatTime(remaining)}
          </div>
        )}
        <button className="admin-btn-header" onClick={onAdmin}>Admin</button>
      </div>
    </header>
  )
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
function Scoreboard({ state, activeTeamId }) {
  const sorted = [...state.teams].sort((a,b) => (state.scores[b.id]||0)-(state.scores[a.id]||0))
  const max = Math.max(1, ...sorted.map(t => state.scores[t.id]||0))
  return (
    <div className="scoreboard">
      <div className="scoreboard-title">Final scores</div>
      <div className="scoreboard-grid">
        {sorted.map((t,i) => {
          const pts = state.scores[t.id]||0
          return (
            <div key={t.id} className={`sc ${t.id===activeTeamId?'active':''} ${i===0&&pts>0?'first':''}`}>
              <div className="sc-rank">#{i+1}</div>
              <div className="sc-name"><span className="tdot" style={{ background:t.color }} />{t.name}</div>
              <div className="sc-pts">{pts}</div>
              <div className="sc-lbl">pts</div>
              <div className="sc-bar"><div className="sc-bar-fill" style={{ width:`${(pts/max)*100}%`, background:t.color }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── HuntView ──────────────────────────────────────────────────────────────────
function HuntView({ state, team, filter, setFilter, highlightChallenge, setHighlightChallenge, challengeRefs, onGoToMap, onClaimed }) {
  const cats = ['all','landmark','quick','medium','hard']
  const filtered = filter==='all' ? state.challenges : state.challenges.filter(c => c.category===filter)
  const groups = {}
  filtered.forEach(c => { if (!groups[c.category]) groups[c.category]=[]; groups[c.category].push(c) })

  return (
    <div className="hunt-view">
      <div className="filter-row">
        {cats.map(c => <button key={c} className={`filter-btn ${filter===c?'active':''}`} onClick={() => setFilter(c)}>{c==='all'?'All':CAT_LABELS[c]?.split(' ')[0]||c}</button>)}
        {highlightChallenge && <button className="filter-btn" style={{ background:'#1D9E75',borderColor:'#1D9E75',color:'#fff' }} onClick={() => setHighlightChallenge(null)}>✕ Show all</button>}
      </div>
      <div className="clist">
        {Object.entries(groups).map(([cat, challenges]) => (
          <div key={cat}>
            <div className="cat-label">{CAT_LABELS[cat]||cat}</div>
            {challenges.map(ch => (
              <ChallengeCard key={ch.id} ch={ch} state={state} team={team}
                highlighted={highlightChallenge===ch.id}
                cardRef={el => { if(el) challengeRefs.current[ch.id]=el }}
                onGoToMap={onGoToMap} onClaimed={onClaimed} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ChallengeCard ──────────────────────────────────────────────────────────────
function ChallengeCard({ ch, state, team, highlighted, cardRef, onGoToMap, onClaimed }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [answer, setAnswer] = useState('')
  const [answerState, setAnswerState] = useState(null)
  const [bonusAnswers, setBonusAnswers] = useState({})
  const [bonusAnswerStates, setBonusAnswerStates] = useState({})
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()
  const bonusFileRefs = useRef({})

  useEffect(() => { if (highlighted) setExpanded(true) }, [highlighted])

  const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
  const claimTeam = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null
  const hasCoords = !!CHALLENGE_COORDS[ch.id]

  async function validateAnswer(challengeId, isBonus, answerText, setFn) {
    if (!answerText?.trim()) return
    setFn('checking')
    try {
      const res = await fetch(`${SERVER}/api/validate-answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ challenge_id: challengeId, is_bonus: isBonus, answer_text: answerText }) })
      const d = await res.json()
      setFn(d.correct ? 'correct' : 'wrong')
    } catch { setFn('wrong') }
  }

  async function handleClaim(file, challengeId, isBonus, answerText, answerOnly = false) {
    const key = isBonus ? challengeId : 'main'
    setUploading(key)
    let mediaFile = file
    if (file?.type.startsWith('image/')) mediaFile = await compressImage(file)
    const fd = new FormData()
    if (mediaFile) fd.append('media', mediaFile)
    fd.append('team_id', team.id)
    fd.append('challenge_id', challengeId)
    fd.append('is_bonus', isBonus ? 'true' : 'false')
    if (answerText) fd.append('answer_text', answerText)
    if (answerOnly) fd.append('answer_only', 'true')
    try {
      const res = await fetch(`${SERVER}/api/claim`, { method:'POST', body: fd })
      const d = await res.json()
      if (!res.ok) { alert(d.error || 'Failed'); setUploading(null); return }
      const pts = isBonus ? (ch.bonus?.find(b => b.id === challengeId.split('_bonus_')[1])?.pts || 1) : ch.pts
      onClaimed?.(`+${pts}pt${pts!==1?'s':''} claimed for ${team.name}!`)
    } catch { alert('Upload failed. Check your connection.') }
    setUploading(null)
  }

  function buildLbItems() {
    const items = []
    if (mainClaim?.photo_url) items.push({ url: mainClaim.photo_url, title: ch.title })
    ch.bonus?.forEach(b => {
      const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
      if (bc?.photo_url) items.push({ url: bc.photo_url, title: `${ch.title} — bonus` })
    })
    return items
  }

  const unclaimedBonuses = ch.bonus?.filter(b => !state.claims.some(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)) || []

  return (
    <>
      {lightbox !== null && <Lightbox items={buildLbItems()} startIndex={lightbox} onClose={() => setLightbox(null)} />}
      <div ref={cardRef} className={`cc ${mainClaim?'fully-done':''} ${highlighted?'highlighted':''}`}>
        <div className="cc-top" onClick={() => setExpanded(e => !e)}>
          <div className={`pts-badge p${Math.min(ch.pts,3)}`}>{ch.pts}pt{ch.pts>1?'s':''}</div>
          <div className="cc-body">
            <div className="cc-row">
              <span className="cc-title">{ch.title}</span>
              <span className={`type-tag t${ch.type}`}>{TYPE_LABELS[ch.type]}</span>
              {ch.video && <span className="video-tag">🎥</span>}
              {hasCoords && <button className="map-pin-btn" onClick={e => { e.stopPropagation(); onGoToMap(ch.id) }}>📍</button>}
            </div>
            <div className="cc-hint">{ch.hint}</div>
            {mainClaim ? (
              <div className="claimed-banner" style={{ background:`${claimTeam?.color}18`, border:`1px solid ${claimTeam?.color}44` }}>
                <span className="claimed-check" style={{ color:claimTeam?.color }}>✓</span>
                <div className="claimed-info">
                  <div className="claimed-team" style={{ color:claimTeam?.color }}>{claimTeam?.name}</div>
                  <div className="claimed-sub">{mainClaim.answer_text&&<span>{mainClaim.answer_text}{mainClaim.answer_correct?' ✓':''} · </span>}claimed</div>
                </div>
                {mainClaim.photo_url && <div onClick={e=>{e.stopPropagation();setLightbox(0)}} style={{ flexShrink:0 }}><MediaThumb url={mainClaim.photo_url} size={44} /></div>}
              </div>
            ) : ch.bonus?.length > 0 && (
              <div className="bonus-summary">
                {ch.bonus.map(b => { const bc=state.claims.find(c=>c.challenge_id===`${ch.id}_bonus_${b.id}`); return <span key={b.id} className={`bonus-dot ${bc?'got':''}`}>+{b.pts}</span> })}
                <span style={{ fontSize:11,color:'#aaa' }}> bonus</span>
              </div>
            )}
            {/* Show bonus status even when main is claimed */}
            {mainClaim && ch.bonus?.length > 0 && (
              <div className="bonus-summary" style={{ marginTop:4 }}>
                {ch.bonus.map(b => {
                  const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
                  const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                  return <span key={b.id} className={`bonus-dot ${bc?'got':''}`} title={bc?`${bt?.name}`:b.text.slice(0,40)}>{bc?`✓ +${b.pts}`:`+${b.pts}`}</span>
                })}
                {unclaimedBonuses.length > 0 && <span style={{ fontSize:11,color:'#888' }}> {unclaimedBonuses.length} bonus{unclaimedBonuses.length>1?'es':''} available</span>}
              </div>
            )}
          </div>
          <div className="expand-icon">{expanded?'▲':'▼'}</div>
        </div>

        {expanded && (
          <div className="cc-expanded">
            <p className="cc-desc">{ch.desc}</p>

            {ch.answerField && !mainClaim && (
              <div className="answer-field">
                <div className="answer-label">{ch.answerField.label}</div>
                <div className="answer-input-row">
                  <input className="answer-input" placeholder={ch.answerField.placeholder} value={answer}
                    onChange={e => { setAnswer(e.target.value); setAnswerState(null) }} />
                  <button className={`answer-check-btn ${answerState||''}`}
                    onClick={() => validateAnswer(String(ch.id), false, answer, setAnswerState)}
                    disabled={!answer.trim()||answerState==='checking'}>
                    {answerState==='checking'?'…':answerState==='correct'?'✓':answerState==='wrong'?'✗':'✓?'}
                  </button>
                </div>
                {answerState==='correct' && <div className="answer-feedback correct">✓ Correct!{ch.answerField.correct?' Now upload your photo.':''}</div>}
                {answerState==='wrong' && <div className="answer-feedback wrong">✗ Not quite — try again!</div>}
              </div>
            )}

            {!mainClaim && (
              <div className="claim-area">
                {ch.answerField?.correct && !mainClaim ? (
                  answerState === 'correct' ? (
                    <>
                      <input ref={fileRef} type="file" accept={ch.video?'image/*,video/*':'image/*'} capture={ch.video?undefined:'environment'} style={{ display:'none' }}
                        onChange={e => e.target.files[0]&&handleClaim(e.target.files[0], String(ch.id), false, answer)} />
                      <button className="claim-btn primary" onClick={() => fileRef.current.click()} disabled={uploading==='main'}>
                        {uploading==='main'?'Uploading…':`${ch.video?'📷/🎥':'📷'} Upload to claim (+${ch.pts}pt${ch.pts>1?'s':''})`}
                      </button>
                    </>
                  ) : <div className="claim-hint">Answer correctly above to unlock upload</div>
                ) : (
                  <>
                    <input ref={fileRef} type="file" accept={ch.video?'image/*,video/*':'image/*'} capture={ch.video?undefined:'environment'} style={{ display:'none' }}
                      onChange={e => e.target.files[0]&&handleClaim(e.target.files[0], String(ch.id), false, answer)} />
                    <button className="claim-btn primary" onClick={() => fileRef.current.click()} disabled={uploading==='main'}>
                      {uploading==='main'?'Uploading…':`${ch.video?'📷/🎥':'📷'} Upload proof (+${ch.pts}pt${ch.pts>1?'s':''})`}
                    </button>
                    {ch.video && <div className="media-hint">Photo or video accepted</div>}
                  </>
                )}
              </div>
            )}

            {ch.bonus?.length > 0 && (
              <div className="bonus-section">
                <div className="bonus-header">Bonus objectives</div>
                {ch.bonus.map(b => {
                  const bonusClaimId = `${ch.id}_bonus_${b.id}`
                  const bc = state.claims.find(c => c.challenge_id === bonusClaimId)
                  const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                  const bAnswerState = bonusAnswerStates[b.id]
                  const lbItems = buildLbItems()
                  const bIdx = lbItems.findIndex(i => i.url === bc?.photo_url)

                  return (
                    <div key={b.id} className={`bonus-row ${bc?'done':''}`}>
                      <span className={`bonus-badge ${bc?'got':''}`}>+{b.pts}pt{b.pts>1?'s':''}</span>
                      <div className="bonus-body">
                        <p className="bonus-text">{b.text}</p>
                        {b.answerField && !bc && (
                          <div className="answer-field" style={{ marginBottom:6 }}>
                            <div className="answer-input-row">
                              <input className="answer-input" style={{ fontSize:13,padding:'7px 9px' }} placeholder={b.answerField.placeholder}
                                value={bonusAnswers[b.id]||''} onChange={e => { setBonusAnswers(a=>({...a,[b.id]:e.target.value})); setBonusAnswerStates(s=>({...s,[b.id]:null})) }} />
                              <button className={`answer-check-btn ${bAnswerState||''}`}
                                onClick={() => validateAnswer(bonusClaimId, true, bonusAnswers[b.id]||'', st => setBonusAnswerStates(s=>({...s,[b.id]:st})))}
                                disabled={!bonusAnswers[b.id]?.trim()||bAnswerState==='checking'}>
                                {bAnswerState==='checking'?'…':bAnswerState==='correct'?'✓':bAnswerState==='wrong'?'✗':'✓?'}
                              </button>
                            </div>
                            {bAnswerState==='correct'&&<div className="answer-feedback correct">✓ Correct!</div>}
                            {bAnswerState==='wrong'&&<div className="answer-feedback wrong">✗ Not quite!</div>}
                          </div>
                        )}
                        {bc ? (
                          <div className="bonus-claimed" style={{ color:bt?.color }}>
                            ✓ {bt?.name}{bc.answer_text&&<span style={{ color:'#666',fontWeight:400 }}> {bc.answer_text}</span>}
                            {bc.photo_url && <MediaThumb url={bc.photo_url} size={32} onClick={() => bIdx>=0&&setLightbox(bIdx)} />}
                          </div>
                        ) : b.answerOnly ? (
                          (!b.answerField?.correct || bAnswerState==='correct') && (
                            <button className="claim-btn small" disabled={uploading===bonusClaimId}
                              onClick={() => handleClaim(null, bonusClaimId, true, bonusAnswers[b.id], true)}>
                              {uploading===bonusClaimId?'Claiming…':`Claim bonus +${b.pts}pt${b.pts>1?'s':''}`}
                            </button>
                          )
                        ) : (
                          (!b.answerField?.correct || bAnswerState==='correct') && (
                            <>
                              <input ref={el=>bonusFileRefs.current[b.id]=el} type="file" accept={b.video?'image/*,video/*':'image/*'} style={{ display:'none' }}
                                onChange={e => e.target.files[0]&&handleClaim(e.target.files[0], bonusClaimId, true, bonusAnswers[b.id])} />
                              <button className="claim-btn small" onClick={() => bonusFileRefs.current[b.id]?.click()} disabled={uploading===bonusClaimId}>
                                {uploading===bonusClaimId?'Uploading…':`${b.video?'📷/🎥':'📷'} Claim bonus`}
                              </button>
                            </>
                          )
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

function MediaThumb({ url, size=44, onClick }) {
  if (!url) return null
  const s = { width:size, height:size, borderRadius:6, objectFit:'cover', display:'block', cursor:'pointer', flexShrink:0 }
  if (isVideo(url)) return <div onClick={onClick} style={{ ...s, background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:size*0.38 }}>▶</div>
  return <img src={SERVER+url} style={s} alt="" onClick={onClick} />
}

// ── ChatView ──────────────────────────────────────────────────────────────────
function ChatView({ messages, state, team, player, huntStatus }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImg, setPendingImg] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const endRef = useRef()
  const imgRef = useRef()

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages.length])

  async function selectImg(file) {
    const c = await compressImage(file, 1200, 0.65)
    setPendingImg(c); setPendingPreview(URL.createObjectURL(c))
  }
  function clearImg() { if (pendingPreview) URL.revokeObjectURL(pendingPreview); setPendingImg(null); setPendingPreview(null) }

  async function send() {
    if ((!text.trim() && !pendingImg) || sending) return
    setSending(true)
    const fd = new FormData()
    fd.append('player_id', player.id)
    fd.append('team_id', team.id); fd.append('team_name', team.name); fd.append('team_color', team.color)
    fd.append('sender_name', player.name); fd.append('text', text.trim())
    if (pendingImg) fd.append('image', pendingImg)
    try { await fetch(`${SERVER}/api/messages`, { method:'POST', body: fd }); setText(''); clearImg() }
    catch { alert('Failed to send') }
    setSending(false)
  }

  const disabled = huntStatus === 'finished' && false // chat always enabled

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">{huntStatus==='waiting'?'Hunt starting soon — say hi!':'No messages yet. Say something!'}</p>}
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.team_id===team.id?'mine':''}`}>
            <div className="msg-meta">
              <span className="tdot" style={{ background:m.team_color }} />
              <span className="msg-name">{m.sender_name}</span>
              <span className="msg-team" style={{ color:m.team_color }}>{m.team_name}</span>
              <span className="msg-time">{new Date(m.sent_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div className="msg-bubble" style={m.team_id===team.id?{background:team.color,color:'#fff',border:'none'}:{}}>
              {m.text && m.text !== '📷' && <div>{m.text}</div>}
              {m.image_url && <img src={SERVER+m.image_url} className="chat-img-thumb" alt="" onClick={() => window.open(SERVER+m.image_url,'_blank')} />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {pendingPreview && (
        <div className="chat-img-preview">
          <img src={pendingPreview} alt="preview" />
          <button className="chat-img-remove" onClick={clearImg}>✕</button>
        </div>
      )}

      <div className="chat-input-row">
        <input ref={imgRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => e.target.files[0]&&selectImg(e.target.files[0])} />
        <button className="chat-img-btn" onClick={() => imgRef.current.click()}>📷</button>
        <input className="chat-input" placeholder="Message all teams…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} />
        <button className="send-btn" onClick={send} disabled={sending||(!text.trim()&&!pendingImg)} style={{ background:team.color }}>→</button>
      </div>
    </div>
  )
}

// ── GalleryView ───────────────────────────────────────────────────────────────
function GalleryView({ state }) {
  const [lightbox, setLightbox] = useState(null)
  const withMedia = state.claims.filter(c => c.photo_url)
  const groups = {}
  withMedia.forEach(c => { const b=c.challenge_id.split('_bonus_')[0]; if(!groups[b])groups[b]=[]; groups[b].push(c) })
  const getCh = id => state.challenges.find(c => String(c.id)===id)
  const getTeam = id => state.teams.find(t => t.id===id)

  return (
    <div className="gallery-view">
      {lightbox && <Lightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <div className="gallery-header">
        <span>{withMedia.length} file{withMedia.length!==1?'s':''}</span>
        <a className="dl-link" href={`${SERVER}/api/download/photos`} download>↓ Download all</a>
      </div>
      <div className="gallery-grid">
        {Object.keys(groups).length===0 && <p className="empty-gallery">No photos yet!</p>}
        {Object.entries(groups).map(([baseId, claims]) => {
          const ch = getCh(baseId); if (!ch) return null
          const mainC = claims.find(c => !c.is_bonus)
          const mainTeam = mainC ? getTeam(mainC.team_id) : null
          const gItems = claims.map(c => ({ url:c.photo_url, title:ch.title+(c.is_bonus?' (bonus)':'') }))
          return (
            <div key={baseId} className="gallery-group">
              <div className="gallery-group-header">
                <span className="gallery-group-title">{ch.title}</span>
                {mainTeam && <span style={{ fontSize:11, color:mainTeam.color, display:'flex', alignItems:'center', gap:3 }}><span className="tdot" style={{ background:mainTeam.color }} />{mainTeam.name}</span>}
              </div>
              <div className="gallery-media-grid">
                {claims.map((c,ci) => (
                  <div key={c.id} className="gallery-item" onClick={() => setLightbox({ items:gItems, index:ci })}>
                    {isVideo(c.photo_url) ? <div className="gallery-item-video">▶</div> : <img src={SERVER+c.photo_url} alt="" loading="lazy" />}
                    {c.is_bonus && <div className="gallery-bonus-label">bonus</div>}
                  </div>
                ))}
              </div>
              {mainC?.answer_text && <div className="gallery-answer">Answer: <span className={mainC.answer_correct?'ok':'no'}>{mainC.answer_text}{mainC.answer_correct?' ✓':''}</span></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
