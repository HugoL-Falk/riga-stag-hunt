import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const SERVER = import.meta.env.VITE_SERVER_URL || ''
const socket = io(SERVER, { transports: ['websocket', 'polling'] })

const TYPE_LABELS = { photo: 'Photo', shot: 'Drinks', task: 'Task', trivia: 'Trivia', social: 'Social' }
const CAT_LABELS = { landmark: 'Landmark Challenges', quick: 'Quick Missions (1pt)', medium: 'Medium Missions (2pt)', hard: 'Hard Missions (3pt)' }
const STORAGE_KEY = 'stag_identity_v2'

function isVideo(url) {
  return url && /\.(mp4|mov|webm|ogg|quicktime)$/i.test(url)
}

// Lightbox for full-screen media with back button and swipe between items
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

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) setIdx(i => Math.min(i + 1, items.length - 1))
      else setIdx(i => Math.max(i - 1, 0))
    }
    touchStartX.current = null
  }

  return (
    <div className="lightbox" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="lightbox-close">
        <button className="lightbox-back" onClick={onClose}>
          ← Back
        </button>
        <span className="lightbox-title">{item.title}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', padding: '60px 8px 60px' }}>
        {isVideo(item.url)
          ? <video className="lightbox-video" src={SERVER + item.url} controls autoPlay playsInline />
          : <img className="lightbox-media" src={SERVER + item.url} alt={item.title} />
        }
      </div>

      {items.length > 1 && (
        <div className="lightbox-nav">
          <button className="lightbox-nav-btn" onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}>←</button>
          <span className="lightbox-counter">{idx + 1} / {items.length}</span>
          <button className="lightbox-nav-btn" onClick={() => setIdx(i => Math.min(i + 1, items.length - 1))} disabled={idx === items.length - 1}>→</button>
        </div>
      )}
    </div>
  )
}

function MediaThumb({ url, title, onClick, size = 44 }) {
  if (!url) return null
  const style = { width: size, height: size, borderRadius: 6, objectFit: 'cover', display: 'block', cursor: 'pointer', flexShrink: 0 }
  if (isVideo(url)) {
    return (
      <div onClick={onClick} style={{ ...style, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.38 }}>
        ▶
      </div>
    )
  }
  return <img src={SERVER + url} style={style} alt={title || ''} onClick={onClick} />
}

export default function App() {
  const [state, setState] = useState(null)
  const [view, setView] = useState('hunt')
  const [identity, setIdentity] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
  })
  const [filter, setFilter] = useState('all')
  const [unread, setUnread] = useState(0)
  const [showReset, setShowReset] = useState(false)
  const [messages, setMessages] = useState([])
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    // Full state sync (scores, claims, teams, initial messages)
    socket.on('state_update', (s) => {
      setState(s)
      setMessages(s.messages || [])
    })

    // Real-time individual messages — append immediately without full state reload
    socket.on('new_message', (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      if (viewRef.current !== 'chat') {
        setUnread(u => u + 1)
      }
    })

    return () => {
      socket.off('state_update')
      socket.off('new_message')
    }
  }, [])

  useEffect(() => {
    if (view === 'chat') setUnread(0)
  }, [view])

  // After reset, clear identity
  useEffect(() => {
    if (!state) return
    if (identity && state.teams.length === 0) {
      window._savedName = identity.name
      localStorage.removeItem(STORAGE_KEY)
      setIdentity(null)
    }
  }, [state?.teams?.length])

  function saveIdentity(team, name) {
    const id = { team, name }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  if (!state) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#888' }}>
      Connecting...
    </div>
  )

  const validTeam = identity ? state.teams.find(t => t.id === identity.team?.id) : null
  if (!identity || !validTeam) return <JoinScreen state={state} onJoin={saveIdentity} />

  const team = validTeam
  const allLandmarksDone = state.challenges
    .filter(c => c.category === 'landmark')
    .every(c => state.claims.some(cl => cl.challenge_id === String(c.id) && !cl.is_bonus))

  return (
    <div className="app">
      <Header team={team} onDownload={() => window.open(`${SERVER}/api/download/photos`, '_blank')} onReset={() => setShowReset(true)} />
      {allLandmarksDone && <div className="complete-banner">🏆 All landmark challenges done!</div>}
      <Scoreboard state={state} activeTeamId={team.id} />
      <nav className="nav">
        <button className={`nav-btn ${view === 'hunt' ? 'active' : ''}`} onClick={() => setView('hunt')}>Challenges</button>
        <button className={`nav-btn ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
          Chat {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button className={`nav-btn ${view === 'gallery' ? 'active' : ''}`} onClick={() => setView('gallery')}>Gallery</button>
      </nav>

      {view === 'hunt' && <HuntView state={state} team={team} filter={filter} setFilter={setFilter} />}
      {view === 'chat' && <ChatView messages={messages} state={state} team={team} senderName={identity.name} />}
      {view === 'gallery' && <GalleryView state={state} />}
      {showReset && <ResetModal onClose={() => setShowReset(false)} onReset={() => setShowReset(false)} />}
    </div>
  )
}

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
    if (!selectedTeam) return setErr('Select a team')
    if (!name.trim()) return setErr('Enter your name')
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
            <p className="section-label">Pick your team</p>
            <div className="team-list">
              {state.teams.map(t => (
                <button key={t.id} className={`team-pick ${selectedTeam?.id === t.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTeam(selectedTeam?.id === t.id ? null : t)}
                  style={{ '--tc': t.color }}>
                  <span className="tdot" style={{ background: t.color }} />{t.name}
                  {selectedTeam?.id === t.id && <span style={{ marginLeft: 'auto', color: t.color }}>✓</span>}
                </button>
              ))}
            </div>
            <input className="field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="big-btn" onClick={joinTeam} disabled={!selectedTeam || !name.trim()}>Join team</button>
            <button className="big-btn ghost" onClick={() => { setStep('create'); setErr('') }}>+ Create new team</button>
          </>
        )}

        {step === 'create' && (
          <>
            <input className="field" placeholder="Team name (e.g. The Vikings)" value={teamName} onChange={e => setTeamName(e.target.value)} />
            <input className="field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="big-btn" onClick={createTeam} disabled={loading}>{loading ? 'Creating...' : 'Create team'}</button>
            {state.teams.length > 0 && (
              <button className="big-btn ghost" onClick={() => { setStep('choose'); setErr('') }}>← Join existing team</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Header({ team, onDownload, onReset }) {
  return (
    <header className="header">
      <div>
        <div className="header-title">Riga Stag Hunt</div>
        <div className="header-sub" style={{ color: team.color }}>
          <span className="tdot" style={{ background: team.color }} /> {team.name}
        </div>
      </div>
      <div className="header-actions">
        <button className="dl-btn" onClick={onDownload}>↓ Photos</button>
        <button className="reset-btn" onClick={onReset}>Reset</button>
      </div>
    </header>
  )
}

function Scoreboard({ state, activeTeamId }) {
  const sorted = [...state.teams].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0))
  const max = sorted.length ? (state.scores[sorted[0].id] || 0) : 1
  return (
    <div className="scoreboard">
      <div className="scoreboard-title">Scoreboard</div>
      <div className="scoreboard-grid">
        {sorted.map((t, i) => {
          const pts = state.scores[t.id] || 0
          return (
            <div key={t.id} className={`sc ${t.id === activeTeamId ? 'active' : ''} ${i === 0 && pts > 0 ? 'first' : ''}`}>
              <div className="sc-rank">#{i + 1}</div>
              <div className="sc-name"><span className="tdot" style={{ background: t.color }} />{t.name}</div>
              <div className="sc-pts">{pts}</div>
              <div className="sc-lbl">pts</div>
              {i === 0 && pts > 0 && <div className="sc-delta">leading</div>}
              <div className="sc-bar">
                <div className="sc-bar-fill" style={{ width: `${max > 0 ? (pts / max) * 100 : 0}%`, background: t.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HuntView({ state, team, filter, setFilter }) {
  const cats = ['all', 'landmark', 'quick', 'medium', 'hard']
  const filtered = filter === 'all' ? state.challenges : state.challenges.filter(c => c.category === filter)
  const groups = {}
  filtered.forEach(c => { if (!groups[c.category]) groups[c.category] = []; groups[c.category].push(c) })

  return (
    <div className="hunt-view">
      <div className="filter-row">
        {cats.map(c => (
          <button key={c} className={`filter-btn ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : CAT_LABELS[c]?.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="clist">
        {Object.entries(groups).map(([cat, challenges]) => (
          <div key={cat}>
            <div className="cat-label">{CAT_LABELS[cat] || cat}</div>
            {challenges.map(ch => <ChallengeCard key={ch.id} ch={ch} state={state} team={team} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChallengeCard({ ch, state, team }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [answer, setAnswer] = useState('')
  const [bonusAnswers, setBonusAnswers] = useState({})
  const [answerFeedback, setAnswerFeedback] = useState(null)
  const [bonusFeedback, setBonusFeedback] = useState({})
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()
  const bonusFileRefs = useRef({})

  const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
  const claimTeam = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null
  const acceptsVideo = ch.video
  const mediaAccept = acceptsVideo ? 'image/*,video/*' : 'image/*'

  async function handleClaim(file, challengeId, isBonus, answerText) {
    if (!file) return
    const key = isBonus ? challengeId : 'main'
    setUploading(key)
    const fd = new FormData()
    fd.append('media', file)
    fd.append('team_id', team.id)
    fd.append('challenge_id', challengeId)
    fd.append('is_bonus', isBonus ? 'true' : 'false')
    if (answerText) fd.append('answer_text', answerText)
    try {
      const res = await fetch(`${SERVER}/api/claim`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to claim'); setUploading(null); return }
      if (answerText && data.answer_correct !== undefined) {
        if (isBonus) setBonusFeedback(f => ({ ...f, [challengeId]: data.answer_correct ? 'correct' : 'wrong' }))
        else setAnswerFeedback(data.answer_correct ? 'correct' : 'wrong')
      }
    } catch { alert('Upload failed. Check your connection.') }
    setUploading(null)
  }

  // Build all media items for this challenge for the lightbox
  function buildLightboxItems() {
    const items = []
    if (mainClaim?.photo_url) items.push({ url: mainClaim.photo_url, title: ch.title })
    ch.bonus && ch.bonus.forEach(b => {
      const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
      if (bc?.photo_url) items.push({ url: bc.photo_url, title: `${ch.title} — bonus` })
    })
    return items
  }

  return (
    <>
      {lightbox !== null && (
        <Lightbox items={buildLightboxItems()} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
      <div className={`cc ${mainClaim ? 'fully-done' : ''}`}>
        <div className="cc-top" onClick={() => setExpanded(e => !e)}>
          <div className={`pts-badge p${Math.min(ch.pts, 3)}`}>{ch.pts}pt{ch.pts > 1 ? 's' : ''}</div>
          <div className="cc-body">
            <div className="cc-row">
              <span className="cc-title">{ch.title}</span>
              <span className={`type-tag t${ch.type}`}>{TYPE_LABELS[ch.type]}</span>
              {acceptsVideo && <span className="video-tag">🎥</span>}
            </div>
            <div className="cc-hint">{ch.hint}</div>
            {mainClaim ? (
              <div className="claimed-banner" style={{ background: `${claimTeam?.color}18`, border: `1px solid ${claimTeam?.color}44` }}>
                <div className="claimed-check" style={{ color: claimTeam?.color }}>✓</div>
                <div className="claimed-info">
                  <div className="claimed-team" style={{ color: claimTeam?.color }}>{claimTeam?.name}</div>
                  <div className="claimed-sub">
                    {mainClaim.answer_text && <span>{mainClaim.answer_text}{mainClaim.answer_correct ? ' ✓' : ''} · </span>}
                    claimed
                  </div>
                </div>
                {mainClaim.photo_url && (
                  <MediaThumb url={mainClaim.photo_url} title={ch.title} size={44}
                    onClick={(e) => { e.stopPropagation(); setLightbox(0) }} />
                )}
              </div>
            ) : (
              ch.bonus?.length > 0 && (
                <div className="bonus-summary">
                  {ch.bonus.map(b => {
                    const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
                    return <span key={b.id} className={`bonus-dot ${bc ? 'got' : ''}`}>+{b.pts}</span>
                  })}
                  <span style={{ fontSize: 11, color: '#aaa' }}> bonus</span>
                </div>
              )
            )}
          </div>
          <div className="expand-icon">{expanded ? '▲' : '▼'}</div>
        </div>

        {expanded && (
          <div className="cc-expanded">
            <p className="cc-desc">{ch.desc}</p>

            {ch.answerField && !mainClaim && (
              <div className="answer-field">
                <div className="answer-label">{ch.answerField.label}</div>
                <input className="answer-input" placeholder={ch.answerField.placeholder}
                  value={answer} onChange={e => setAnswer(e.target.value)} />
                {answerFeedback && (
                  <div className={`answer-feedback ${answerFeedback}`}>
                    {answerFeedback === 'correct' ? '✓ Correct!' : '✗ Not quite — but logged and you still get the points!'}
                  </div>
                )}
              </div>
            )}

            {!mainClaim && (
              <div className="claim-area">
                <input ref={fileRef} type="file" accept={mediaAccept} capture={acceptsVideo ? undefined : 'environment'}
                  style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && handleClaim(e.target.files[0], String(ch.id), false, answer)} />
                <button className="claim-btn primary" onClick={() => fileRef.current.click()} disabled={uploading === 'main'}>
                  {uploading === 'main' ? 'Uploading...' : `${acceptsVideo ? '📷/🎥' : '📷'} Upload proof to claim (+${ch.pts}pt${ch.pts > 1 ? 's' : ''})`}
                </button>
                {acceptsVideo && <div className="media-hint">Photo or video accepted</div>}
              </div>
            )}

            {ch.bonus?.length > 0 && (
              <div className="bonus-section">
                <div className="bonus-header">Bonus objectives</div>
                {ch.bonus.map(b => {
                  const bonusClaimId = `${ch.id}_bonus_${b.id}`
                  const bc = state.claims.find(c => c.challenge_id === bonusClaimId)
                  const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null
                  const bAcceptsVideo = b.video
                  const allItems = buildLightboxItems()
                  const bonusItemIdx = allItems.findIndex(i => i.url === bc?.photo_url)

                  return (
                    <div key={b.id} className={`bonus-row ${bc ? 'done' : ''}`}>
                      <span className={`bonus-badge ${bc ? 'got' : ''}`}>+{b.pts}pt{b.pts > 1 ? 's' : ''}</span>
                      <div className="bonus-body">
                        <p className="bonus-text">{b.text}</p>
                        {b.answerField && !bc && (
                          <div className="answer-field" style={{ marginBottom: 6 }}>
                            <input className="answer-input" style={{ fontSize: 13, padding: '7px 9px' }}
                              placeholder={b.answerField.placeholder}
                              value={bonusAnswers[b.id] || ''}
                              onChange={e => setBonusAnswers(a => ({ ...a, [b.id]: e.target.value }))} />
                            {bonusFeedback[bonusClaimId] && (
                              <div className={`answer-feedback ${bonusFeedback[bonusClaimId]}`}>
                                {bonusFeedback[bonusClaimId] === 'correct' ? '✓ Correct!' : '✗ Not quite, but logged!'}
                              </div>
                            )}
                          </div>
                        )}
                        {bc ? (
                          <div className="bonus-claimed" style={{ color: bt?.color }}>
                            <span>✓ {bt?.name}</span>
                            {bc.answer_text && <span style={{ color: '#666', fontWeight: 400 }}>{bc.answer_text}</span>}
                            {bc.photo_url && (
                              <MediaThumb url={bc.photo_url} size={32}
                                onClick={() => bonusItemIdx >= 0 && setLightbox(bonusItemIdx)} />
                            )}
                          </div>
                        ) : (
                          <>
                            <input ref={el => bonusFileRefs.current[b.id] = el}
                              type="file" accept={bAcceptsVideo ? 'image/*,video/*' : 'image/*'}
                              style={{ display: 'none' }}
                              onChange={e => e.target.files[0] && handleClaim(e.target.files[0], bonusClaimId, true, bonusAnswers[b.id])} />
                            <button className="claim-btn small" onClick={() => bonusFileRefs.current[b.id]?.click()}
                              disabled={uploading === bonusClaimId}>
                              {uploading === bonusClaimId ? 'Uploading...' : `${bAcceptsVideo ? '📷/🎥' : '📷'} Claim bonus`}
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

// Chat — uses live messages prop updated by socket.on('new_message') directly
function ChatView({ messages, state, team, senderName }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()
  const messagesEndRef = useRef()

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    if (!text.trim() || sending) return
    const msg = text.trim()
    setText('')
    setSending(true)
    try {
      await fetch(`${SERVER}/api/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: team.id, team_name: team.name, team_color: team.color, sender_name: senderName, text: msg })
      })
    } catch { alert('Message failed to send') }
    setSending(false)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">No messages yet. Say something!</p>}
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.team_id === team.id ? 'mine' : ''}`}>
            <div className="msg-meta">
              <span className="tdot" style={{ background: m.team_color }} />
              <span className="msg-name">{m.sender_name}</span>
              <span className="msg-team" style={{ color: m.team_color }}>{m.team_name}</span>
              <span className="msg-time">{new Date(m.sent_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="msg-bubble" style={m.team_id === team.id ? { background: team.color, color: '#fff', border: 'none' } : {}}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row">
        <input className="chat-input" placeholder="Message all teams..." value={text}
          onChange={e => setText(e.target.value)} onKeyDown={onKey} />
        <button className="send-btn" onClick={send} disabled={sending || !text.trim()} style={{ background: team.color }}>
          →
        </button>
      </div>
    </div>
  )
}

function GalleryView({ state }) {
  const [lightbox, setLightbox] = useState(null) // { items, index }
  const claimsWithMedia = state.claims.filter(c => c.photo_url)

  // Group by challenge
  const groups = {}
  claimsWithMedia.forEach(c => {
    const baseId = c.challenge_id.split('_bonus_')[0]
    if (!groups[baseId]) groups[baseId] = []
    groups[baseId].push(c)
  })

  // Build flat item list for lightbox navigation across all gallery items
  const allItems = []
  Object.entries(groups).forEach(([baseId, claims]) => {
    const ch = state.challenges.find(c => String(c.id) === baseId)
    claims.forEach(c => allItems.push({ url: c.photo_url, title: ch?.title || 'Challenge' }))
  })

  function getGlobalIndex(url) { return allItems.findIndex(i => i.url === url) }

  function getCh(id) { return state.challenges.find(c => String(c.id) === id) }
  function getTeam(id) { return state.teams.find(t => t.id === id) }

  return (
    <div className="gallery-view">
      {lightbox && (
        <Lightbox items={lightbox.items} startIndex={lightbox.index}
          onClose={() => setLightbox(null)} />
      )}

      <div className="gallery-header">
        <span>{claimsWithMedia.length} file{claimsWithMedia.length !== 1 ? 's' : ''} uploaded</span>
        <a className="dl-btn" href={`${SERVER}/api/download/photos`} download
          style={{ background: '#1a1a1a', padding: '6px 11px', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 12 }}>
          ↓ Download all
        </a>
      </div>

      <div className="gallery-grid">
        {Object.keys(groups).length === 0 && <p className="empty-gallery">No photos yet — go claim some challenges!</p>}
        {Object.entries(groups).map(([baseId, claims]) => {
          const ch = getCh(baseId)
          if (!ch) return null
          const mainC = claims.find(c => !c.is_bonus)
          const bonusClaims = claims.filter(c => c.is_bonus)
          const mainTeam = mainC ? getTeam(mainC.team_id) : null

          // Items for this group's lightbox
          const groupItems = claims.map(c => ({ url: c.photo_url, title: ch.title + (c.is_bonus ? ' (bonus)' : '') }))

          return (
            <div key={baseId} className="gallery-group">
              <div className="gallery-group-header">
                <span className="gallery-group-title">{ch.title}</span>
                {mainTeam && (
                  <span className="gallery-group-team" style={{ color: mainTeam.color }}>
                    <span className="tdot" style={{ background: mainTeam.color }} />{mainTeam.name}
                  </span>
                )}
              </div>

              <div className="gallery-media-grid">
                {claims.map((c, ci) => {
                  const bonusId = c.is_bonus ? c.challenge_id.split('_bonus_')[1] : null
                  const bonus = bonusId ? ch.bonus?.find(b => b.id === bonusId) : null
                  const ct = getTeam(c.team_id)
                  return (
                    <div key={c.id} className="gallery-item"
                      onClick={() => setLightbox({ items: groupItems, index: ci })}>
                      {isVideo(c.photo_url)
                        ? <div className="gallery-item-video">▶</div>
                        : <img src={SERVER + c.photo_url} alt={ch.title} loading="lazy" />
                      }
                      {c.is_bonus && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, padding: '3px 5px', display: 'flex', gap: 3, alignItems: 'center' }}>
                          <span className="tdot" style={{ background: ct?.color, width: 6, height: 6 }} />
                          <span>bonus</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {mainC?.answer_text && (
                <div className="gallery-answer">
                  Answer: <span className={mainC.answer_correct ? 'answer-correct' : 'answer-wrong'}>
                    {mainC.answer_text} {mainC.answer_correct ? '✓' : ''}
                  </span>
                </div>
              )}
              {bonusClaims.filter(bc => bc.answer_text).map(bc => {
                const bonusId = bc.challenge_id.split('_bonus_')[1]
                const bonus = ch.bonus?.find(b => b.id === bonusId)
                const bt = getTeam(bc.team_id)
                return (
                  <div key={bc.id} className="gallery-answer">
                    <span style={{ color: bt?.color }}>{bt?.name}</span>: <span className="answer-correct">{bc.answer_text}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResetModal({ onClose, onReset }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function doReset() {
    setLoading(true); setErr('')
    try {
      const res = await fetch(`${SERVER}/api/reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: code })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Wrong code')
      onReset(); onClose()
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Reset the hunt?</h3>
        <p>This deletes all teams, scores, photos and messages. Everyone will need to rejoin. Cannot be undone.</p>
        <input className="modal-input" type="password" placeholder="Enter reset code" value={code}
          onChange={e => setCode(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && doReset()} />
        {err && <p style={{ color: '#c00', fontSize: 13 }}>{err}</p>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-confirm" onClick={doReset} disabled={!code || loading}>
            {loading ? 'Resetting...' : 'Reset everything'}
          </button>
        </div>
      </div>
    </div>
  )
}
