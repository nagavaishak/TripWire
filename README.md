# TripWire

Cross-platform prediction market infrastructure on Solana - solving data fragmentation and enabling sophisticated multi-market strategies through oracle aggregation and automated execution.

## What TripWire Solves

**Two critical infrastructure gaps in prediction markets:**

1. **Platform Fragmentation (#5):** Data scattered across incompatible Kalshi, Polymarket, and Robinhood APIs
2. **Limited Trade Expression (#3):** No infrastructure for executing sophisticated multi-market conditional strategies

**TripWire's dual-layer solution:**
- **Oracle Layer:** Aggregates cross-platform data into consensus probability feeds
- **Execution Layer:** Enables automated multi-market strategies with complex conditional logic

---

## Use Cases

### For Prediction Market Traders:
Set sophisticated cross-platform strategies:
- "Buy Kalshi recession contracts only if Polymarket shows Fed NOT cutting"
- "Execute arbitrage when same event shows >5% price difference across platforms"
- "Auto-rebalance positions when consensus probability shifts >10%"

### For Solana DeFi Protocols:
Integrate event-driven automation:
- Marinade: Auto-unstake mSOL when recession probability crosses threshold
- Kamino: Macro-aware vault strategies based on Fed policy signals
- DAOs: Treasury rebalancing triggered by consensus probabilities

### For Developers:
Consume unified prediction market data:
- One API endpoint for all platforms (no multiple integrations)
- Volume-weighted consensus probabilities
- Real-time updates with quality validation

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Get connection string from Project Settings > Database
3. Copy to `.env` as `DATABASE_URL`

### 3. Configure environment
```bash
cp .env.example .env
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste output into `MASTER_ENCRYPTION_KEY` in `.env`

### 4. Run migrations
```bash
npm run migrate
```

### 5. Start server
```bash
npm run dev
```

Server runs at http://localhost:3000

---

## Architecture

### Oracle Layer (Solves Platform Fragmentation)
**What it does:** Aggregates Kalshi, Polymarket, and other platforms into unified probability feeds

**Components:**
- Multi-platform API integration
- Data normalization (different formats → standard schema)
- Consensus calculation (volume-weighted average)
- Quality validation (staleness detection, manipulation protection)
- REST API for developer consumption

**Why Solana:** Kalshi's DFlow tokenization on Solana enables on-chain positions

### Execution Layer (Enables Multi-Market Strategies)
**What it does:** Automates complex cross-platform strategies

**Components:**
- Automation wallets (encrypted keypairs, user-withdrawable funds)
- Multi-market rule engine (AND/OR conditions across platforms)
- State machine (7 states: CREATED → ACTIVE → TRIGGERED → EXECUTING → EXECUTED/FAILED)
- Pre-flight checks (balance, fees, slippage, caps)
- Jupiter integration (on-chain swap execution)

**Why Solana:** Sub-second finality for time-sensitive execution, low fees for frequent rebalancing

---

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express (API framework)
- PostgreSQL (Supabase)
- Winston (logging)

**Blockchain:**
- Solana web3.js
- Jupiter v6 API
- DFlow (Kalshi tokenization)

**APIs:**
- Kalshi REST API v2
- Polymarket CLOB API
- Additional platforms (expandable)

---

## Database Schema
```sql
users                  -- Accounts and API keys
automation_wallets     -- Encrypted keypairs for execution
rules                  -- Multi-market automation strategies
executions            -- On-chain transaction history
market_snapshots      -- Cross-platform probability data
```

---

## API Endpoints

### Oracle API
```
GET  /api/oracle/markets              # List all markets across platforms
GET  /api/oracle/probability/:id      # Consensus probability for event
GET  /api/oracle/compare/:id          # Side-by-side platform comparison
```

### Automation API
```
POST /api/wallets                     # Create automation wallet
POST /api/rules                       # Create multi-market strategy
GET  /api/rules                       # List active strategies
GET  /api/executions                  # View execution history
```

### System
```
GET  /health                          # Infrastructure health
```

---

## Example: Multi-Market Strategy
```typescript
// Create cross-platform conditional strategy
const strategy = await createRule({
  name: "Recession + Hawkish Fed Strategy",

  // Conditions across multiple platforms
  conditions: [
    {
      platform: "kalshi",
      market: "US_RECESSION_2026",
      operator: "above",
      threshold: 0.65
    },
    {
      platform: "polymarket",
      market: "FED_CUTS_2026",
      operator: "below",
      threshold: 0.40
    }
  ],

  // Logic: Both must be true
  logic: "AND",

  // Action: Swap 50% SOL to USDC
  action: {
    type: "SWAP",
    from: "SOL",
    to: "USDC",
    percentage: 50
  }
});

// TripWire monitors both platforms
// Executes automatically when conditions met
// Returns on-chain transaction hash
```

---

## Key Features

**Cross-Platform Intelligence:**
- ✅ Aggregate Kalshi + Polymarket (expandable to Robinhood, others)
- ✅ Consensus probabilities (volume-weighted across platforms)
- ✅ Arbitrage detection (find price differences across venues)

**Multi-Market Strategies:**
- ✅ Complex conditions (AND/OR logic across multiple markets)
- ✅ Cross-platform triggers (Kalshi data + Polymarket data → action)
- ✅ Automated execution (set once, runs continuously)

**Production-Grade Security:**
- ✅ Non-custodial (user-controlled withdrawal anytime)
- ✅ Encrypted key storage (AES-256-GCM)
- ✅ Transaction caps ($10K max per execution)
- ✅ All actions auditable on-chain

---

## Scripts
```bash
npm run dev          # Development server
npm run build        # Compile TypeScript
npm start            # Production server
npm run migrate      # Database migrations
npm test             # Run tests
npm run lint         # Code linting
npm run format       # Code formatting
```

---

## Grant Support

**Superteam Ireland:** Cross-platform prediction market infrastructure
**Kalshi Builders Program:** DeFi automation driving non-sports market volume

---

## License

MIT - Open-source infrastructure for the Solana ecosystem
