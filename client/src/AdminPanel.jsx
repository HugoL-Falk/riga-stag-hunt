import { useState } from 'react'
import { SERVER, ADMIN_ANSWERS } from './constants.js'

export default function AdminPanel({ state, onClose }) {
  const [pw, setPw] = useState('')
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState('hunt')
  const [msg, setMsg] = useState('')
  const [countdown, setCountdown] = useState(state.countdownMinutes || 60)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerTeam, setNewPlayerTeam] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [resetCode, setResetCode] = useState('')

  async function post(path, body) {
    const res = await fetch(`${SERVER}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw, ...body }) })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error)
    return d
  }

  async function login() {
    try {
      await post('/api/admin/hunt', { action: 'set_countdown', countdown_minutes: 60 })
      setAuthed(true)
    } catch { setMsg('Wrong password') }
  }

  async function huntAction(action, extra = {}) {
    try {
      await post('/api/admin/hunt', { action, ...extra })
      flash('Done!')
    } catch(e) { flash(e.message, true) }
  }

  async function forceClaim(challengeId, teamId) {
    try { await post('/api/admin/force-claim', { team_id: teamId, challenge_id: challengeId, is_bonus: false }); flash('Claimed!') }
    catch(e) { flash(e.message, true) }
  }

  async function removeClaim(challengeId) {
    try { await post('/api/admin/remove-claim', { challenge_id: challengeId, is_bonus: false }); flash('Removed!') }
    catch(e) { flash(e.message, true) }
  }

  async function savePlayer() {
    if (!editingPlayer) return
    try {
      await post('/api/admin/player', { player_id: editingPlayer.id, name: newPlayerName || editingPlayer.name, team_id: newPlayerTeam || editingPlayer.team_id })
      setEditingPlayer(null); flash('Saved!')
    } catch(e) { flash(e.message, true) }
  }

  async function removePlayer(id) {
    if (!confirm('Remove this player?')) return
    try { await post('/api/admin/player', { player_id: id, action: 'remove' }); flash('Removed!') }
    catch(e) { flash(e.message, true) }
  }

  async function saveTeam() {
    if (!editingTeam) return
    try {
      await post('/api/admin/team', { team_id: editingTeam.id, name: newTeamName || editingTeam.name })
      setEditingTeam(null); flash('Saved!')
    } catch(e) { flash(e.message, true) }
  }

  async function removeTeam(id) {
    if (!confirm('Remove this team? Players will be unassigned.')) return
    try { await post('/api/admin/team', { team_id: id, action: 'remove' }); flash('Removed!') }
    catch(e) { flash(e.message, true) }
  }

  async function doReset() {
    if (resetCode !== 'reset') { flash('Wrong reset code', true); return }
    try {
      const res = await fetch(`${SERVER}/api/reset`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ secret: resetCode }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onClose(); flash('Hunt reset!')
    } catch(e) { flash(e.message, true) }
  }

  function flash(m, err = false) {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }

  const tabs = ['hunt','players','teams','claims','answers','reset']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div className="admin-header">
          <span className="admin-title">Admin Panel</span>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {!authed ? (
          <div className="admin-body">
            <p className="admin-hint">Enter admin password</p>
            <input className="field" type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} autoFocus onKeyDown={e => e.key==='Enter'&&login()} />
            {msg && <p className="form-err">{msg}</p>}
            <button className="big-btn" onClick={login} style={{ marginTop:8 }}>Login</button>
          </div>
        ) : (
          <>
            {msg && <div className={`admin-toast ${msg.includes('Wrong')||msg.includes('Error')?'err':''}`}>{msg}</div>}
            <div className="admin-tabs">
              {tabs.map(t => <button key={t} className={`admin-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
            </div>
            <div className="admin-body">

              {tab === 'hunt' && (
                <div className="admin-section">
                  <div className="admin-status">
                    Hunt status: <strong>{state.huntStatus}</strong>
                    {state.huntStatus === 'active' && <span> · {state.countdownMinutes}min countdown</span>}
                    {state.resultsEnabled && <span> · Results visible</span>}
                  </div>

                  {state.huntStatus === 'waiting' && (
                    <>
                      <label className="field-label">Countdown duration (minutes)</label>
                      <input className="field" type="number" min="10" max="180" value={countdown} onChange={e => setCountdown(e.target.value)} />
                      <button className="big-btn green" onClick={() => huntAction('start', { countdown_minutes: countdown })}>▶ Start the hunt</button>
                    </>
                  )}
                  {state.huntStatus === 'active' && (
                    <button className="big-btn red" onClick={() => { if(confirm('End the hunt?')) huntAction('finish') }}>■ Finish the hunt</button>
                  )}
                  {state.huntStatus === 'finished' && (
                    <>
                      <button className="big-btn" onClick={() => huntAction('reopen')}>↺ Reopen hunt</button>
                      {!state.resultsEnabled
                        ? <button className="big-btn green" onClick={() => huntAction('enable_results')}>🏆 Enable results screen</button>
                        : <button className="big-btn" onClick={() => huntAction('disable_results')}>Hide results screen</button>
                      }
                    </>
                  )}
                  {(state.huntStatus === 'active' || state.huntStatus === 'finished') && (
                    <button className="big-btn ghost" style={{ marginTop:8 }} onClick={() => huntAction('waiting')}>← Back to waiting room</button>
                  )}
                </div>
              )}

              {tab === 'players' && (
                <div className="admin-section">
                  <div className="admin-section-label">{state.players.length} players joined</div>
                  {state.players.map(p => {
                    const team = state.teams.find(t => t.id === p.team_id)
                    const isEditing = editingPlayer?.id === p.id
                    return (
                      <div key={p.id} className="admin-row">
                        {isEditing ? (
                          <div className="admin-edit-form">
                            <input className="field sm" placeholder="Name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} />
                            <select className="field sm" value={newPlayerTeam || p.team_id || ''} onChange={e => setNewPlayerTeam(e.target.value)}>
                              <option value="">No team</option>
                              {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <div style={{ display:'flex', gap:6, marginTop:4 }}>
                              <button className="admin-action-btn green" onClick={savePlayer}>Save</button>
                              <button className="admin-action-btn" onClick={() => setEditingPlayer(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="admin-row-info">
                              <span className="admin-row-name">{p.name}</span>
                              {team && <span className="admin-row-team" style={{ color: team.color }}>{team.name}</span>}
                              {p.ready ? <span className="ready-badge">Ready</span> : null}
                            </div>
                            <div className="admin-row-actions">
                              <button className="admin-action-btn" onClick={() => { setEditingPlayer(p); setNewPlayerName(p.name); setNewPlayerTeam(p.team_id||'') }}>Edit</button>
                              <button className="admin-action-btn red" onClick={() => removePlayer(p.id)}>Remove</button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'teams' && (
                <div className="admin-section">
                  <div className="admin-section-label">{state.teams.length} teams</div>
                  {state.teams.map(t => {
                    const members = state.players.filter(p => p.team_id === t.id)
                    const isEditing = editingTeam?.id === t.id
                    return (
                      <div key={t.id} className="admin-row">
                        {isEditing ? (
                          <div className="admin-edit-form">
                            <input className="field sm" placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                            <div style={{ display:'flex', gap:6, marginTop:4 }}>
                              <button className="admin-action-btn green" onClick={saveTeam}>Save</button>
                              <button className="admin-action-btn" onClick={() => setEditingTeam(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="admin-row-info">
                              <span className="tdot" style={{ background: t.color }} />
                              <span className="admin-row-name">{t.name}</span>
                              <span className="admin-row-meta">{members.length} member{members.length!==1?'s':''} · {state.scores[t.id]||0}pts</span>
                            </div>
                            <div className="admin-row-actions">
                              <button className="admin-action-btn" onClick={() => { setEditingTeam(t); setNewTeamName(t.name) }}>Edit</button>
                              <button className="admin-action-btn red" onClick={() => removeTeam(t.id)}>Remove</button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'claims' && (
                <div className="admin-section">
                  <div className="admin-section-label">Force-claim / override landmark challenges</div>
                  {state.challenges.filter(ch => ch.category === 'landmark').map(ch => {
                    const claim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
                    const ct = claim ? state.teams.find(t => t.id === claim.team_id) : null
                    return (
                      <div key={ch.id} className="admin-ch-row">
                        <div className="admin-ch-title"><span className="pts-mini">{ch.pts}pt</span>{ch.title}</div>
                        {claim ? (
                          <div className="admin-ch-claimed">
                            <span style={{ color: ct?.color }}>{ct?.name}</span>
                            <button className="admin-action-btn red" onClick={() => removeClaim(String(ch.id))}>Remove</button>
                          </div>
                        ) : (
                          <div className="admin-ch-teams">
                            {state.teams.map(t => (
                              <button key={t.id} className="admin-team-btn" style={{ borderColor: t.color, color: t.color }} onClick={() => forceClaim(String(ch.id), t.id)}>{t.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'answers' && (
                <div className="admin-section">
                  <div className="admin-section-label">Correct answers for trivia disputes</div>
                  {Object.entries(ADMIN_ANSWERS).map(([id, {q,a}]) => (
                    <div key={id} className="admin-answer">
                      <div className="admin-answer-q">{q}</div>
                      <div className="admin-answer-a">✓ {a}</div>
                    </div>
                  ))}
                  <div className="admin-section-label" style={{ marginTop:16 }}>Team answers submitted</div>
                  {state.claims.filter(c => c.answer_text).map(c => {
                    const team = state.teams.find(t => t.id === c.team_id)
                    return (
                      <div key={c.id} className="admin-answer">
                        <div className="admin-answer-q" style={{ color: team?.color }}>{team?.name} — challenge {c.challenge_id}</div>
                        <div className={`admin-answer-a ${c.answer_correct?'':'wrong'}`}>{c.answer_correct?'✓':'✗'} {c.answer_text}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'reset' && (
                <div className="admin-section">
                  <div className="admin-section-label" style={{ color:'#c00' }}>Danger zone</div>
                  <p style={{ fontSize:13, color:'#666', marginBottom:10, lineHeight:1.5 }}>This deletes all teams, players, scores, photos and messages. Cannot be undone.</p>
                  <input className="field" type="password" placeholder="Enter reset code" value={resetCode} onChange={e => setResetCode(e.target.value)} />
                  <button className="big-btn red" style={{ marginTop:8 }} onClick={doReset} disabled={!resetCode}>Reset everything</button>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}
