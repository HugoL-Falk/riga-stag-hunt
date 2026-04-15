# Riga Stag Hunt 🍺

Real-time multiplayer treasure hunt app. Teams join, claim challenges by uploading photos, chat live, and compete on a shared scoreboard.

---

## Run locally (for testing)

```bash
npm run install:all   # install all dependencies
npm run dev           # starts both server (3001) and client (5173)
```

Open http://localhost:5173 — share via ngrok for same-evening use:
```bash
npx ngrok http 3001
```
Then open the ngrok URL on everyone's phone.

---

## Deploy to Railway (recommended — free tier works)

1. Push this repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Railway will detect the Node app — set the start command to:
   ```
   npm run build && npm start
   ```
4. Add environment variable:
   ```
   PORT=3001
   ADMIN_SECRET=your_secret_here
   ```
5. Railway gives you a public URL — share it in the WhatsApp group

**Important:** Railway's free tier has ephemeral storage, meaning uploaded photos and the database reset on redeploy. For a one-day stag party this is fine. If you want persistence, add a Railway Volume mount at `/app/server/uploads` and `/app/server/hunt.db`.

---

## Deploy to Render (alternative)

1. Push to GitHub
2. New Web Service on render.com
3. Build command: `npm run install:all && npm run build`
4. Start command: `npm start`
5. Add env vars: `PORT=3001`

---

## Reset the hunt

POST to `/api/reset` with body `{ "secret": "stagreset2024" }` — or change `ADMIN_SECRET` in env.

---

## How it works

- **No accounts needed** — users enter a name and pick/create a team
- **Photo required to claim** — every challenge requires an uploaded photo as proof
- **Live scoreboard** — Socket.io pushes score updates to all connected devices instantly
- **Gallery** — all uploaded photos visible in the Gallery tab
- **Download** — hit "↓ Photos" to download a zip of all photos organised by team, plus a text summary

---

## Challenges

- 12 main landmark challenges (with bonus objectives)
- 12 quick missions (1pt each)
- 5 medium missions (2pt each)
- 3 hard missions (3pt each)

Maximum possible score: 35pts (landmarks) + 27pts (other) = 62pts
