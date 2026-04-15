import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import Lightbox from './Lightbox.jsx'
import MapView from './MapView.jsx'
import ResultsView from './ResultsView.jsx'
import AdminPanel from './AdminPanel.jsx'
import { SERVER, STORAGE_KEY, TYPE_LABELS, CAT_LABELS, CHALLENGE_COORDS, isVideo, compressImage } from './constants.js'
import './App.css'

const socket = io(SERVER, { transports: ['websocket', 'polling'] })

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

function useCountdown(huntStatus, huntStartTime, countdownMinutes) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    if (huntStatus !== 'active' || !huntStartTime) { setRemaining(null); return }
    function tick() { setRemaining(Math.max(0, countdownMinutes * 60 - (Date.now() - huntStartTime) / 1000)) }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [huntStatus, huntStartTime, countdownMinutes])
  return remaining
}

function fmtTime(s) { if (s === null) return ''; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` }

function HuntEventModal({ icon, title, sub, onDone }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 3000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="hunt-event-overlay" onClick={() => doneRef.current()}>
      <div className="hunt-event-modal" onClick={e => e.stopPropagation()}>
        <button className="hunt-event-close" onClick={() => doneRef.current()}>✕</button>
        <div className="hunt-event-icon">{icon}</div>
        <div className="hunt-event-title">{title}</div>
        <div className="hunt-event-sub">{sub}</div>
        <div className="hunt-event-dismiss">Tap anywhere to dismiss</div>
        <div className="hunt-event-bar"><div className="hunt-event-bar-fill" /></div>
      </div>
    </div>
  )
}

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
  const [showHuntStart, setShowHuntStart] = useState(false)
  const [showHuntEnd, setShowHuntEnd] = useState(false)
  const challengeRefs = useRef({})
  const viewRef = useRef(view)
  viewRef.current = view

  const userId = useLocation(identity, sharing === true)
  const remaining = useCountdown(state?.huntStatus, state?.huntStartTime, state?.countdownMinutes)

  useEffect(() => {
    if (identity && !identity.userId) {
      const updated = { ...identity, userId }
      setIdentity(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }
  }, [userId])

  useEffect(() => {
    socket.on('state_update', s => {
      setState(prev => {
        if (prev && prev.huntStatus !== s.huntStatus) {
          if (s.huntStatus === 'active') { setShowHuntStart(true); setView('hunt') }
          if (s.huntStatus === 'finished') { setView('chat'); setShowHuntEnd(true) }
        }
        return s
      })
      setMessages(s.messages || [])
    })
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
  useEffect(() => {
    if (!state || !identity) return
    if (identity.playerId && !state.players.find(p => p.id === identity.playerId)) { window._savedName = identity.name; localStorage.removeItem(STORAGE_KEY); setIdentity(null) }
  }, [state?.players?.length])

  function saveIdentity(player, team) {
    const id = { playerId: player.id, name: player.name, team, userId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id)); setIdentity(id)
  }

  const goToMap = useCallback((id) => { setView('map'); setMapFocusId(id) }, [])
  const handleMapChallengeClick = useCallback((id) => {
    setView('hunt'); setFilter('all'); setHighlightChallenge(id)
    setTimeout(() => { const el = challengeRefs.current[id]; if (el) el.scrollIntoView({ behavior:'smooth', block:'center' }) }, 100)
  }, [])
  function showToast(msg) { setClaimToast(msg); setTimeout(() => setClaimToast(null), 3000) }

  if (!state) return <div className="loading-screen">Connecting…</div>

  const validTeam = identity?.team ? state.teams.find(t => t.id === identity.team.id) : null
  const validPlayer = identity?.playerId ? state.players.find(p => p.id === identity.playerId) : null
  if (!identity || !validTeam || !validPlayer) return <JoinScreen state={state} onJoin={saveIdentity} />

  const team = validTeam, player = validPlayer
  const { huntStatus, resultsEnabled } = state
  const myScore = state.scores[team.id] || 0

  const showHuntTab = huntStatus === 'active' || (huntStatus === 'finished' && resultsEnabled)
  const navTabs = [
    { id:'chat', label:'Chat' },
    { id:'map', label:'Map' },
    ...(showHuntTab ? [{ id:'hunt', label:'Challenges' }] : []),
    ...(huntStatus==='active' ? [{ id:'gallery', label:'Gallery' }] : []),
    ...(huntStatus==='finished'&&resultsEnabled ? [{ id:'results', label:'🏆 Results' }] : []),
  ]
  const validView = navTabs.find(t => t.id === view) ? view : 'chat'

  return (
    <div className="app">
      {showHuntStart && <HuntEventModal icon="🔫" title="HUNT IS ON!" sub="Go go go! Good luck! 🏃" onDone={() => setShowHuntStart(false)} />}
      {showHuntEnd && <HuntEventModal icon="🏁" title="HUNT IS OVER!" sub="Return to the pub — results coming soon!" onDone={() => setShowHuntEnd(false)} />}

      <div className="sticky-top">
        <header className="header">
          <div>
            <div className="header-title">Riga Stag Hunt</div>
            <div className="header-sub" style={{ color: team.color }}>
              <span className="tdot" style={{ background: team.color }} /> {team.name} · {player.name}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {huntStatus==='active' && remaining!==null && (
              <div className={`countdown ${remaining<600?'danger':remaining<1800?'warn':''}`}>⏱ {fmtTime(remaining)}</div>
            )}
            {huntStatus==='active' && <div className="my-score">{myScore}pt{myScore!==1?'s':''}</div>}
            <button className="admin-btn-header" onClick={() => setShowAdmin(true)}>Admin</button>
          </div>
        </header>

        {sharing === null && (
          <div className="location-banner">
            <span>📍 Share your location on the map?</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="loc-btn allow" onClick={() => { setSharing(true); localStorage.setItem('stag_sharing','true') }}>Yes</button>
              <button className="loc-btn deny" onClick={() => { setSharing(false); localStorage.setItem('stag_sharing','false') }}>No thanks</button>
            </div>
          </div>
        )}

        <nav className="nav">
          {navTabs.map(t => (
            <button key={t.id} className={`nav-btn ${validView===t.id?'active':''}`} onClick={() => setView(t.id)}>
              {t.label}{t.id==='chat'&&unread>0&&<span className="badge">{unread}</span>}
            </button>
          ))}
        </nav>
      </div>

      {claimToast && <div className="claim-toast">{claimToast}</div>}

      <div className="content-area">
        {validView==='chat' && <ChatView messages={messages} state={state} team={team} player={player} huntStatus={huntStatus} />}
        {validView==='map' && <MapView state={state} locations={locations} identity={{...identity,userId}} onChallengeClick={handleMapChallengeClick} focusChallengeId={mapFocusId} clearFocus={()=>setMapFocusId(null)} showPins={huntStatus==='active'} />}
        {validView==='hunt' && huntStatus==='active' && (
          <HuntView state={state} team={team} filter={filter} setFilter={setFilter} highlightChallenge={highlightChallenge} setHighlightChallenge={setHighlightChallenge} challengeRefs={challengeRefs} onGoToMap={goToMap} onToast={showToast} locked={false}/>
        )}
        {validView==='hunt' && huntStatus==='finished' && resultsEnabled && (
          <HuntView state={state} team={team} filter={filter} setFilter={setFilter} highlightChallenge={highlightChallenge} setHighlightChallenge={setHighlightChallenge} challengeRefs={challengeRefs} onGoToMap={goToMap} onToast={showToast} locked={true}/>
        )}
        {validView==='hunt' && huntStatus==='waiting' && <PlaceholderScreen huntStatus={huntStatus}/>}
        {validView==='hunt' && huntStatus==='finished' && !resultsEnabled && <PlaceholderScreen huntStatus={huntStatus}/>}
        {validView==='gallery' && (huntStatus==='active'||huntStatus==='finished') && <GalleryView state={state}/>}
        {validView==='results' && <ResultsView state={state}/>}
      </div>

      {showAdmin && <AdminPanel state={state} onClose={() => setShowAdmin(false)} />}
    </div>
  )
}

function PlaceholderScreen({ huntStatus }) {
  return (
    <div className="placeholder-screen">
      {huntStatus==='waiting' ? <><div style={{fontSize:48}}>⏳</div><h2>Hunt starting soon…</h2><p>Check the Chat and Map while you wait!</p></>
        : <><div style={{fontSize:48}}>🎉</div><h2>Hunt complete!</h2><p>Return to the pub. Results coming soon!</p></>}
    </div>
  )
}

function JoinScreen({ state, onJoin }) {
  const [step, setStep] = useState(state.teams.length>0?'choose':'create')
  const [name, setName] = useState(window._savedName||'')
  const [teamName, setTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function createTeam() {
    if (!name.trim()) return setErr('Enter your name')
    if (!teamName.trim()) return setErr('Enter a team name')
    setLoading(true); setErr('')
    try {
      const tr = await fetch(`${SERVER}/api/teams`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:teamName})})
      const team = await tr.json(); if(!tr.ok) throw new Error(team.error)
      const pr = await fetch(`${SERVER}/api/players/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),team_id:team.id})})
      const player = await pr.json(); if(!pr.ok) throw new Error(player.error)
      onJoin(player, team)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  async function joinTeam() {
    if (!name.trim()) return setErr('Enter your name')
    if (!selectedTeam) return setErr('Select a team')
    setLoading(true); setErr('')
    try {
      const pr = await fetch(`${SERVER}/api/players/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),team_id:selectedTeam.id})})
      const player = await pr.json(); if(!pr.ok) throw new Error(player.error)
      onJoin(player, selectedTeam)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div style={{fontSize:40,textAlign:'center'}}>🍺</div>
        <h1 className="join-title">Riga Stag Hunt</h1>
        <p className="join-sub">Welcome to a challenge hunt that will take you around Riga.</p>
        <input className="field" placeholder="Your name" value={name} onChange={e=>{setName(e.target.value);setErr('')}}/>
        {step==='choose'&&state.teams.length>0&&(
          <>
            <p className="section-label">Pick your team</p>
            <div className="team-list">
              {state.teams.map(t=>(
                <button key={t.id} className={`team-pick ${selectedTeam?.id===t.id?'selected':''}`} onClick={()=>setSelectedTeam(selectedTeam?.id===t.id?null:t)} style={{'--tc':t.color}}>
                  <span className="tdot" style={{background:t.color}}/>{t.name}
                  <span style={{marginLeft:'auto',fontSize:11,color:'#aaa'}}>{state.players.filter(p=>p.team_id===t.id).length} joined</span>
                  {selectedTeam?.id===t.id&&<span style={{color:t.color}}>✓</span>}
                </button>
              ))}
            </div>
            {err&&<p className="form-err">{err}</p>}
            <button className="big-btn" onClick={joinTeam} disabled={loading||!selectedTeam||!name.trim()}>{loading?'Joining…':'Join team'}</button>
            <button className="big-btn ghost" onClick={()=>{setStep('create');setErr('')}}>+ Create new team</button>
          </>
        )}
        {(step==='create'||state.teams.length===0)&&(
          <>
            <input className="field" placeholder="New team name" value={teamName} onChange={e=>{setTeamName(e.target.value);setErr('')}}/>
            {err&&<p className="form-err">{err}</p>}
            <button className="big-btn" onClick={createTeam} disabled={loading||!name.trim()||!teamName.trim()}>{loading?'Creating…':'Create team & join'}</button>
            {state.teams.length>0&&<button className="big-btn ghost" onClick={()=>{setStep('choose');setErr('')}}>← Join existing team</button>}
          </>
        )}
      </div>
    </div>
  )
}

function HuntView({ state, team, filter, setFilter, highlightChallenge, setHighlightChallenge, challengeRefs, onGoToMap, onToast, locked=false }) {
  const cats = ['all','landmark','quick','medium','hard']
  const filtered = filter==='all'?state.challenges:state.challenges.filter(c=>c.category===filter)
  const groups = {}
  filtered.forEach(c=>{if(!groups[c.category])groups[c.category]=[];groups[c.category].push(c)})
  return (
    <div className="hunt-view">
      <div className="filter-row">
        {cats.map(c=><button key={c} className={`filter-btn ${filter===c?'active':''}`} onClick={()=>setFilter(c)}>{c==='all'?'All':CAT_LABELS[c]?.split(' ')[0]||c}</button>)}
        {highlightChallenge&&<button className="filter-btn active-green" onClick={()=>setHighlightChallenge(null)}>✕ Show all</button>}
      </div>
      <div className="clist">
        {Object.entries(groups).map(([cat,challenges])=>(
          <div key={cat}>
            <div className="cat-label">{CAT_LABELS[cat]||cat}</div>
            {challenges.map(ch=><ChallengeCard key={ch.id} ch={ch} state={state} team={team} highlighted={highlightChallenge===ch.id} cardRef={el=>{if(el)challengeRefs.current[ch.id]=el}} onGoToMap={onGoToMap} onToast={onToast} locked={locked}/>)}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChallengeCard({ ch, state, team, highlighted, cardRef, onGoToMap, onToast, locked=false }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [answer, setAnswer] = useState('')
  const [answerState, setAnswerState] = useState(null)
  const [bonusAnswers, setBonusAnswers] = useState({})
  const [bonusAnswerStates, setBonusAnswerStates] = useState({})
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()
  const bonusFileRefs = useRef({})

  useEffect(()=>{if(highlighted)setExpanded(true)},[highlighted])

  const mainClaim = state.claims.find(c=>c.challenge_id===String(ch.id)&&!c.is_bonus)
  const claimTeam = mainClaim?state.teams.find(t=>t.id===mainClaim.team_id):null
  const myMainClaim = mainClaim?.team_id===team.id
  const hasCoords = !!CHALLENGE_COORDS[ch.id]

  async function doValidate(challengeId, isBonus, answerText) {
    const res = await fetch(`${SERVER}/api/validate-answer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge_id:challengeId,is_bonus:isBonus,answer_text:answerText})})
    const d = await res.json()
    return d.correct
  }

  async function handleClaim(file, challengeId, isBonus, answerText, answerOnly=false) {
    const key = isBonus?challengeId:'main'
    setUploading(key)
    let mediaFile = file
    if(file?.type.startsWith('image/')) mediaFile = await compressImage(file)
    const fd = new FormData()
    if(mediaFile) fd.append('media',mediaFile)
    fd.append('team_id',team.id);fd.append('challenge_id',challengeId);fd.append('is_bonus',isBonus?'true':'false')
    if(answerText)fd.append('answer_text',answerText)
    if(answerOnly)fd.append('answer_only','true')
    try {
      const res = await fetch(`${SERVER}/api/claim`,{method:'POST',body:fd})
      const d = await res.json()
      if(!res.ok){alert(d.error||'Failed');setUploading(null);return}
      const pts = isBonus?(ch.bonus?.find(b=>b.id===challengeId.split('_bonus_')[1])?.pts||1):ch.pts
      onToast?.(`+${pts}pt${pts!==1?'s':''} for ${team.name}!`)
    } catch{alert('Upload failed')}
    setUploading(null)
  }

  async function handleUnclaim(challengeId, isBonus=false) {
    const res = await fetch(`${SERVER}/api/unclaim`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:team.id,challenge_id:challengeId,is_bonus:isBonus})})
    const d = await res.json()
    if(!res.ok){alert(d.error);return}
    onToast?.('Unclaimed — others can grab it now!')
  }

  function buildLbItems() {
    const items=[]
    if(mainClaim?.photo_url)items.push({url:mainClaim.photo_url,title:ch.title})
    ch.bonus?.forEach(b=>{const bc=state.claims.find(c=>c.challenge_id===`${ch.id}_bonus_${b.id}`);if(bc?.photo_url)items.push({url:bc.photo_url,title:`${ch.title} — bonus`})})
    return items
  }

  const unclaimedBonuses = ch.bonus?.filter(b=>!state.claims.some(c=>c.challenge_id===`${ch.id}_bonus_${b.id}`))||[]

  return (
    <>
      {lightbox!==null&&<Lightbox items={buildLbItems()} startIndex={lightbox} onClose={()=>setLightbox(null)}/>}
      <div ref={cardRef} className={`cc ${mainClaim?'fully-done':''} ${highlighted?'highlighted':''} ${locked?'locked':''}`}>
        <div className="cc-top" onClick={()=>setExpanded(e=>!e)}>
          <div className={`pts-badge p${Math.min(ch.pts,3)}`}>{ch.pts}pt{ch.pts>1?'s':''}</div>
          <div className="cc-body">
            <div className="cc-row">
              <span className="cc-title">{ch.title}</span>
              <span className={`type-tag t${ch.type}`}>{TYPE_LABELS[ch.type]}</span>
              {ch.video&&<span className="video-tag">🎥</span>}
              {hasCoords&&<button className="map-pin-btn" onClick={e=>{e.stopPropagation();onGoToMap(ch.id)}}>📍</button>}
            </div>
            <div className="cc-hint">{ch.hint}</div>
            {mainClaim?(
              <div className="claimed-banner" style={{background:`${claimTeam?.color}18`,border:`1px solid ${claimTeam?.color}44`}}>
                <span className="claimed-check" style={{color:claimTeam?.color}}>✓</span>
                <div className="claimed-info">
                  <div className="claimed-team" style={{color:claimTeam?.color}}>{claimTeam?.name}</div>
                  <div className="claimed-sub">{mainClaim.answer_text&&<span>{mainClaim.answer_text}{mainClaim.answer_correct?' ✓':''} · </span>}claimed</div>
                </div>
                {mainClaim.photo_url&&<div onClick={e=>{e.stopPropagation();setLightbox(0)}} style={{flexShrink:0}}><MediaThumb url={mainClaim.photo_url} size={44}/></div>}
              </div>
            ):ch.bonus?.length>0&&(
              <div className="bonus-summary">
                {ch.bonus.map(b=>{const bc=state.claims.find(c=>c.challenge_id===`${ch.id}_bonus_${b.id}`);return<span key={b.id} className={`bonus-dot ${bc?'got':''}`}>+{b.pts}</span>})}
                <span style={{fontSize:11,color:'#aaa'}}> bonus</span>
              </div>
            )}
            {mainClaim&&ch.bonus?.length>0&&(
              <div className="bonus-summary" style={{marginTop:4}}>
                {ch.bonus.map(b=>{
                  const bc=state.claims.find(c=>c.challenge_id===`${ch.id}_bonus_${b.id}`)
                  const bt=bc?state.teams.find(t=>t.id===bc.team_id):null
                  return<span key={b.id} className={`bonus-dot ${bc?'got':''}`} style={bc&&bt?{color:bt.color,borderColor:bt.color+'55',background:bt.color+'15'}:{}}>{bc?`✓+${b.pts}`:`+${b.pts}`}</span>
                })}
                {unclaimedBonuses.length>0&&<span style={{fontSize:11,color:'#888'}}> {unclaimedBonuses.length} available</span>}
              </div>
            )}
          </div>
          <div className="expand-icon">{expanded?'▲':'▼'}</div>
        </div>

        {expanded&&(
          <div className="cc-expanded">
            <p className="cc-desc">{ch.desc}</p>

            {ch.answerField&&!mainClaim&&(
              <div className="answer-field">
                <div className="answer-label">{ch.answerField.label}</div>
                <div className="answer-input-row">
                  <input className="answer-input" value={answer} onChange={e=>{setAnswer(e.target.value);setAnswerState(null)}}/>
                  <button className={`answer-check-btn ${answerState||''}`} disabled={!answer.trim()||answerState==='checking'}
                    onClick={async()=>{
                      setAnswerState('checking')
                      const correct = await doValidate(String(ch.id),false,answer)
                      setAnswerState(correct?'correct':'wrong')
                      // Never auto-claim main challenges — always require photo too
                    }}>
                    {answerState==='checking'?'…':answerState==='correct'?'✓':answerState==='wrong'?'✗':'✓?'}
                  </button>
                </div>
                {answerState==='correct'&&<div className="answer-feedback correct">✓ Correct!</div>}
                {answerState==='wrong'&&<div className="answer-feedback wrong">✗ Not quite — try again!</div>}
              </div>
            )}

            {!mainClaim&&!locked&&(
              <div className="claim-area">
                {ch.answerField?.correct?(
                  answerState==='correct'?(
                    <>
                      <input ref={fileRef} type="file" accept={ch.video?'image/*,video/*':'image/*'} capture={ch.video?undefined:'environment'} style={{display:'none'}} onChange={e=>e.target.files[0]&&handleClaim(e.target.files[0],String(ch.id),false,answer)}/>
                      <button className="claim-btn primary" onClick={()=>fileRef.current.click()} disabled={uploading==='main'}>
                        {uploading==='main'?'Uploading…':'📷 Upload to claim'}
                      </button>
                    </>
                  ):<div className="claim-hint">Answer correctly above to unlock upload</div>
                ):(
                  <>
                    <input ref={fileRef} type="file" accept={ch.video?'image/*,video/*':'image/*'} capture={ch.video?undefined:'environment'} style={{display:'none'}} onChange={e=>e.target.files[0]&&handleClaim(e.target.files[0],String(ch.id),false,answer)}/>
                    <button className="claim-btn primary" onClick={()=>fileRef.current.click()} disabled={uploading==='main'}>
                      {uploading==='main'?'Uploading…':'📷 Upload to claim'}
                    </button>
                    {ch.video&&<div className="media-hint">Photo or video accepted</div>}
                  </>
                )}
              </div>
            )}
            {myMainClaim&&!locked&&<button className="unclaim-btn" onClick={()=>handleUnclaim(String(ch.id),false)}>↩ Unclaim (wrong photo?)</button>}

            {ch.bonus?.length>0&&(
              <div className="bonus-section">
                <div className="bonus-header">Bonus objectives</div>
                {ch.bonus.map(b=>{
                  const bonusClaimId=`${ch.id}_bonus_${b.id}`
                  const bc=state.claims.find(c=>c.challenge_id===bonusClaimId)
                  const bt=bc?state.teams.find(t=>t.id===bc.team_id):null
                  const myBonus=bc?.team_id===team.id
                  const bAs=bonusAnswerStates[b.id]
                  const lbItems=buildLbItems()
                  const bIdx=lbItems.findIndex(i=>i.url===bc?.photo_url)
                  const btnStyle = bc&&bt?{background:bt.color+'18',color:bt.color,borderColor:bt.color+'55'}:{}

                  return(
                    <div key={b.id} className={`bonus-row ${bc?'done':''}`}>
                      <span className="bonus-badge" style={bc&&bt?{...btnStyle}:{}}>{bc?'✓':''} +{b.pts}pt{b.pts>1?'s':''}</span>
                      <div className="bonus-body">
                        <p className="bonus-text">{b.text}</p>
                        {b.answerField&&!bc&&(
                          <div className="answer-field" style={{marginBottom:6}}>
                            <div className="answer-input-row">
                              <input className="answer-input" style={{fontSize:13,padding:'7px 9px'}} value={bonusAnswers[b.id]||''} onChange={e=>{setBonusAnswers(a=>({...a,[b.id]:e.target.value}));setBonusAnswerStates(s=>({...s,[b.id]:null}))}}/>
                              <button className={`answer-check-btn ${bAs||''}`} disabled={!bonusAnswers[b.id]?.trim()||bAs==='checking'}
                                onClick={async()=>{
                                  setBonusAnswerStates(s=>({...s,[b.id]:'checking'}))
                                  const correct = await doValidate(bonusClaimId,true,bonusAnswers[b.id]||'')
                                  setBonusAnswerStates(s=>({...s,[b.id]:correct?'correct':'wrong'}))
                                  if(correct&&b.answerOnly)await handleClaim(null,bonusClaimId,true,bonusAnswers[b.id],true)
                                }}>
                                {bAs==='checking'?'…':bAs==='correct'?'✓':bAs==='wrong'?'✗':'✓?'}
                              </button>
                            </div>
                            {bAs==='correct'&&<div className="answer-feedback correct">✓ Correct!</div>}
                            {bAs==='wrong'&&<div className="answer-feedback wrong">✗ Not quite!</div>}
                          </div>
                        )}
                        {bc?(
                          <div className="bonus-claimed" style={{color:bt?.color}}>
                            ✓ {bt?.name}{bc.answer_text&&<span style={{color:'#666',fontWeight:400}}> {bc.answer_text}</span>}
                            {bc.photo_url&&<MediaThumb url={bc.photo_url} size={32} onClick={()=>bIdx>=0&&setLightbox(bIdx)}/>}
                            {myBonus&&!locked&&<button className="unclaim-btn sm" onClick={()=>handleUnclaim(bonusClaimId,true)}>↩</button>}
                          </div>
                        ):!b.answerOnly&&!locked&&(!b.answerField?.correct||bAs==='correct')&&(
                          <>
                            <input ref={el=>bonusFileRefs.current[b.id]=el} type="file" accept={b.video?'image/*,video/*':'image/*'} style={{display:'none'}} onChange={e=>e.target.files[0]&&handleClaim(e.target.files[0],bonusClaimId,true,bonusAnswers[b.id])}/>
                            <button className="claim-btn small" onClick={()=>bonusFileRefs.current[b.id]?.click()} disabled={uploading===bonusClaimId}>
                              {uploading===bonusClaimId?'Uploading…':'📷 Upload to claim bonus'}
                            </button>
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

function MediaThumb({url,size=44,onClick}){
  if(!url)return null
  const s={width:size,height:size,borderRadius:6,objectFit:'cover',display:'block',cursor:'pointer',flexShrink:0}
  if(isVideo(url))return<div onClick={onClick} style={{...s,background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size*0.38}}>▶</div>
  return<img src={SERVER+url} style={s} alt="" onClick={onClick}/>
}

function ChatView({ messages, state, team, player, huntStatus }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImg, setPendingImg] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const endRef = useRef()
  const imgRef = useRef()

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages.length])

  async function selectImg(file){const c=await compressImage(file,1200,0.65);setPendingImg(c);setPendingPreview(URL.createObjectURL(c))}
  function clearImg(){if(pendingPreview)URL.revokeObjectURL(pendingPreview);setPendingImg(null);setPendingPreview(null)}

  async function send(){
    if((!text.trim()&&!pendingImg)||sending)return
    setSending(true)
    const fd=new FormData()
    fd.append('player_id',player.id);fd.append('team_id',team.id);fd.append('team_name',team.name);fd.append('team_color',team.color);fd.append('sender_name',player.name);fd.append('text',text.trim())
    if(pendingImg)fd.append('image',pendingImg)
    try{await fetch(`${SERVER}/api/messages`,{method:'POST',body:fd});setText('');clearImg()}catch{alert('Failed to send')}
    setSending(false)
  }

  const statusBanner = huntStatus==='waiting'?'🏁 The hunt is being prepared — please wait…'
    :huntStatus==='finished'?'🎉 The hunt has finished. Return to the pub and await the final result…'
    :null

  return(
    <div className="chat-view">
      {statusBanner&&<div className="chat-status-banner">{statusBanner}</div>}
      <div className="chat-messages">
        {messages.length===0&&<p className="chat-empty">{huntStatus==='waiting'?'Hunt starting soon — say hi!':'No messages yet.'}</p>}
        {messages.map(m=>(
          <div key={m.id} className={`msg ${m.is_system?'system':m.team_id===team.id?'mine':''}`}>
            {m.is_system?(
              <div className="msg-system">{m.text}</div>
            ):(
              <>
                <div className="msg-meta">
                  <span className="tdot" style={{background:m.team_color}}/><span className="msg-name">{m.sender_name}</span>
                  <span className="msg-team" style={{color:m.team_color}}>{m.team_name}</span>
                  <span className="msg-time">{new Date(m.sent_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                <div className="msg-bubble" style={m.team_id===team.id?{background:team.color,color:'#fff',border:'none'}:{}}>
                  {m.text&&m.text!=='📷'&&<div>{m.text}</div>}
                  {m.image_url&&<img src={SERVER+m.image_url} className="chat-img-thumb" alt="" onClick={()=>window.open(SERVER+m.image_url,'_blank')}/>}
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      {pendingPreview&&(
        <div className="chat-img-preview">
          <img src={pendingPreview} alt="preview"/>
          <button className="chat-img-remove" onClick={clearImg}>✕</button>
        </div>
      )}
      <div className="chat-input-row">
        <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&selectImg(e.target.files[0])}/>
        <button className="chat-img-btn" onClick={()=>imgRef.current.click()}>📷</button>
        <input className="chat-input" placeholder="Message all teams…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}/>
        <button className="send-btn" onClick={send} disabled={sending||(!text.trim()&&!pendingImg)} style={{background:team.color}}>→</button>
      </div>
    </div>
  )
}

function GalleryView({ state }) {
  const [lightbox, setLightbox] = useState(null)
  const withMedia = state.claims.filter(c=>c.photo_url)
  const groups={}
  withMedia.forEach(c=>{const b=c.challenge_id.split('_bonus_')[0];if(!groups[b])groups[b]=[];groups[b].push(c)})
  const chatImgs=(state.messages||[]).filter(m=>m.image_url&&!m.is_system)
  const allChatItems=chatImgs.map(m=>({url:m.image_url,title:`${m.sender_name} (${m.team_name||''})`}))
  const getCh=id=>state.challenges.find(c=>String(c.id)===id)
  const getTeam=id=>state.teams.find(t=>t.id===id)

  return(
    <div className="gallery-view">
      {lightbox&&<Lightbox items={lightbox.items} startIndex={lightbox.index} onClose={()=>setLightbox(null)}/>}
      <div className="gallery-header">
        <span>{withMedia.length+chatImgs.length} files</span>
        <a className="dl-link" href={`${SERVER}/api/download/photos`} download>↓ Download all</a>
      </div>
      <div className="gallery-grid">
        {withMedia.length===0&&chatImgs.length===0&&<p className="empty-gallery">No photos yet!</p>}
        {Object.entries(groups).map(([baseId,claims])=>{
          const ch=getCh(baseId);if(!ch)return null
          const mainC=claims.find(c=>!c.is_bonus)
          const mainTeam=mainC?getTeam(mainC.team_id):null
          const gItems=claims.map(c=>({url:c.photo_url,title:ch.title+(c.is_bonus?' (bonus)':'')}))
          return(
            <div key={baseId} className="gallery-group">
              <div className="gallery-group-header">
                <span className="gallery-group-title">{ch.title}</span>
                {mainTeam&&<span style={{fontSize:11,color:mainTeam.color,display:'flex',alignItems:'center',gap:3}}><span className="tdot" style={{background:mainTeam.color}}/>{mainTeam.name}</span>}
              </div>
              <div className="gallery-media-grid">
                {claims.map((c,ci)=>(
                  <div key={c.id} className="gallery-item" onClick={()=>setLightbox({items:gItems,index:ci})}>
                    {isVideo(c.photo_url)?<div className="gallery-item-video">▶</div>:<img src={SERVER+c.photo_url} alt="" loading="lazy"/>}
                    {c.is_bonus&&<div className="gallery-bonus-label">bonus</div>}
                  </div>
                ))}
              </div>
              {mainC?.answer_text&&<div className="gallery-answer">Answer: <span className={mainC.answer_correct?'ok':'no'}>{mainC.answer_text}{mainC.answer_correct?' ✓':''}</span></div>}
            </div>
          )
        })}
        {chatImgs.length>0&&(
          <div className="gallery-group">
            <div className="gallery-group-header"><span className="gallery-group-title">Chat photos</span><span style={{fontSize:11,color:'#888'}}>{chatImgs.length} images</span></div>
            <div className="gallery-media-grid">
              {chatImgs.map((m,ci)=>(
                <div key={m.id} className="gallery-item" onClick={()=>setLightbox({items:allChatItems,index:ci})}>
                  <img src={SERVER+m.image_url} alt="" loading="lazy"/>
                  <div className="gallery-bonus-label" style={{background:'rgba(0,0,0,0.5)'}}>{m.sender_name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
