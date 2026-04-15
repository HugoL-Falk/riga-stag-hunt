import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const SERVER = import.meta.env.VITE_SERVER_URL || ''
const socket = io(SERVER, { transports: ['websocket', 'polling'] })

const TYPE_LABELS = { photo: 'Photo', shot: 'Drinks', task: 'Task', trivia: 'Trivia', social: 'Social' }
const TYPE_COLORS = {
  photo: { bg: '#E6F1FB', color: '#185FA5' },
  shot: { bg: '#FFF0D9', color: '#854F0B' },
  task: { bg: '#EAF3DE', color: '#3B6D11' },
  trivia: { bg: '#EEEDFE', color: '#534AB7' },
  social: { bg: '#FBEAF0', color: '#993556' },
}
const CAT_LABELS = { landmark: 'Landmark Challenges', quick: 'Quick Missions (1pt)', medium: 'Medium Missions (2pt)', hard: 'Hard Missions (3pt)' }

function App() {
  const [state, setState] = useState(null)
  const [view, setView] = useState('hunt') // hunt | chat | gallery
  const [team, setTeam] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stag_team')) } catch { return null }
  })
  const [senderName, setSenderName] = useState(() => localStorage.getItem('stag_name') || '')
  const [filter, setFilter] = useState('all')
  const [unread, setUnread] = useState(0)
  const lastMsgCount = useRef(0)

  useEffect(() => {
    socket.on('state_update', (s) => {
      setState(s)
      if (view !== 'chat') {
        const newCount = s.messages.length - lastMsgCount.current
        if (newCount > 0 && lastMsgCount.current > 0) setUnread(u => u + newCount)
        lastMsgCount.current = s.messages.length
      }
    })
    socket.on('new_message', () => {
      if (view !== 'chat') setUnread(u => u + 1)
    })
    return () => { socket.off('state_update'); socket.off('new_message') }
  }, [view])

  useEffect(() => {
    if (view === 'chat') {
      setUnread(0)
      if (state) lastMsgCount.current = state.messages.length
    }
  }, [view])

  if (!state) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#888' }}>Connecting...</div>

  if (!team) return <JoinScreen state={state} onJoin={(t, name) => {
    setTeam(t)
    setSenderName(name)
    localStorage.setItem('stag_team', JSON.stringify(t))
    localStorage.setItem('stag_name', name)
  }} />

  return (
    <div className="app">
      <Header state={state} team={team} onDownload={() => window.open(`${SERVER}/api/download/photos`, '_blank')} />
      <Scoreboard state={state} activeTeamId={team.id} />

      <nav className="nav">
        <button className={`nav-btn ${view === 'hunt' ? 'active' : ''}`} onClick={() => setView('hunt')}>Challenges</button>
        <button className={`nav-btn ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
          Chat {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button className={`nav-btn ${view === 'gallery' ? 'active' : ''}`} onClick={() => setView('gallery')}>Gallery</button>
      </nav>

      {view === 'hunt' && <HuntView state={state} team={team} filter={filter} setFilter={setFilter} />}
      {view === 'chat' && <ChatView state={state} team={team} senderName={senderName} />}
      {view === 'gallery' && <GalleryView state={state} />}
    </div>
  )
}

function JoinScreen({ state, onJoin }) {
  const [step, setStep] = useState('choose') // choose | create | join
  const [teamName, setTeamName] = useState('')
  const [name, setName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function createTeam() {
    if (!teamName.trim() || !name.trim()) return setErr('Fill in both fields')
    setLoading(true)
    try {
      const res = await fetch(`${SERVER}/api/teams`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onJoin(data, name)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  function joinTeam() {
    if (!selectedTeam || !name.trim()) return setErr('Choose a team and enter your name')
    onJoin(selectedTeam, name)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo">🍺</div>
        <h1 className="join-title">Riga Stag Hunt</h1>
        <p className="join-sub">13 lads · Old Town · 1 hour</p>

        {step === 'choose' && (
          <>
            <button className="big-btn" onClick={() => setStep('create')}>Create a new team</button>
            {state.teams.length > 0 && (
              <button className="big-btn secondary" onClick={() => setStep('join')}>Join existing team</button>
            )}
          </>
        )}

        {step === 'create' && (
          <>
            <input className="field" placeholder="Team name (e.g. The Vikings)" value={teamName} onChange={e => setTeamName(e.target.value)} />
            <input className="field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="big-btn" onClick={createTeam} disabled={loading}>{loading ? 'Creating...' : 'Create team'}</button>
            <button className="big-btn ghost" onClick={() => { setStep('choose'); setErr('') }}>Back</button>
          </>
        )}

        {step === 'join' && (
          <>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Pick your team:</p>
            <div className="team-list">
              {state.teams.map(t => (
                <button key={t.id} className={`team-pick ${selectedTeam?.id === t.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTeam(t)} style={{ '--tc': t.color }}>
                  <span className="tdot" style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
            <input className="field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="big-btn" onClick={joinTeam}>Join team</button>
            <button className="big-btn ghost" onClick={() => { setStep('choose'); setErr('') }}>Back</button>
          </>
        )}
      </div>
    </div>
  )
}

function Header({ state, team, onDownload }) {
  const allClaimed = state.challenges.filter(c => c.category === 'landmark')
    .every(c => state.claims.some(cl => cl.challenge_id === String(c.id) && !cl.is_bonus))
  return (
    <header className="header">
      <div>
        <div className="header-title">Riga Stag Hunt</div>
        <div className="header-sub" style={{ color: team.color }}>
          <span className="tdot" style={{ background: team.color }} /> {team.name}
        </div>
      </div>
      <button className="dl-btn" onClick={onDownload} title="Download all photos">
        ↓ Photos
      </button>
      {allClaimed && <div className="complete-banner">All landmarks done! 🏆</div>}
    </header>
  )
}

function Scoreboard({ state, activeTeamId }) {
  const sorted = [...state.teams].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0))
  const max = sorted[0] ? (state.scores[sorted[0].id] || 0) : 0
  return (
    <div className="scoreboard">
      {sorted.map((t, i) => (
        <div key={t.id} className={`sc ${t.id === activeTeamId ? 'active' : ''} ${state.scores[t.id] === max && max > 0 ? 'lead' : ''}`}>
          <div className="sc-name"><span className="tdot" style={{ background: t.color }} />{t.name}</div>
          <div className="sc-pts">{state.scores[t.id] || 0}</div>
          <div className="sc-lbl">pts</div>
          {state.scores[t.id] === max && max > 0 && i === 0 && <div className="sc-lead">leading</div>}
        </div>
      ))}
    </div>
  )
}

function HuntView({ state, team, filter, setFilter }) {
  const cats = ['all', 'landmark', 'quick', 'medium', 'hard']
  const filtered = filter === 'all' ? state.challenges : state.challenges.filter(c => c.category === filter)

  // Group by category
  const groups = {}
  filtered.forEach(c => {
    if (!groups[c.category]) groups[c.category] = []
    groups[c.category].push(c)
  })

  return (
    <div className="hunt-view">
      <div className="filter-row">
        {cats.map(c => (
          <button key={c} className={`filter-btn ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : CAT_LABELS[c]?.split(' ')[0] || c}
          </button>
        ))}
      </div>
      <div className="clist">
        {Object.entries(groups).map(([cat, challenges]) => (
          <div key={cat}>
            <div className="cat-label">{CAT_LABELS[cat] || cat}</div>
            {challenges.map(ch => (
              <ChallengeCard key={ch.id} ch={ch} state={state} team={team} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChallengeCard({ ch, state, team }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(null)
  const fileRef = useRef()
  const bonusFileRefs = useRef({})

  const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
  const myMainClaim = mainClaim?.team_id === team.id
  const claimTeam = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null

  async function handleClaim(file, challengeId, isBonus) {
    if (!file) return
    const key = isBonus ? challengeId : 'main'
    setUploading(key)
    const fd = new FormData()
    fd.append('photo', file)
    fd.append('team_id', team.id)
    fd.append('challenge_id', challengeId)
    fd.append('is_bonus', isBonus ? 'true' : 'false')
    try {
      const res = await fetch(`${SERVER}/api/claim`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) alert(data.error || 'Failed to claim')
    } catch { alert('Upload failed. Check connection.') }
    setUploading(null)
  }

  const pts_class = ch.pts === 1 ? 'p1' : ch.pts === 2 ? 'p2' : 'p3'
  const typeStyle = TYPE_COLORS[ch.type] || TYPE_COLORS.task

  return (
    <div className={`cc ${mainClaim ? 'claimed' : ''}`}>
      <div className="cc-top" onClick={() => setExpanded(e => !e)}>
        <div className={`pts-badge ${pts_class}`}>{ch.pts}pt{ch.pts > 1 ? 's' : ''}</div>
        <div className="cc-body">
          <div className="cc-row">
            <span className="cc-title">{ch.title}</span>
            <span className="type-tag" style={{ background: typeStyle.bg, color: typeStyle.color }}>{TYPE_LABELS[ch.type]}</span>
          </div>
          <div className="cc-hint">{ch.hint}</div>
          {mainClaim && (
            <div className="claimed-by" style={{ color: claimTeam?.color }}>
              ✓ {claimTeam?.name}
              {mainClaim.photo_url && <a href={SERVER + mainClaim.photo_url} target="_blank" rel="noreferrer" className="photo-link" onClick={e => e.stopPropagation()}> (view)</a>}
            </div>
          )}
          {ch.bonus.length > 0 && (
            <div className="bonus-summary">
              {ch.bonus.map(b => {
                const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
                const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                return <span key={b.id} className={`bonus-dot ${bc ? 'got' : ''}`} style={bt ? { color: bt.color } : {}}>+{b.pts}</span>
              })}
              <span style={{ fontSize: 11, color: '#aaa' }}> bonus pts</span>
            </div>
          )}
        </div>
        <div className="expand-icon">{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div className="cc-expanded">
          <p className="cc-desc">{ch.desc}</p>

          {!mainClaim && (
            <div className="claim-area">
              <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleClaim(e.target.files[0], String(ch.id), false)} />
              <button className="claim-btn primary" onClick={() => fileRef.current.click()}
                disabled={uploading === 'main'}>
                {uploading === 'main' ? 'Uploading...' : `📷 Upload photo to claim (+${ch.pts}pt${ch.pts > 1 ? 's' : ''})`}
              </button>
            </div>
          )}

          {ch.bonus.length > 0 && (
            <div className="bonus-section">
              <div className="bonus-header">Bonus objectives</div>
              {ch.bonus.map(b => {
                const bonusClaimId = `${ch.id}_bonus_${b.id}`
                const bc = state.claims.find(c => c.challenge_id === bonusClaimId)
                const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                const myBonus = bc?.team_id === team.id
                return (
                  <div key={b.id} className={`bonus-row ${bc ? 'done' : ''}`}>
                    <span className={`bonus-badge ${bc ? 'got' : ''}`}>+{b.pts}pt{b.pts > 1 ? 's' : ''}</span>
                    <div className="bonus-body">
                      <p className="bonus-text">{b.text}</p>
                      {bc ? (
                        <p className="bonus-claimed" style={{ color: bt?.color }}>✓ {bt?.name}
                          {bc.photo_url && <a href={SERVER + bc.photo_url} target="_blank" rel="noreferrer" className="photo-link"> (view)</a>}
                        </p>
                      ) : (
                        <>
                          <input ref={el => bonusFileRefs.current[b.id] = el} type="file" accept="image/*,video/*" capture="environment"
                            style={{ display: 'none' }}
                            onChange={e => e.target.files[0] && handleClaim(e.target.files[0], bonusClaimId, true)} />
                          <button className="claim-btn small" onClick={() => bonusFileRefs.current[b.id]?.click()}
                            disabled={uploading === bonusClaimId}>
                            {uploading === bonusClaimId ? 'Uploading...' : `📷 Claim bonus`}
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
  )
}

function ChatView({ state, team, senderName }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()
  const nameRef = useRef(senderName)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state?.messages?.length])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    await fetch(`${SERVER}/api/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: team.id, team_name: team.name, team_color: team.color, sender_name: nameRef.current || senderName, text })
    })
    setText('')
    setSending(false)
  }

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {state.messages.length === 0 && <p className="chat-empty">No messages yet. Say something!</p>}
        {state.messages.map(m => (
          <div key={m.id} className={`msg ${m.team_id === team.id ? 'mine' : ''}`}>
            <div className="msg-meta">
              <span className="tdot" style={{ background: m.team_color }} />
              <span className="msg-name">{m.sender_name}</span>
              <span className="msg-team" style={{ color: m.team_color }}>{m.team_name}</span>
              <span className="msg-time">{new Date(m.sent_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="msg-bubble" style={m.team_id === team.id ? { background: team.color, color: '#fff' } : {}}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input className="chat-input" placeholder="Message all teams..." value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} />
        <button className="send-btn" onClick={send} disabled={sending || !text.trim()}
          style={{ background: team.color }}>→</button>
      </div>
    </div>
  )
}

function GalleryView({ state }) {
  const photos = state.claims.filter(c => c.photo_url)
  const getCh = (claimId) => {
    const baseId = claimId.split('_bonus_')[0]
    return state.challenges.find(c => String(c.id) === baseId)
  }
  const getTeam = (teamId) => state.teams.find(t => t.id === teamId)

  return (
    <div className="gallery-view">
      <div className="gallery-header">
        <span>{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</span>
        <a className="dl-btn" href={`${SERVER}/api/download/photos`} download>↓ Download all</a>
      </div>
      <div className="gallery-grid">
        {photos.map(c => {
          const ch = getCh(c.challenge_id)
          const t = getTeam(c.team_id)
          const isBonus = c.challenge_id.includes('_bonus_')
          return (
            <a key={c.id} href={SERVER + c.photo_url} target="_blank" rel="noreferrer" className="gallery-item">
              <img src={SERVER + c.photo_url} alt={ch?.title} loading="lazy" />
              <div className="gallery-caption">
                <span className="tdot" style={{ background: t?.color }} />
                <span>{t?.name}</span>
                {isBonus && <span className="bonus-tag">bonus</span>}
              </div>
            </a>
          )
        })}
        {photos.length === 0 && <p className="empty-gallery">No photos yet — go claim some challenges!</p>}
      </div>
    </div>
  )
}

export default App
