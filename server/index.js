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

const db = new Database(path.join(__dirname, 'hunt.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    is_bonus INTEGER DEFAULT 0,
    photo_url TEXT,
    answer_text TEXT,
    answer_correct INTEGER DEFAULT 0,
    claimed_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(team_id, challenge_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    team_color TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    text TEXT NOT NULL,
    sent_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

// Add answer columns if upgrading from old DB
try { db.exec('ALTER TABLE claims ADD COLUMN answer_text TEXT'); } catch {}
try { db.exec('ALTER TABLE claims ADD COLUMN answer_correct INTEGER DEFAULT 0'); } catch {}

const TEAM_COLORS = ['#378ADD','#1D9E75','#D85A30','#7F77DD','#E2A020','#A32D2D'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp|mp4|mov|quicktime|video/.test(file.mimetype);
    cb(null, ok);
  }
});

function getState() {
  const teams = db.prepare('SELECT * FROM teams ORDER BY created_at ASC').all();
  const claims = db.prepare('SELECT * FROM claims ORDER BY claimed_at ASC').all();
  const messages = db.prepare('SELECT * FROM messages ORDER BY sent_at ASC LIMIT 300').all();

  const scores = {};
  teams.forEach(t => { scores[t.id] = 0; });

  claims.forEach(c => {
    if (!(c.team_id in scores)) scores[c.team_id] = 0;
    const baseId = c.challenge_id.split('_bonus_')[0];
    const ch = CHALLENGES.find(ch => String(ch.id) === baseId);
    if (!ch) return;

    if (c.is_bonus) {
      const bonusId = c.challenge_id.split('_bonus_')[1];
      const bonus = ch.bonus.find(b => b.id === bonusId);
      if (bonus) scores[c.team_id] += bonus.pts;
    } else {
      scores[c.team_id] += ch.pts;
    }
  });

  return { teams, claims, messages, scores, challenges: CHALLENGES };
}

function broadcast(event, data) { io.emit(event, data); }

app.get('/api/state', (req, res) => res.json(getState()));

app.post('/api/teams', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Team name required' });
  const existing = db.prepare('SELECT * FROM teams').all();
  if (existing.length >= 6) return res.status(400).json({ error: 'Max 6 teams reached' });
  const usedColors = existing.map(t => t.color);
  const color = TEAM_COLORS.find(c => !usedColors.includes(c)) || TEAM_COLORS[existing.length % TEAM_COLORS.length];
  const id = uuidv4();
  db.prepare('INSERT INTO teams (id, name, color) VALUES (?, ?, ?)').run(id, name.trim(), color);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
  broadcast('state_update', getState());
  res.json(team);
});

app.post('/api/claim', upload.single('media'), (req, res) => {
  const { team_id, challenge_id, is_bonus, answer_text } = req.body;
  if (!team_id || !challenge_id) return res.status(400).json({ error: 'Missing fields' });
  if (!req.file) return res.status(400).json({ error: 'Photo or video proof required to claim' });

  const media_url = `/uploads/${req.file.filename}`;
  const id = uuidv4();
  const isBonus = is_bonus === 'true' || is_bonus === true ? 1 : 0;

  // Check if answer is correct for trivia fields
  let answer_correct = 0;
  if (answer_text) {
    const baseId = challenge_id.split('_bonus_')[0];
    const ch = CHALLENGES.find(c => String(c.id) === baseId);
    if (ch) {
      let answerField = null;
      if (isBonus && ch.bonus) {
        const bonusId = challenge_id.split('_bonus_')[1];
        const bonus = ch.bonus.find(b => b.id === bonusId);
        answerField = bonus?.answerField;
      } else {
        answerField = ch.answerField;
      }
      if (answerField?.correct) {
        answer_correct = answer_text.toLowerCase().includes(answerField.correct.toLowerCase()) ? 1 : 0;
      } else {
        answer_correct = 1; // No correct answer defined = just logging it
      }
    }
  }

  try {
    db.prepare('INSERT INTO claims (id, team_id, challenge_id, is_bonus, photo_url, answer_text, answer_correct) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, team_id, challenge_id, isBonus, media_url, answer_text || null, answer_correct);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Already claimed by this team' });
    throw e;
  }

  broadcast('state_update', getState());
  res.json({ success: true, media_url, answer_correct });
});

app.post('/api/messages', (req, res) => {
  const { team_id, team_name, team_color, sender_name, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message' });
  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, team_id, team_name, team_color, sender_name, text) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, team_id, team_name, team_color, sender_name, text.trim().slice(0, 500));
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  broadcast('new_message', msg);
  res.json(msg);
});

app.get('/api/download/photos', (req, res) => {
  const claims = db.prepare('SELECT * FROM claims WHERE photo_url IS NOT NULL').all();
  const teams = db.prepare('SELECT * FROM teams').all();
  const teamMap = {};
  teams.forEach(t => { teamMap[t.id] = t.name; });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="riga-stag-hunt-photos.zip"');

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  claims.forEach(c => {
    const filename = c.photo_url.replace('/uploads/', '');
    const filepath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filepath)) return;
    const teamName = (teamMap[c.team_id] || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const ext = path.extname(filename);
    const chId = c.challenge_id.replace('_bonus_', '-bonus-');
    const isBonus = c.is_bonus ? '-BONUS' : '';
    archive.file(filepath, { name: `${teamName}/challenge-${chId}${isBonus}${ext}` });
  });

  const state = getState();
  let summary = `RIGA STAG HUNT — RESULTS\n${'='.repeat(40)}\n\nDate: ${new Date().toLocaleDateString()}\n\nFINAL SCORES\n${'-'.repeat(20)}\n`;
  const sorted = [...state.teams].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  sorted.forEach((t, i) => { summary += `${i + 1}. ${t.name}: ${state.scores[t.id] || 0} pts\n`; });
  summary += `\nCHALLENGE DETAILS\n${'-'.repeat(20)}\n`;
  CHALLENGES.forEach(ch => {
    const mainClaim = state.claims.find(c => c.challenge_id === String(ch.id) && !c.is_bonus);
    const team = mainClaim ? state.teams.find(t => t.id === mainClaim.team_id) : null;
    summary += `\n[${ch.pts}pt] ${ch.title}\n  Claimed by: ${team ? team.name : 'unclaimed'}\n`;
    if (mainClaim?.answer_text) summary += `  Answer: ${mainClaim.answer_text}${mainClaim.answer_correct ? ' ✓' : ' ✗'}\n`;
    ch.bonus && ch.bonus.forEach(b => {
      const bc = state.claims.find(c => c.challenge_id === `${ch.id}_bonus_${b.id}`);
      const bt = bc ? state.teams.find(t => t.id === bc.team_id) : null;
      summary += `  Bonus (+${b.pts}pt): ${bt ? bt.name : 'unclaimed'}\n`;
      if (bc?.answer_text) summary += `    Answer: ${bc.answer_text}\n`;
    });
  });

  archive.append(summary, { name: 'hunt-summary.txt' });
  archive.finalize();
});

app.post('/api/reset', (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET && secret !== 'stagreset2024') {
    return res.status(403).json({ error: 'Wrong reset code' });
  }
  db.exec('DELETE FROM claims; DELETE FROM teams; DELETE FROM messages;');
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    files.forEach(f => { try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {} });
  } catch {}
  broadcast('state_update', getState());
  res.json({ success: true });
});

app.get('*', (req, res) => {
  const index = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send('Client not built. Run: cd client && npm run build');
});

io.on('connection', (socket) => { socket.emit('state_update', getState()); });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Stag Hunt server on port ${PORT}`));
