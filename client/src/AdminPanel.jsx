import { useState } from 'react'
import { SERVER, ADMIN_ANSWERS, isVideo } from './constants.js'

export default function AdminPanel({ state, onClose }) {
  const [pw, setPw] = useState('')
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState('hunt')
  const [msg, setMsg] = useState('')
  const [msgErr, setMsgErr] = useState(false)
  const [countdown, setCountdown] = useState(state.countdownMinutes || 60)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerTeam, setNewPlayerTeam] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)

  async function post(path, body) {
    const res = await fetch(`${SERVER}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw, ...body }) })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error)
    return d
  }

  async function login() {
    try { await post('/api/admin/hunt', { action:'set_countdown', countdown_minutes: 60 }); setAuthed(true); }
    catch { flash('Wrong password', true) }
  }

  async function huntAction(action, extra={}) {
    try { await post('/api/admin/hunt', { action, ...extra }); flash('Done!'); }
    catch(e) { flash(e.message, true) }
  }

  async function adjustTime(minutes) {
    const sign = minutes > 0 ? '+' : ''
    if (!confirm(`${sign}${minutes} minutes to the hunt timer?`)) return
    try { await post('/api/admin/hunt', { action: 'adjust_time', adjust_minutes: minutes }); flash(`Time adjusted ${sign}${minutes} min`) }
    catch(e) { flash(e.message, true) }
  }

  async function removeClaim(challengeId, isBonus=false) {
    try { await post('/api/admin/remove-claim', { challenge_id: challengeId, is_bonus: isBonus }); flash('Claim removed — now available again'); }
    catch(e) { flash(e.message, true) }
  }

  async function forceClaim(challengeId, teamId, isBonus=false) {
    try { await post('/api/admin/force-claim', { team_id: teamId, challenge_id: challengeId, is_bonus: isBonus }); flash('Force-claimed!'); }
    catch(e) { flash(e.message, true) }
  }

  async function savePlayer() {
    try { await post('/api/admin/player', { player_id: editingPlayer.id, name: newPlayerName||editingPlayer.name, team_id: newPlayerTeam||editingPlayer.team_id }); setEditingPlayer(null); flash('Saved!'); }
    catch(e) { flash(e.message, true) }
  }

  async function removePlayer(id) {
    if (!confirm('Remove player?')) return
    try { await post('/api/admin/player', { player_id: id, action:'remove' }); flash('Removed!'); }
    catch(e) { flash(e.message, true) }
  }

  async function saveTeam() {
    try { await post('/api/admin/team', { team_id: editingTeam.id, name: newTeamName||editingTeam.name }); setEditingTeam(null); flash('Saved!'); }
    catch(e) { flash(e.message, true) }
  }

  async function removeTeam(id) {
    if (!confirm('Remove team? Players will be unassigned.')) return
    try { await post('/api/admin/team', { team_id: id, action:'remove' }); flash('Removed!'); }
    catch(e) { flash(e.message, true) }
  }

  async function doReset() {
    try {
      const res = await fetch(`${SERVER}/api/reset`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ secret: resetCode }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onClose()
    } catch(e) { flash(e.message, true) }
  }

  function flash(m, err=false) { setMsg(m); setMsgErr(err); setTimeout(()=>setMsg(''), 3000) }

  const tabs = ['hunt','claims','players','teams','reset']

  return (
    <div className="modal-overlay" onClick={onClose}>
      {lightboxUrl && (
        <div className="lightbox" onClick={() => setLightboxUrl(null)}>
          <div className="lightbox-bar"><button className="lightbox-back" onClick={() => setLightboxUrl(null)}>← Back</button></div>
          <div className="lightbox-content">
            {isVideo(lightboxUrl) ? <video className="lightbox-media" src={SERVER+lightboxUrl} controls autoPlay playsInline onClick={e=>e.stopPropagation()} /> : <img className="lightbox-media" src={SERVER+lightboxUrl} alt="" onClick={e=>e.stopPropagation()} />}
          </div>
        </div>
      )}
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div className="admin-header">
          <span className="admin-title">Admin Panel</span>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {!authed ? (
          <div className="admin-body">
            <p style={{ fontSize:13, color:'#666' }}>Enter admin password</p>
            <input className="field" type="password" placeholder="" value={pw} onChange={e=>setPw(e.target.value)} autoFocus onKeyDown={e=>e.key==='Enter'&&login()} />
            {msg && <p className="form-err">{msg}</p>}
            <button className="big-btn" onClick={login} style={{ marginTop:8 }}>Login</button>
          </div>
        ) : (
          <>
            {msg && <div className={`admin-toast ${msgErr?'err':''}`}>{msg}</div>}
            <div className="admin-tabs">
              {tabs.map(t => <button key={t} className={`admin-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
            </div>
            <div className="admin-body">

              {/* ── HUNT TAB ── */}
              {tab === 'hunt' && (
                <div className="admin-section">
                  <div className="admin-status">Status: <strong>{state.huntStatus}</strong>{state.huntStatus==='active'&&<span> · {state.countdownMinutes}min</span>}{state.resultsEnabled&&<span> · Results visible</span>}</div>
                  {state.huntStatus === 'waiting' && (
                    <>
                      <label className="field-label">Countdown duration (minutes)</label>
                      <input className="field" type="number" min="10" max="180" value={countdown} onChange={e=>setCountdown(e.target.value)} />
                      <button className="big-btn green" onClick={()=>huntAction('start',{countdown_minutes:countdown})}>▶ Start the hunt</button>
                    </>
                  )}
                  {state.huntStatus === 'active' && (
                    <>
                      <button className="big-btn red" onClick={()=>{if(confirm('End the hunt now?'))huntAction('finish')}}>■ Finish the hunt</button>
                      <div className="admin-section-label" style={{marginTop:8}}>Adjust time mid-hunt</div>
                      <div className="time-adjust-row">
                        <button className="time-adj-btn minus" onClick={()=>adjustTime(-10)}>−10 min</button>
                        <button className="time-adj-btn minus" onClick={()=>adjustTime(-5)}>−5 min</button>
                        <button className="time-adj-btn minus" onClick={()=>adjustTime(-1)}>−1 min</button>
                        <button className="time-adj-btn plus" onClick={()=>adjustTime(1)}>+1 min</button>
                        <button className="time-adj-btn plus" onClick={()=>adjustTime(5)}>+5 min</button>
                        <button className="time-adj-btn plus" onClick={()=>adjustTime(10)}>+10 min</button>
                      </div>
                    </>
                  )}
                  {state.huntStatus === 'finished' && (
                    <>
                      <button className="big-btn" onClick={()=>huntAction('reopen')}>↺ Reopen hunt</button>
                      {!state.resultsEnabled
                        ? <button className="big-btn green" onClick={()=>huntAction('enable_results')}>🏆 Enable results screen</button>
                        : <button className="big-btn ghost" onClick={()=>huntAction('disable_results')}>Hide results</button>}
                    </>
                  )}
                  {(state.huntStatus==='active'||state.huntStatus==='finished') && (
                    <button className="big-btn ghost" style={{marginTop:4}} onClick={()=>huntAction('waiting')}>← Back to waiting room</button>
                  )}
                </div>
              )}

              {/* ── CLAIMS TAB (combined with answers) ── */}
              {tab === 'claims' && (
                <div className="admin-section">
                  <p style={{fontSize:12,color:'#888',marginBottom:8}}>Review all claims. Remove a claim to send it back to unclaimed so others can race for it.</p>

                  {/* Correct answers reference */}
                  <div className="admin-section-label">Correct answers reference</div>
                  {Object.entries(ADMIN_ANSWERS).map(([id,{q,a}]) => (
                    <div key={id} className="admin-answer"><div className="admin-answer-q">{q}</div><div className="admin-answer-a">✓ {a}</div></div>
                  ))}

                  <div className="admin-section-label" style={{marginTop:14}}>All challenges</div>
                  {state.challenges.map(ch => {
                    const mainClaim = state.claims.find(c => c.challenge_id===String(ch.id) && !c.is_bonus)
                    const claimTeam = mainClaim ? state.teams.find(t=>t.id===mainClaim.team_id) : null
                    const bonusClaims = ch.bonus?.map(b => {
                      const bc = state.claims.find(c=>c.challenge_id===`${ch.id}_bonus_${b.id}`)
                      const bt = bc ? state.teams.find(t=>t.id===bc.team_id) : null
                      return { bonus: b, claim: bc, team: bt }
                    }) || []

                    return (
                      <div key={ch.id} className="admin-ch-card">
                        <div className="admin-ch-header">
                          <span className="pts-mini">{ch.pts}pt</span>
                          <span className="admin-ch-title-text">{ch.title}</span>
                          <span style={{fontSize:10,color:'#aaa',marginLeft:'auto'}}>{ch.hint}</span>
                        </div>

                        {/* Main claim */}
                        {mainClaim ? (
                          <div className="admin-claim-row">
                            <div className="admin-claim-info">
                              {mainClaim.photo_url && (
                                <div className="admin-thumb-wrap" onClick={()=>setLightboxUrl(mainClaim.photo_url)}>
                                  {isVideo(mainClaim.photo_url)
                                    ? <div className="admin-thumb video">▶</div>
                                    : <img className="admin-thumb" src={SERVER+mainClaim.photo_url} alt="" />}
                                </div>
                              )}
                              <div className="admin-claim-meta">
                                <span style={{color:claimTeam?.color,fontWeight:700}}>{claimTeam?.name}</span>
                                {mainClaim.answer_text && <span className={`admin-answer-inline ${mainClaim.answer_correct?'ok':'no'}`}>{mainClaim.answer_correct?'✓':'✗'} {mainClaim.answer_text}</span>}
                              </div>
                            </div>
                            <button className="admin-action-btn red" onClick={()=>removeClaim(String(ch.id),false)}>Remove</button>
                          </div>
                        ) : (
                          <div className="admin-unclaimed-row">
                            <span>Unclaimed</span>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                              {state.teams.map(t => (
                                <button key={t.id} className="admin-team-btn" style={{borderColor:t.color,color:t.color}} onClick={()=>forceClaim(String(ch.id),t.id)}>{t.name}</button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bonus claims */}
                        {bonusClaims.filter(({claim})=>claim||true).map(({bonus,claim,team}) => (
                          <div key={bonus.id} className="admin-bonus-claim-row">
                            <span className="bonus-mini">+{bonus.pts}pt</span>
                            <span className="admin-bonus-text">{bonus.text.slice(0,50)}{bonus.text.length>50?'…':''}</span>
                            {claim ? (
                              <>
                                {claim.photo_url && (
                                  <div className="admin-thumb-wrap sm" onClick={()=>setLightboxUrl(claim.photo_url)}>
                                    {isVideo(claim.photo_url)
                                      ? <div className="admin-thumb video sm">▶</div>
                                      : <img className="admin-thumb sm" src={SERVER+claim.photo_url} alt="" />}
                                  </div>
                                )}
                                <span style={{color:team?.color,fontWeight:700,fontSize:11}}>{team?.name}</span>
                                {claim.answer_text && <span className={`admin-answer-inline ${claim.answer_correct?'ok':'no'}`}>{claim.answer_correct?'✓':'✗'} {claim.answer_text}</span>}
                                <button className="admin-action-btn red sm" onClick={()=>removeClaim(`${ch.id}_bonus_${bonus.id}`,true)}>✕</button>
                              </>
                            ) : (
                              <span style={{fontSize:11,color:'#bbb'}}>unclaimed</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── PLAYERS TAB ── */}
              {tab === 'players' && (
                <div className="admin-section">
                  <div className="admin-section-label">{state.players.length} players</div>
                  {state.players.map(p => {
                    const team = state.teams.find(t=>t.id===p.team_id)
                    const isEditing = editingPlayer?.id===p.id
                    return (
                      <div key={p.id} className="admin-row">
                        {isEditing ? (
                          <div className="admin-edit-form">
                            <input className="field sm" placeholder="" value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} />
                            <select className="field sm" value={newPlayerTeam||p.team_id||''} onChange={e=>setNewPlayerTeam(e.target.value)}>
                              <option value="">No team</option>
                              {state.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <div style={{display:'flex',gap:6,marginTop:4}}>
                              <button className="admin-action-btn green" onClick={savePlayer}>Save</button>
                              <button className="admin-action-btn" onClick={()=>setEditingPlayer(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="admin-row-info">
                              <span className="admin-row-name">{p.name}</span>
                              {team && <span className="admin-row-team" style={{color:team.color}}>{team.name}</span>}
                              {p.ready ? <span className="ready-badge">Ready</span> : null}
                            </div>
                            <div className="admin-row-actions">
                              <button className="admin-action-btn" onClick={()=>{setEditingPlayer(p);setNewPlayerName(p.name);setNewPlayerTeam(p.team_id||'')}}>Edit</button>
                              <button className="admin-action-btn red" onClick={()=>removePlayer(p.id)}>✕</button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── TEAMS TAB ── */}
              {tab === 'teams' && (
                <div className="admin-section">
                  <div className="admin-section-label">{state.teams.length} teams</div>
                  {state.teams.map(t => {
                    const members = state.players.filter(p=>p.team_id===t.id)
                    const isEditing = editingTeam?.id===t.id
                    return (
                      <div key={t.id} className="admin-row">
                        {isEditing ? (
                          <div className="admin-edit-form">
                            <input className="field sm" placeholder="" value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} />
                            <div style={{display:'flex',gap:6,marginTop:4}}>
                              <button className="admin-action-btn green" onClick={saveTeam}>Save</button>
                              <button className="admin-action-btn" onClick={()=>setEditingTeam(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="admin-row-info">
                              <span className="tdot" style={{background:t.color}} />
                              <span className="admin-row-name">{t.name}</span>
                              <span className="admin-row-meta">{members.length} members · {state.scores[t.id]||0}pts</span>
                            </div>
                            <div className="admin-row-actions">
                              <button className="admin-action-btn" onClick={()=>{setEditingTeam(t);setNewTeamName(t.name)}}>Edit</button>
                              <button className="admin-action-btn red" onClick={()=>removeTeam(t.id)}>✕</button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── RESET TAB ── */}
              {tab === 'reset' && (
                <div className="admin-section">
                  <div className="admin-section-label" style={{color:'#c00'}}>Danger zone</div>
                  <p style={{fontSize:13,color:'#666',lineHeight:1.5}}>Deletes all teams, players, scores, photos and messages. Cannot be undone.</p>
                  <input className="field" type="password" placeholder="" value={resetCode} onChange={e=>setResetCode(e.target.value)} />
                  <button className="big-btn red" style={{marginTop:8}} onClick={doReset} disabled={!resetCode}>Reset everything</button>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}
