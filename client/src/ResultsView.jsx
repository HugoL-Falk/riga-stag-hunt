import { useEffect, useRef, useState } from 'react'
import { SERVER } from './constants.js'

export default function ResultsView({ state }) {
  const [data, setData] = useState(null)
  const [animStep, setAnimStep] = useState(0)
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    fetch(`${SERVER}/api/results`).then(r => r.json()).then(d => { setData(d); setTimeout(() => animate(d), 400) })
  }, [])

  function animate(d) {
    const steps = d.timeline.length
    let i = 0
    const iv = setInterval(() => {
      i++; setAnimStep(i)
      if (i >= steps) clearInterval(iv)
    }, 120)
  }

  // Load Leaflet for movement map
  useEffect(() => {
    if (window.L) { setMapReady(true); return }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link)
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => setMapReady(true); document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!mapReady || !containerRef.current || mapRef.current || !data) return
    const L = window.L
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([56.9490, 24.1070], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    L.control.attribution({ prefix: '© OpenStreetMap' }).addTo(map)
    mapRef.current = map

    // Draw trails per player
    const playerPaths = {}
    data.locHistory.forEach(pt => {
      const key = pt.player_id
      if (!playerPaths[key]) playerPaths[key] = { color: pt.team_color || '#888', name: pt.player_name, pts: [] }
      playerPaths[key].pts.push([pt.lat, pt.lng])
    })
    Object.values(playerPaths).forEach(p => {
      if (p.pts.length < 2) return
      L.polyline(p.pts, { color: p.color, weight: 3, opacity: 0.7 }).addTo(map)
      // End marker
      const last = p.pts[p.pts.length - 1]
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="${p.color}" stroke="white" stroke-width="2"/><text x="11" y="11" font-size="9" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${p.name[0].toUpperCase()}</text></svg>`
      L.marker(last, { icon: L.divIcon({ html: svg, className:'', iconSize:[22,22], iconAnchor:[11,11] }) }).addTo(map).bindTooltip(p.name)
    })
  }, [mapReady, data])

  if (!data) return <div className="results-loading">Loading results…</div>

  const sorted = [...state.teams].sort((a,b) => (data.scores[b.id]||0)-(data.scores[a.id]||0))
  const maxScore = Math.max(1, ...sorted.map(t => data.scores[t.id]||0))

  // Build chart data
  const chartTeams = state.teams
  const visibleTimeline = data.timeline.slice(0, animStep)
  const maxElapsed = data.timeline.length ? data.timeline[data.timeline.length-1].elapsed : 3600

  // Running scores at each step for line chart
  const chartPoints = {} // team_id -> [{x, y}]
  state.teams.forEach(t => { chartPoints[t.id] = [{ x: 0, y: 0 }] })
  data.timeline.forEach((ev, i) => {
    if (i >= animStep) return
    state.teams.forEach(t => {
      const last = chartPoints[t.id][chartPoints[t.id].length-1]
      chartPoints[t.id].push({ x: ev.elapsed, y: ev.team_id === t.id ? ev.running[t.id] || 0 : last.y })
    })
  })

  const W = 320, H = 160, PAD = 32
  function toSvgX(elapsed) { return PAD + ((elapsed / Math.max(maxElapsed, 1)) * (W - PAD * 2)) }
  function toSvgY(score) { return H - PAD - ((score / maxScore) * (H - PAD * 2)) }

  function pathForTeam(teamId) {
    const pts = chartPoints[teamId]
    if (pts.length < 2) return ''
    return pts.map((p, i) => `${i===0?'M':'L'}${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`).join(' ')
  }

  const podiumOrder = [1, 0, 2] // 2nd, 1st, 3rd for visual
  const podiumHeights = [80, 110, 60]

  return (
    <div className="results-view">
      {/* Podium */}
      <div className="results-section">
        <div className="results-section-title">Final results</div>
        <div className="podium">
          {podiumOrder.map((rank, pi) => {
            const team = sorted[rank]
            if (!team) return <div key={pi} className="podium-slot" />
            const pts = data.scores[team.id] || 0
            return (
              <div key={team.id} className="podium-slot">
                <div className="podium-name" style={{ color: team.color }}>{team.name}</div>
                <div className="podium-pts">{pts}pt{pts!==1?'s':''}</div>
                <div className="podium-block" style={{ height: podiumHeights[pi], background: team.color, opacity: 0.9 }}>
                  <div className="podium-rank">{rank+1 === 1 ? '🏆' : rank+1 === 2 ? '🥈' : '🥉'}</div>
                </div>
              </div>
            )
          })}
        </div>
        {sorted.slice(3).map((t, i) => (
          <div key={t.id} className="results-row">
            <span className="results-pos">#{i+4}</span>
            <span className="tdot" style={{ background: t.color }} />
            <span className="results-team">{t.name}</span>
            <span className="results-score">{data.scores[t.id]||0}pts</span>
          </div>
        ))}
      </div>

      {/* Timeline chart */}
      <div className="results-section">
        <div className="results-section-title">Score progression</div>
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow:'visible' }}>
            {/* Grid lines */}
            {[0,0.25,0.5,0.75,1].map(f => (
              <line key={f} x1={PAD} y1={toSvgY(maxScore*f)} x2={W-PAD} y2={toSvgY(maxScore*f)} stroke="#e5e2dc" strokeWidth="1" />
            ))}
            {/* Score labels */}
            {[0,Math.round(maxScore/2),maxScore].map(s => (
              <text key={s} x={PAD-4} y={toSvgY(s)+4} fontSize="9" fill="#aaa" textAnchor="end">{s}</text>
            ))}
            {/* Team lines */}
            {state.teams.map(t => (
              <path key={t.id} d={pathForTeam(t.id)} fill="none" stroke={t.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {/* Event dots */}
            {visibleTimeline.map((ev, i) => {
              const team = state.teams.find(t => t.id === ev.team_id)
              if (!team) return null
              return <circle key={i} cx={toSvgX(ev.elapsed)} cy={toSvgY(ev.running[ev.team_id]||0)} r="4" fill={team.color} stroke="white" strokeWidth="1.5" />
            })}
          </svg>
          {/* Legend */}
          <div className="chart-legend">
            {state.teams.map(t => (
              <div key={t.id} className="chart-legend-item">
                <span className="tdot" style={{ background: t.color }} />
                <span>{t.name}</span>
              </div>
            ))}
          </div>
          {/* Time axis labels */}
          <div className="chart-time-labels">
            <span>0 min</span>
            <span>{Math.round(maxElapsed/60)} min</span>
          </div>
        </div>
      </div>

      {/* Movement map */}
      <div className="results-section">
        <div className="results-section-title">Where everyone went</div>
        <div ref={containerRef} className="results-map" />
        {!mapReady && <div className="map-loading">Loading map…</div>}
      </div>

      {/* Challenge breakdown */}
      <div className="results-section">
        <div className="results-section-title">Challenge breakdown</div>
        {state.challenges.filter(ch => state.claims.some(c => c.challenge_id === String(ch.id) && !c.is_bonus)).map(ch => {
          const claim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus)
          const team = state.teams.find(t => t.id === claim.team_id)
          const bonusClaims = ch.bonus?.filter(b => state.claims.some(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)) || []
          return (
            <div key={ch.id} className="results-ch-row">
              <div className="results-ch-title">{ch.title}</div>
              <div className="results-ch-meta">
                <span style={{ color: team?.color, fontWeight:600 }}>{team?.name}</span>
                <span className="results-ch-pts">+{ch.pts}pt{ch.pts>1?'s':''}</span>
                {bonusClaims.map(b => {
                  const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`)
                  const bt = state.teams.find(t => t.id === bc.team_id)
                  return <span key={b.id} className="results-bonus-tag" style={{ background: `${bt?.color}22`, color: bt?.color }}>+{b.pts} {bt?.name}</span>
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
