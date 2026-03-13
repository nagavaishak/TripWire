# TripWire — Attention Markets Oracle

Real-time attention oracle for Solana prediction markets. Tracks what the world is paying attention to — from crypto narratives to breaking global events — and publishes a **Degree of Attention (DoA)** score on-chain via Switchboard and Anchor.

---

## What It Does

Prediction markets need more than price data. TripWire aggregates real-time attention signals across multiple data sources into a single DoA score (0–100), updated every 5 minutes, consumable on-chain.

**Attention Sources:**
| Source | Weight | What It Measures |
|--------|--------|-----------------|
| Google Trends | 35% | Search interest (leading indicator) |
| Farcaster | 35% | Crypto-native social discourse |
| YouTube | 30% | Content consumption (lagging indicator) |

**Global Narrative Detection:**
Wikipedia Most-Read API surfaces what the world is actually reading about today (Iran, elections, breaking events). Topics crossing attention thresholds are auto-promoted to tracked markets.

**Output:** DoA score (0–100) + TripWire Attention Index (TAI), updated every 5 minutes, published on-chain.

---

## Architecture

```
YouTube API ──────┐
Google Trends ────┼──► AttentionIndexComputer ──► DoA + TAI ──► Switchboard oracle
Farcaster API ────┘        (time-decay + normalization)        ──► Anchor program
                                     │
Wikipedia Most-Read API              │                              (Solana devnet)
  └──► Global narratives ────────────┘
         └──► Auto-promote to tracked topics
                                     │
                                     └──► REST API ──► TripWire dashboard
```

**Components:**

1. **`attention-markets/`** — Oracle backend (Node.js + TypeScript, deployed on Render)
   - Collectors: YouTube, Google Trends, Farcaster
   - Global narrative detection via Wikipedia Most-Read API
   - Topics table: DB-driven, supports hot-add of new markets
   - TAI scoring: `0.45×Level + 0.30×Momentum + 0.15×Velocity + 0.10×Consensus`
   - Auto-promotes trending global narratives to market cards
   - Pushes DoA on-chain every 5 min via Switchboard + Anchor

2. **`attention-markets-program/`** — Anchor program on Solana devnet
   - `create_market` — oracle creates a market PDA per topic
   - `update_doa` — oracle pushes DoA score (0–10,000 bps)
   - `place_bet` — users bet SOL on High/Low
   - `resolve_market` — oracle resolves when deadline hits
   - `claim_winnings` — winners claim proportional payout from vault

3. **`frontend/`** — TripWire dashboard (Next.js 16, deployed on Vercel)
   - Landing page with invite-code gate
   - Market cards grid (Trendle-style UX)
   - Topic detail: DoA chart + signal breakdown + trade panel
   - Global Pulse widget: live auto-promoted narratives
   - Wallet connect + on-chain bet placement

---

## Quick Start

### Oracle Backend

```bash
cd attention-markets
npm install
cp .env.example .env
# Set YOUTUBE_API_KEY and DATABASE_URL

npm run migrate   # run DB migrations
npm run dev       # port 3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # port 3001
```

### Anchor Program

```bash
cd attention-markets-program
anchor test --skip-local-validator --skip-deploy --provider.cluster devnet
```

---

## API

**Live:** `https://attention-markets-api.onrender.com`

```bash
# All tracked topics with latest DoA + TAI
GET /api/topics

# Latest DoA score for a topic
GET /api/attention/:topic

# Historical scores
GET /api/attention/:topic/history?hours=24

# Global trending narratives (Wikipedia-sourced)
GET /api/narratives/global

# Rising narratives for a specific topic
GET /api/narratives/:topic
```

---

## Anchor Program

Deployed on Solana devnet: `35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb`

PDAs:
- Market: `[b"market", topic.as_bytes()]`
- Vault: `[b"vault", market.key()]`
- Position: `[b"position", market.key(), bettor.key()]`

```bash
# Push DoA scores on-chain
cd attention-markets && npm run anchor:push
```

---

## Environment Variables

### `attention-markets/.env`

```bash
DATABASE_URL=postgresql://localhost/attention_markets
YOUTUBE_API_KEY=your_key_here
ATTENTION_TOPICS=Solana,AI
ATTENTION_UPDATE_INTERVAL_MINUTES=5
ATTENTION_HALF_LIFE_MINUTES=90

# Solana (enables on-chain oracle push)
SOLANA_PRIVATE_KEY=
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### `frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=https://attention-markets-api.onrender.com
TRIPWIRE_ACCESS_CODES=SIGNAL,TRENDLE,ORACLE,LAUNCH,ACCESS
```

---

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **API:** Express
- **Database:** PostgreSQL
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Framer Motion
- **Blockchain:** Solana, Anchor, Switchboard oracle
- **Hosting:** Render (backend), Vercel (frontend)

---

## Deployment

Backend auto-deploys to Render on push to `attention-markets-v1`. Migrations run automatically on each deploy.

Frontend auto-deploys to Vercel on push to `attention-markets-v1`.

```bash
git push origin attention-markets-v1
```

---

MIT License
