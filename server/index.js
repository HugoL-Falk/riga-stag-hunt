const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const CHALLENGES = require('./challenges');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) app.use(express.static(CLIENT_DIST));

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'hunt.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS hunt_config (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, team_id TEXT, ready INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY, team_id TEXT NOT NULL, challenge_id TEXT NOT NULL,
    is_bonus INTEGER DEFAULT 0, photo_url TEXT, answer_text TEXT, answer_correct INTEGER DEFAULT 0,
    claimed_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(team_id, challenge_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, player_id TEXT, team_id TEXT, team_name TEXT, team_color TEXT,
    sender_name TEXT NOT NULL, text TEXT NOT NULL, image_url TEXT, is_system INTEGER DEFAULT 0,
    sent_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS location_history (
    id TEXT PRIMARY KEY, player_id TEXT NOT NULL, player_name TEXT NOT NULL,
    team_id TEXT, team_color TEXT, lat REAL NOT NULL, lng REAL NOT NULL,
    recorded_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

const safeAlter = sql => { try { db.exec(sql); } catch {} };
safeAlter('ALTER TABLE claims ADD COLUMN answer_text TEXT');
safeAlter('ALTER TABLE claims ADD COLUMN answer_correct INTEGER DEFAULT 0');
safeAlter('ALTER TABLE messages ADD COLUMN image_url TEXT');
safeAlter('ALTER TABLE messages ADD COLUMN player_id TEXT');
safeAlter('ALTER TABLE messages ADD COLUMN is_system INTEGER DEFAULT 0');
safeAlter('ALTER TABLE messages ADD COLUMN team_id TEXT');
safeAlter('ALTER TABLE messages ADD COLUMN team_name TEXT');
safeAlter('ALTER TABLE messages ADD COLUMN team_color TEXT');
safeAlter('ALTER TABLE players ADD COLUMN ready INTEGER DEFAULT 0');

function getConfig(key, def = null) {
  const row = db.prepare('SELECT value FROM hunt_config WHERE key = ?').get(key);
  return row ? row.value : def;
}
function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO hunt_config (key, value) VALUES (?, ?)').run(key, String(value));
}

if (!getConfig('hunt_status')) setConfig('hunt_status', 'waiting');
if (!getConfig('results_enabled')) setConfig('results_enabled', 'false');
if (!getConfig('countdown_minutes')) setConfig('countdown_minutes', '60');
if (!getConfig('hunt_start_time')) setConfig('hunt_start_time', '0');

const TEAM_COLORS = ['#378ADD','#1D9E75','#D85A30','#7F77DD','#E2A020','#A32D2D'];
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2024';
const RESET_CODE = process.env.RESET_CODE || 'reset';

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => { const ext = path.extname(file.originalname) || '.jpg'; cb(null, `${uuidv4()}${ext}`); }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, /jpeg|jpg|png|gif|webp|mp4|mov|quicktime|video/.test(file.mimetype)) });
const chatUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, /jpeg|jpg|png|gif|webp/.test(file.mimetype)) });

// ── System message helper ─────────────────────────────────────────────────────
function postSystemMessage(text) {
  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, sender_name, text, is_system) VALUES (?, ?, ?, 1)').run(id, 'system', text);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  io.emit('new_message', msg);
  return msg;
}

// ── State builder ─────────────────────────────────────────────────────────────
function getState() {
  const teams = db.prepare('SELECT * FROM teams ORDER BY created_at ASC').all();
  const players = db.prepare('SELECT * FROM players ORDER BY created_at ASC').all();
  const claims = db.prepare('SELECT * FROM claims ORDER BY claimed_at ASC').all();
  const messages = db.prepare('SELECT * FROM messages ORDER BY sent_at ASC LIMIT 400').all();
  const huntStatus = getConfig('hunt_status', 'waiting');
  const resultsEnabled = getConfig('results_enabled', 'false') === 'true';
  const countdownMinutes = parseInt(getConfig('countdown_minutes', '60'));
  const huntStartTime = parseInt(getConfig('hunt_start_time', '0'));

  const scores = {};
  teams.forEach(t => { scores[t.id] = 0; });
  claims.forEach(c => {
    if (!(c.team_id in scores)) scores[c.team_id] = 0;
    const baseId = c.challenge_id.split('_bonus_')[0];
    const ch = CHALLENGES.find(ch => String(ch.id) === baseId);
    if (!ch) return;
    if (c.is_bonus) {
      const bonus = ch.bonus?.find(b => b.id === c.challenge_id.split('_bonus_')[1]);
      if (bonus) scores[c.team_id] += bonus.pts;
    } else { scores[c.team_id] += ch.pts; }
  });

  return { teams, players, claims, messages, scores, challenges: CHALLENGES, huntStatus, resultsEnabled, countdownMinutes, huntStartTime };
}

function broadcast(event, data) { io.emit(event, data); }
function broadcastState() { broadcast('state_update', getState()); }
function checkAnswer(text, correct) {
  if (!correct) return true;
  return text.toLowerCase().trim().includes(correct.toLowerCase().trim());
}

// ── Countdown system messages ──────────────────────────────────────────────────
let countdownTimers = [];
function clearCountdownTimers() { countdownTimers.forEach(t => clearTimeout(t)); countdownTimers = []; }
function scheduleCountdownMessages(startTime, totalMinutes) {
  clearCountdownTimers();
  const totalMs = totalMinutes * 60 * 1000;
  const now = Date.now();
  const elapsed = now - startTime;

  function schedule(atMs, fn) {
    const delay = atMs - elapsed;
    if (delay > 0) countdownTimers.push(setTimeout(fn, delay));
  }

  schedule(totalMs - 30 * 60 * 1000, () => {
    postSystemMessage('⏰ 30 minutes remaining in the hunt!');
    broadcastState();
  });
  schedule(totalMs - 10 * 60 * 1000, () => {
    postSystemMessage('🚨 Only 10 minutes left — finish your challenges!');
    broadcastState();
  });
  schedule(totalMs, () => {
    postSystemMessage('🏁 Time is up! Return to the pub and await the final results…');
    broadcastState();
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/state', (req, res) => res.json(getState()));

app.post('/api/players/join', (req, res) => {
  const { name, team_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (team_id) { if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(team_id)) return res.status(400).json({ error: 'Team not found' }); }
  let player = db.prepare('SELECT * FROM players WHERE name = ?').get(name.trim());
  if (player) {
    if (team_id && team_id !== player.team_id) db.prepare('UPDATE players SET team_id = ? WHERE id = ?').run(team_id, player.id);
    player = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
  } else {
    const id = uuidv4();
    try { db.prepare('INSERT INTO players (id, name, team_id) VALUES (?, ?, ?)').run(id, name.trim(), team_id || null); player = db.prepare('SELECT * FROM players WHERE id = ?').get(id); }
    catch(e) { if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Name already taken — pick another' }); throw e; }
  }
  broadcastState();
  res.json(player);
});

app.post('/api/players/:id/ready', (req, res) => {
  db.prepare('UPDATE players SET ready = ? WHERE id = ?').run(req.body.ready ? 1 : 0, req.params.id);
  broadcastState();
  res.json({ success: true });
});

app.post('/api/teams', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Team name required' });
  const existing = db.prepare('SELECT * FROM teams').all();
  if (existing.length >= 6) return res.status(400).json({ error: 'Max 6 teams' });
  const color = TEAM_COLORS.find(c => !existing.map(t => t.color).includes(c)) || TEAM_COLORS[existing.length % TEAM_COLORS.length];
  const id = uuidv4();
  try { db.prepare('INSERT INTO teams (id, name, color) VALUES (?, ?, ?)').run(id, name.trim(), color); }
  catch(e) { if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Team name already taken' }); throw e; }
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
  broadcastState();
  res.json(team);
});

app.post('/api/validate-answer', (req, res) => {
  const { challenge_id, is_bonus, answer_text } = req.body;
  if (!answer_text || !challenge_id) return res.status(400).json({ error: 'Missing fields' });
  const baseId = challenge_id.split('_bonus_')[0];
  const ch = CHALLENGES.find(c => String(c.id) === baseId);
  if (!ch) return res.status(404).json({ error: 'Not found' });
  let af = is_bonus ? ch.bonus?.find(b => b.id === challenge_id.split('_bonus_')[1])?.answerField : ch.answerField;
  if (!af?.correct) return res.json({ correct: true });
  res.json({ correct: checkAnswer(answer_text, af.correct) });
});

app.post('/api/claim', upload.single('media'), (req, res) => {
  const { team_id, challenge_id, is_bonus, answer_text, answer_only } = req.body;
  if (!team_id || !challenge_id) return res.status(400).json({ error: 'Missing fields' });
  if (answer_only !== 'true' && !req.file) return res.status(400).json({ error: 'Photo or video required' });
  if (getConfig('hunt_status') !== 'active') return res.status(400).json({ error: 'Hunt is not active' });

  const isBonus = is_bonus === 'true' ? 1 : 0;
  // First-wins check across all teams
  const existing = db.prepare('SELECT c.team_id, t.name as tname FROM claims c JOIN teams t ON c.team_id=t.id WHERE c.challenge_id=? AND c.is_bonus=?').get(challenge_id, isBonus);
  if (existing) return res.status(409).json({ error: `Already claimed by ${existing.tname}!` });

  const media_url = req.file ? `/uploads/${req.file.filename}` : null;
  const baseId = challenge_id.split('_bonus_')[0];
  const ch = CHALLENGES.find(c => String(c.id) === baseId);
  let answer_correct = 0;
  if (answer_text && ch) {
    const af = isBonus ? ch.bonus?.find(b => b.id === challenge_id.split('_bonus_')[1])?.answerField : ch.answerField;
    answer_correct = af?.correct ? (checkAnswer(answer_text, af.correct) ? 1 : 0) : 1;
  }

  try { db.prepare('INSERT INTO claims (id,team_id,challenge_id,is_bonus,photo_url,answer_text,answer_correct) VALUES (?,?,?,?,?,?,?)').run(uuidv4(), team_id, challenge_id, isBonus, media_url, answer_text||null, answer_correct); }
  catch(e) { if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Your team already claimed this' }); throw e; }

  // Post system message
  const team = db.prepare('SELECT * FROM teams WHERE id=?').get(team_id);
  if (team && ch) {
    const pts = isBonus ? (ch.bonus?.find(b => b.id === challenge_id.split('_bonus_')[1])?.pts || 0) : ch.pts;
    const bonusSuffix = isBonus ? ' (bonus)' : '';
    postSystemMessage(`🏅 ${team.name} just claimed "${ch.title}"${bonusSuffix} for +${pts}pt${pts!==1?'s':''}!`);
  }

  broadcastState();
  res.json({ success: true, media_url, answer_correct });
});

// Self-unclaim (team unclaims their own challenge)
app.post('/api/unclaim', (req, res) => {
  const { team_id, challenge_id, is_bonus } = req.body;
  if (!team_id || !challenge_id) return res.status(400).json({ error: 'Missing fields' });
  const isBonus = is_bonus ? 1 : 0;
  const claim = db.prepare('SELECT * FROM claims WHERE team_id=? AND challenge_id=? AND is_bonus=?').get(team_id, challenge_id, isBonus);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  // Delete the file if present
  if (claim.photo_url) { try { fs.unlinkSync(path.join(UPLOADS_DIR, claim.photo_url.replace('/uploads/',''))); } catch {} }
  db.prepare('DELETE FROM claims WHERE team_id=? AND challenge_id=? AND is_bonus=?').run(team_id, challenge_id, isBonus);
  // Post system message
  const team = db.prepare('SELECT * FROM teams WHERE id=?').get(team_id);
  const baseId = challenge_id.split('_bonus_')[0];
  const ch = CHALLENGES.find(c => String(c.id) === baseId);
  if (team && ch) {
    const bonusSuffix = isBonus ? ' (bonus)' : '';
    postSystemMessage(`↩ ${team.name} unclaimed "${ch.title}"${bonusSuffix} — it's up for grabs again!`);
  }
  broadcastState();
  res.json({ success: true });
});

app.post('/api/messages', chatUpload.single('image'), (req, res) => {
  const { player_id, team_id, team_name, team_color, sender_name, text } = req.body;
  if (!text?.trim() && !req.file) return res.status(400).json({ error: 'Empty' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const id = uuidv4();
  const msgText = (text||'').trim().slice(0,500) || '📷';
  db.prepare('INSERT INTO messages (id,player_id,team_id,team_name,team_color,sender_name,text,image_url) VALUES (?,?,?,?,?,?,?,?)').run(id, player_id||null, team_id, team_name, team_color, sender_name, msgText, image_url);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  broadcast('new_message', msg);
  res.json(msg);
});

// Download everything as zip
app.get('/api/download/photos', (req, res) => {
  const state = getState();
  const allClaims = db.prepare('SELECT * FROM claims WHERE photo_url IS NOT NULL').all();
  const chatMsgs = db.prepare('SELECT * FROM messages WHERE image_url IS NOT NULL').all();
  const teamMap = {};
  state.teams.forEach(t => { teamMap[t.id] = t.name; });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="riga-stag-hunt.zip"');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  // Challenge photos
  allClaims.forEach(c => {
    const fn = c.photo_url.replace('/uploads/','');
    const fp = path.join(UPLOADS_DIR, fn);
    if (!fs.existsSync(fp)) return;
    const tn = (teamMap[c.team_id]||'unknown').replace(/[^a-zA-Z0-9]/g,'_');
    archive.file(fp, { name: `challenges/${tn}/challenge-${c.challenge_id.replace('_bonus_','-bonus-')}${c.is_bonus?'-BONUS':''}${path.extname(fn)}` });
  });

  // Chat photos
  chatMsgs.forEach(m => {
    const fn = m.image_url.replace('/uploads/','');
    const fp = path.join(UPLOADS_DIR, fn);
    if (!fs.existsSync(fp)) return;
    const tn = (teamMap[m.team_id]||m.sender_name||'unknown').replace(/[^a-zA-Z0-9]/g,'_');
    archive.file(fp, { name: `chat/${tn}_${m.sent_at}${path.extname(fn)}` });
  });

  // Chat log text
  const allMsgs = db.prepare('SELECT * FROM messages ORDER BY sent_at ASC').all();
  let chatLog = `RIGA STAG HUNT — CHAT LOG\n${'='.repeat(40)}\n\n`;
  allMsgs.forEach(m => {
    const time = new Date(m.sent_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if (m.is_system) { chatLog += `[${time}] *** ${m.text} ***\n`; }
    else { chatLog += `[${time}] ${m.sender_name} (${m.team_name||'?'}): ${m.text}${m.image_url?' [📷 image]':''}\n`; }
  });
  archive.append(chatLog, { name: 'chat/chat-log.txt' });

  // Results summary
  let summary = `FINAL SCORES\n${'='.repeat(30)}\n`;
  [...state.teams].sort((a,b)=>(state.scores[b.id]||0)-(state.scores[a.id]||0)).forEach((t,i) => { summary += `${i+1}. ${t.name}: ${state.scores[t.id]||0}pts\n`; });
  archive.append(summary, { name: 'results.txt' });

  archive.finalize();
});

app.get('/api/results', (req, res) => {
  const state = getState();
  const locHistory = db.prepare('SELECT * FROM location_history ORDER BY recorded_at ASC').all();
  const huntStart = parseInt(getConfig('hunt_start_time','0'));
  const timeline = [];
  const running = {};
  state.teams.forEach(t => { running[t.id] = 0; });
  [...state.claims].sort((a,b)=>a.claimed_at-b.claimed_at).forEach(c => {
    const baseId = c.challenge_id.split('_bonus_')[0];
    const ch = CHALLENGES.find(ch => String(ch.id)===baseId);
    if (!ch || !(c.team_id in running)) return;
    let pts = c.is_bonus ? (ch.bonus?.find(b=>b.id===c.challenge_id.split('_bonus_')[1])?.pts||0) : ch.pts;
    if (!pts) return;
    running[c.team_id] += pts;
    timeline.push({ t: c.claimed_at, team_id: c.team_id, pts, running: {...running}, challenge: ch.title, elapsed: huntStart ? Math.max(0, c.claimed_at - Math.round(huntStart/1000)) : 0 });
  });
  res.json({ timeline, locHistory, huntStart, teams: state.teams, scores: state.scores });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/hunt', (req, res) => {
  const { password, action, countdown_minutes } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });

  if (action === 'start') {
    const mins = countdown_minutes || getConfig('countdown_minutes', 60);
    setConfig('hunt_status', 'active');
    const startTime = Date.now();
    setConfig('hunt_start_time', String(startTime));
    setConfig('countdown_minutes', String(mins));
    db.prepare('UPDATE players SET ready=0').run();
    postSystemMessage(`🚀 The hunt has started! You have ${mins} minutes. Good luck!`);
    scheduleCountdownMessages(startTime, parseInt(mins));
  } else if (action === 'finish') {
    setConfig('hunt_status', 'finished');
    clearCountdownTimers();
    postSystemMessage('🏁 The hunt is now over! Return to the pub and await the final results…');
  } else if (action === 'reopen') {
    const mins = getConfig('countdown_minutes', 60);
    const startTime = Date.now();
    setConfig('hunt_status', 'active');
    setConfig('hunt_start_time', String(startTime));
    postSystemMessage(`🔄 The hunt has been reopened! You have ${mins} minutes.`);
    scheduleCountdownMessages(startTime, parseInt(mins));
  } else if (action === 'waiting') {
    setConfig('hunt_status', 'waiting');
    setConfig('hunt_start_time', '0');
    clearCountdownTimers();
  } else if (action === 'set_countdown') {
    if (countdown_minutes) setConfig('countdown_minutes', String(countdown_minutes));
  } else if (action === 'adjust_time') {
    // adjust_minutes is a signed delta: positive = extend, negative = reduce
    const { adjust_minutes } = req.body;
    if (adjust_minutes) {
      const currentMins = parseInt(getConfig('countdown_minutes', '60'));
      const newMins = Math.max(1, currentMins + parseInt(adjust_minutes));
      setConfig('countdown_minutes', String(newMins));
      // Reschedule countdown warnings from now
      const startTime = parseInt(getConfig('hunt_start_time', '0'));
      clearCountdownTimers();
      scheduleCountdownMessages(startTime, newMins);
      const delta = parseInt(adjust_minutes);
      const sign = delta > 0 ? '+' : '';
      const elapsed = Math.round((Date.now() - startTime) / 60000);
      const remaining = Math.max(0, newMins - elapsed);
      postSystemMessage(`⏱ Admin adjusted the hunt duration by ${sign}${delta} minutes. Time remaining: ~${remaining} min.`);
    }
  } else if (action === 'enable_results') {
    setConfig('results_enabled', 'true');
    postSystemMessage('🏆 Results are now available! Check the Results tab!');
  } else if (action === 'disable_results') {
    setConfig('results_enabled', 'false');
  }
  broadcastState();
  res.json({ success: true });
});

app.post('/api/admin/force-claim', (req, res) => {
  const { password, team_id, challenge_id, is_bonus } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
  const isBonus = is_bonus ? 1 : 0;
  db.prepare('DELETE FROM claims WHERE challenge_id=? AND is_bonus=?').run(challenge_id, isBonus);
  db.prepare('INSERT INTO claims (id,team_id,challenge_id,is_bonus,answer_correct) VALUES (?,?,?,?,1)').run(uuidv4(), team_id, challenge_id, isBonus);
  broadcastState();
  res.json({ success: true });
});

app.post('/api/admin/remove-claim', (req, res) => {
  const { password, challenge_id, is_bonus } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
  const claim = db.prepare('SELECT * FROM claims WHERE challenge_id=? AND is_bonus=?').get(challenge_id, is_bonus ? 1 : 0);
  if (claim?.photo_url) { try { fs.unlinkSync(path.join(UPLOADS_DIR, claim.photo_url.replace('/uploads/',''))); } catch {} }
  db.prepare('DELETE FROM claims WHERE challenge_id=? AND is_bonus=?').run(challenge_id, is_bonus ? 1 : 0);
  broadcastState();
  res.json({ success: true });
});

app.post('/api/admin/player', (req, res) => {
  const { password, player_id, name, team_id, action } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
  if (action === 'remove') { db.prepare('DELETE FROM players WHERE id=?').run(player_id); }
  else {
    if (name) { try { db.prepare('UPDATE players SET name=? WHERE id=?').run(name.trim(), player_id); } catch(e) { return res.status(409).json({ error: 'Name taken' }); } }
    if (team_id !== undefined) db.prepare('UPDATE players SET team_id=? WHERE id=?').run(team_id||null, player_id);
  }
  broadcastState(); res.json({ success: true });
});

app.post('/api/admin/team', (req, res) => {
  const { password, team_id, name, action } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
  if (action === 'remove') { db.prepare('UPDATE players SET team_id=NULL WHERE team_id=?').run(team_id); db.prepare('DELETE FROM teams WHERE id=?').run(team_id); }
  else if (name) { try { db.prepare('UPDATE teams SET name=? WHERE id=?').run(name.trim(), team_id); } catch(e) { return res.status(409).json({ error: 'Name taken' }); } }
  broadcastState(); res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
  const { secret } = req.body;
  if (secret !== RESET_CODE) return res.status(403).json({ error: 'Wrong code' });
  clearCountdownTimers();
  db.exec('DELETE FROM claims; DELETE FROM teams; DELETE FROM players; DELETE FROM messages; DELETE FROM location_history;');
  setConfig('hunt_status','waiting'); setConfig('results_enabled','false'); setConfig('hunt_start_time','0');
  try { fs.readdirSync(UPLOADS_DIR).forEach(f => { try { fs.unlinkSync(path.join(UPLOADS_DIR,f)); } catch {} }); } catch {}
  broadcastState(); res.json({ success: true });
});

app.get('*', (req, res) => {
  const index = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send('Client not built.');
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const liveLocations = {};
io.on('connection', (socket) => {
  socket.emit('state_update', getState());
  socket.emit('locations_update', liveLocations);
  socket.on('location_update', (data) => {
    const { userId, name, teamId, teamColor, teamName, lat, lng } = data;
    if (!userId || !lat || !lng) return;
    liveLocations[userId] = { userId, name, teamId, teamColor, teamName, lat, lng, updatedAt: Date.now() };
    io.emit('locations_update', liveLocations);
    if (getConfig('hunt_status') === 'active') {
      db.prepare('INSERT INTO location_history (id,player_id,player_name,team_id,team_color,lat,lng) VALUES (?,?,?,?,?,?,?)').run(uuidv4(), userId, name, teamId||null, teamColor||null, lat, lng);
    }
  });
  socket.on('location_remove', (data) => {
    if (data.userId && liveLocations[data.userId]) { delete liveLocations[data.userId]; io.emit('locations_update', liveLocations); }
  });
});

setInterval(() => {
  const cutoff = Date.now() - 2*60*1000;
  let changed = false;
  Object.keys(liveLocations).forEach(k => { if (liveLocations[k].updatedAt < cutoff) { delete liveLocations[k]; changed = true; } });
  if (changed) io.emit('locations_update', liveLocations);
}, 30000);

// Re-schedule countdown if server restarts mid-hunt
const status = getConfig('hunt_status');
if (status === 'active') {
  const startTime = parseInt(getConfig('hunt_start_time','0'));
  const mins = parseInt(getConfig('countdown_minutes','60'));
  if (startTime) scheduleCountdownMessages(startTime, mins);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Stag Hunt server on port ${PORT}`));
