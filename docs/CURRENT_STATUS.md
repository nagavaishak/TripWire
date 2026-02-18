# TripWire — Current Status

**Last updated:** February 2026
**Purpose:** Factual assessment for grant reviewers (Superteam Ireland / Kalshi Builders Program)

---

## 1. What's Fully Functional

### Backend Services (Node.js + TypeScript)

| Service | What It Does | Status |
|---------|-------------|--------|
| **User Auth** | Register with email + Solana wallet address, generates `tw_<32-byte>` API key (SHA-256 hashed in DB) | ✅ Working |
| **Wallet Manager** | Creates Solana keypairs, encrypts private keys with AES-256-GCM, stores in PostgreSQL | ✅ Working |
| **Kalshi Integration** | Fetches real-time market probabilities from public Kalshi API (no auth required) | ✅ Working |
| **Rule Engine** | Evaluates THRESHOLD_ABOVE / THRESHOLD_BELOW conditions against live market data | ✅ Working |
| **Execution Coordinator** | Full orchestration: lock → validate → check balance → build tx → send → confirm | ✅ Working (devnet) |
| **Jupiter Swap** | Fetches optimal swap routes via Jupiter v6 API; builds and signs Solana transactions | ✅ Working (mock mode on by default) |
| **Execution Lock** | Distributed lock prevents concurrent execution of same rule (5-min TTL) | ✅ Working |
| **Idempotency** | SHA-256 keyed idempotency prevents double-execution on retry | ✅ Working |
| **Dead Letter Queue** | Captures failed executions with failure reason; supports manual retry | ✅ Working |
| **Webhook Notifications** | Sends HTTP/Slack/Discord webhooks on rule trigger, execution success/failure | ✅ Working |
| **Admin Monitoring** | Health check, metrics, execution history, DLQ management, audit logs | ✅ Working |
| **Kill Switch** | `EXECUTION_ENABLED=false` halts all executions immediately | ✅ Working |

### API Endpoints (all tested locally)

**Authentication**
- `POST /api/auth/register` — Creates user, returns API key
- `GET /health` — Public health check

**Rules**
- `POST /api/rules` — Create automation rule
- `GET /api/rules` — List rules (filter by status, paginate)
- `GET /api/rules/:id` — Get rule detail
- `PUT /api/rules/:id` — Update / activate / pause rule
- `DELETE /api/rules/:id` — Cancel rule

**Wallets**
- `POST /api/wallets` — Generate Solana keypair with encrypted storage
- `GET /api/wallets` — List wallets
- `GET /api/wallets/:id` — Get wallet detail
- `GET /api/wallets/:id/balance` — Live SOL balance from Solana RPC
- `GET /api/wallets/:id/stats` — Execution statistics
- `POST /api/wallets/:id/withdraw` — Withdraw funds (replay-protected)

**Webhooks**
- `POST /api/webhooks` — Create webhook (HTTP, Slack, Discord, Email)
- `GET /api/webhooks` — List webhooks
- `PUT /api/webhooks/:id` — Update
- `DELETE /api/webhooks/:id` — Delete
- `POST /api/webhooks/:id/test` — Send test notification

**Admin**
- `GET /api/admin/health` — DB connectivity, DLQ size, execution rate
- `GET /api/admin/metrics` — Total executions, success rate, active rules
- `GET /api/admin/executions` — Execution history with filters
- `GET /api/admin/dlq` — Dead letter queue (filter by status)
- `POST /api/admin/dlq/:id/retry` — Manually retry failed execution
- `GET /api/admin/rules` — All rules with execution stats
- `GET /api/admin/users` — All users with counts
- `GET /api/admin/logs` — Audit log

### Database (PostgreSQL — 11 migrations applied)

| Table | Purpose |
|-------|---------|
| `users` | Accounts with hashed API keys |
| `automation_wallets` | Encrypted keypairs (AES-256-GCM, iv, auth_tag) |
| `rules` | Automation rules with state machine (8 states) |
| `executions` | On-chain transaction history with idempotency keys |
| `withdrawals` | Withdrawal tracking with replay protection |
| `execution_locks` | Distributed locks for concurrent execution prevention |
| `dead_letter_queue` | Failed executions with retry tracking |
| `webhooks` | User notification endpoints |
| `secrets_audit` | Encryption key access audit trail |
| `audit_log` | Authentication and API access log |

### Frontend (Next.js 16)

| Page | What It Does | Status |
|------|-------------|--------|
| `/` — Dashboard | Shows active rules, recent executions, wallet summary | ✅ Working |
| `/auth/register` | Create account, receive API key | ✅ Working |
| `/auth/login` | Enter API key, stored in localStorage | ✅ Working |
| `/rules/new` | 4-step wizard: market → condition → action → review | ✅ Working |
| `/wallets` | List wallets, view balances, create new | ✅ Working |
| `/settings` | Webhook management | ✅ Working |

**Deployed demo:** https://tripwire-bice.vercel.app (mock mode — no live backend required)

---

## 2. What's Partially Complete

| Feature | Current State | What's Missing |
|---------|--------------|----------------|
| **Kalshi Authentication** | Public mode works (real data, no auth). RSA-PSS authenticated mode is coded but untested end-to-end. | Tested credential flow with real Kalshi API key |
| **Jupiter Swaps** | Integration complete. `JUPITER_MOCK_MODE=true` by default — returns simulated results. | Fund devnet wallet and flip to real mode for full test |
| **Rule detail page** | Rules can be created and listed; no dedicated `/rules/:id` UI page. Activate/pause done via API. | Frontend detail page with status toggle UI |
| **Withdrawal flow** | Backend fully implemented with replay protection. No frontend UI for initiating withdrawals. | Frontend withdrawal modal |
| **Webhook Email** | HTTP/Slack/Discord work. Email requires SendGrid key. | SendGrid API key and test |
| **Multi-condition rules** | Current schema supports one condition per rule. Backend types allow OR/AND logic but rule engine evaluates one condition. | Rule evaluator extension for compound conditions |
| **Frontend ↔ Backend (deployed)** | Frontend on Vercel uses mock data. Backend runs locally only. | Deploy backend to Railway/Render; set `NEXT_PUBLIC_API_URL` |

---

## 3. What's Not Built Yet

### Polymarket Integration
The README and positioning reference Polymarket as a second data source. **No Polymarket code exists yet.**

What would be needed:
- `src/services/polymarket.service.ts` — Polymarket CLOB API integration
- Data normalization layer to map Polymarket market IDs to internal format
- Consensus probability calculation combining Kalshi + Polymarket feeds
- `GET /api/oracle/compare/:id` — Side-by-side comparison endpoint (defined in README, not implemented)
- `GET /api/oracle/markets` — Multi-platform market list (defined in README, not implemented)

Currently, `/api/oracle/*` routes **do not exist** in the codebase. The Oracle API section in the README describes planned functionality.

### Mainnet Deployment
- Backend is running on local PostgreSQL (devnet RPC configured)
- No production database provisioned
- `JUPITER_MOCK_MODE=true` — no real swaps executing
- Solana mainnet requires funded wallets and production RPC
- No CI/CD pipeline

### Security Items (Pre-Production)
- No rate limiting per user (global rate limit exists: 100 req/min)
- Webhook payloads not signed (no HMAC verification)
- No 2FA or session management (single API key per user)
- No IP allowlisting for admin endpoints
- Private key in memory during execution (zeroed after use, but no HSM)
- No security audit completed

### Other Missing Features
- `GET /api/oracle/markets` and `GET /api/oracle/probability/:id` (referenced in README — not yet built)
- Robinhood Markets integration (mentioned in README)
- Arbitrage detection across platforms
- Frontend rule editing UI
- Email notifications (requires SendGrid key)
- Historical probability charting
- Multi-wallet support per user
- Mobile app

---

## 4. Lines of Code

| Component | Files | Lines |
|-----------|-------|-------|
| Backend (`src/`) | 39 | 9,404 |
| Frontend (`frontend/app`, `lib`, `components`) | 24 | 2,742 |
| Tests (`tests/`) | 3 | 966 |
| Migrations (`migrations/`) | 11 | 518 |
| **Total** | **77** | **13,630** |

**Test coverage:** Integration tests cover auth, wallet creation, and execution flow. No unit test coverage metric available (no coverage tooling configured). Roughly 30-40% of API surface is directly tested.

---

## 5. Demo Instructions

### Run Locally

**Prerequisites:** Node.js 20+, PostgreSQL 14+

```bash
# Clone
git clone https://github.com/nagavaishak/TripWire
cd TripWire

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — minimum required:
#   DATABASE_URL=postgresql://localhost/tripwire
#   MASTER_ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# Create database and run migrations
createdb tripwire
npm run migrate

# Start backend
npm run dev
# → Server running on http://localhost:3000
```

```bash
# In a second terminal, start the frontend
cd frontend
npm install
npm run dev
# → Frontend running on http://localhost:3001
```

### Test Key Features

**1. Register and get API key**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","main_wallet_address":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"}'

# Returns:
# { "api_key": "tw_...", "user": { "id": 1, "email": "..." } }
# Save the api_key — shown only once
```

**2. Create automation wallet**
```bash
curl -X POST http://localhost:3000/api/wallets \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Automation Wallet"}'

# Returns wallet with public_key (Solana address)
```

**3. Create automation rule**
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Recession Hedge",
    "kalshi_market_id": "INXD-26DEC29",
    "condition_type": "THRESHOLD_ABOVE",
    "threshold_probability": 0.65,
    "trigger_type": "SWAP_TO_STABLECOIN",
    "automation_wallet_id": 1,
    "swap_percentage": 50,
    "cooldown_hours": 24
  }'
```

**4. Activate the rule**
```bash
curl -X PUT http://localhost:3000/api/rules/1 \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACTIVE"}'
```

**5. Check system health and metrics**
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/admin/health -H "Authorization: Bearer <api_key>"
curl http://localhost:3000/api/admin/metrics -H "Authorization: Bearer <api_key>"
```

**6. View execution history**
```bash
curl "http://localhost:3000/api/admin/executions?limit=10" \
  -H "Authorization: Bearer <api_key>"
```

### Verify Kalshi Data is Live (not mocked)

```bash
# With KALSHI_PUBLIC_MODE=true (default), this hits the real Kalshi API:
curl "https://api.elections.kalshi.com/trade-api/v2/markets/INXD-26DEC29" | jq '.market.last_price'
# Should return a real probability value
```

### View Deployed Frontend Demo

https://tripwire-bice.vercel.app

Note: Deployed demo uses mock data (no backend required). To connect to a live backend, set `NEXT_PUBLIC_API_URL` in Vercel environment variables to a deployed backend URL.
