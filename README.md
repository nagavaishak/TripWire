# TripWire — Attention Markets Oracle

Real-time attention data oracle for Solana prediction markets. Aggregates engagement signals across YouTube, Google Trends, and Farcaster into a single **Degree of Attention (DoA)** score, published on-chain via Switchboard.

---

## What It Does

Prediction markets need more than price data — they need to know what the world is paying attention to. TripWire tracks real-time attention signals for topics (e.g. `Solana`, `AI`) across three free data sources and exposes a live oracle score that on-chain programs can consume.

**Sources:**
| Source | Weight | What It Measures |
|--------|--------|-----------------|
| Google Trends | 35% | Search interest (leading indicator) |
| Farcaster | 35% | Crypto-native social discourse |
| YouTube | 30% | Content consumption (lagging indicator) |

**Output:** DoA score (0–100), updated every 5 minutes, published on-chain via Switchboard oracle.

---

## Architecture

```
YouTube API ─────┐
Google Trends ───┼──► AttentionIndexComputer ──► DoA score ──► Switchboard oracle
Farcaster API ───┘         (time-decay + normalization)             (Solana devnet)
                                    │
                                    └──► REST API ──► VistaDex frontend
```

**Three components:**

1. **`attention-markets/`** — Oracle backend (Node.js + TypeScript)
   - Collectors for each data source
   - Time-decay weighting (90-min half-life)
   - PostgreSQL for score history
   - Scheduled updates via node-cron
   - Deployed on Render

2. **`frontend/`** — VistaDex dashboard (Next.js 16)
   - Compare DoA scores across topics
   - Portfolio view of attention positions
   - Live charts with component breakdown

3. **`src/`** — Market comparison backend (Node.js + TypeScript)
   - Kalshi + Polymarket API integrations
   - Arbitrage detection
   - Automation rules + Jupiter swap execution

---

## Quick Start

### Oracle Backend

```bash
cd attention-markets
npm install
cp .env.example .env
# Set YOUTUBE_API_KEY and DATABASE_URL

# Run migrations
npm run migrate

# Start dev server (port 3000)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3001
```

---

## API

**Live endpoint:** `https://attention-markets-api.onrender.com`

```bash
# Latest DoA score for a topic
GET /api/attention/:topic

# Response:
{
  "value": 62.3,
  "timestamp": 1771941602,
  "topic": "AI",
  "sources": ["youtube", "google_trends", "farcaster"],
  "weights": { "youtube": 0.30, "google_trends": 0.35, "farcaster": 0.35 }
}

# Historical scores (last N hours)
GET /api/attention/:topic/history?hours=24

# All tracked topics
GET /api/attention
```

---

## Switchboard Oracle

DoA scores are pushed on-chain every 5 minutes to Switchboard feeds on Solana devnet.

```bash
# Read oracle values
cd attention-markets
npm run oracle:read

# Monitor live updates
npm run oracle:monitor
```

Feeds config: `attention-markets/switchboard/feeds.json`

---

## Environment Variables

### attention-markets/.env

```bash
DATABASE_URL=postgresql://localhost/attention_markets
YOUTUBE_API_KEY=your_key_here
ATTENTION_TOPICS=Solana,AI
ATTENTION_UPDATE_INTERVAL_MINUTES=5
ATTENTION_HALF_LIFE_MINUTES=90

# Optional (enables on-chain oracle push)
SOLANA_PRIVATE_KEY=
```

---

## Tests

```bash
cd attention-markets

# Test collectors (no DB needed)
npm run test:collectors

# Test full index computation
npm run test:index
```

---

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **API:** Express
- **Database:** PostgreSQL
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Blockchain:** Solana web3.js, Switchboard oracle
- **Hosting:** Render (backend), Vercel (frontend)

---

## Deployment

The oracle backend auto-deploys to Render on push to `attention-markets-v1`. Render config is in `render.yaml` — migrations run automatically on deploy.

```bash
git push origin attention-markets-v1
# Render picks it up, runs: npm install && npm run build && node dist/database/migrate.js
```

---

MIT License
