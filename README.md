# TripWire

Probability oracle and execution infrastructure for Solana - aggregating prediction market data across platforms and enabling automated on-chain actions based on real-world event probabilities.

## What TripWire Does

**Dual-layer infrastructure:**
1. **Oracle Layer:** Aggregates and normalizes prediction market probabilities across Kalshi, Polymarket, and emerging platforms
2. **Execution Layer:** Enables automated on-chain actions when probability thresholds are crossed

**For protocols:** Consume probability feeds via API or integrate full execution infrastructure
**For users:** Set event-driven rules that execute automatically (e.g., "If recession probability > 70%, swap SOL to USDC")

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase (Recommended)

**Create a Supabase project:**
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose a name (e.g., "tripwire"), set a strong database password
4. Wait ~2 minutes for project to initialize

**Get your connection string:**
1. Go to Project Settings > Database
2. Scroll to "Connection String" section
3. Copy the "Connection string" (under "Nodejs" tab)
4. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 3. Configure environment variables
```bash
cp .env.example .env
# Edit .env and paste your Supabase connection string into DATABASE_URL
```

**CRITICAL:** Generate a secure master encryption key:
```bash
# Generate a random 32-byte hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and paste into MASTER_ENCRYPTION_KEY in .env
```

### 4. Run database migrations
```bash
npm run migrate
```

### 5. Start the development server
```bash
npm run dev
```

The server will start on http://localhost:3000

**Need detailed setup help?** See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

---

## Architecture

### Oracle Layer
- **Multi-platform aggregation:** Pulls real-time probabilities from Kalshi, Polymarket, and other prediction markets
- **Data normalization:** Computes volume-weighted consensus probabilities across sources
- **Quality validation:** Staleness detection (>30min), manipulation protection (>15% jumps trigger delays)
- **Developer API:** REST endpoints exposing normalized probability feeds

### Execution Layer
- **Automation wallets:** Non-custodial execution using encrypted keypair storage (AES-256-GCM)
- **Rule engine:** 7-state persistent state machine with cooldown enforcement and idempotency guarantees
- **Pre-flight checks:** Balance validation, slippage protection, transaction cap enforcement ($10K max)
- **Jupiter integration:** Best-route Solana swaps with retry logic and error classification

### Tech Stack
- **Runtime:** Node.js with TypeScript
- **Framework:** Express
- **Database:** PostgreSQL (Supabase or local)
- **Blockchain:** Solana (via @solana/web3.js)
- **APIs:** Kalshi v2, Polymarket CLOB, Jupiter v6

---

## Database Schema

**5 core tables:**
- `users` - Protocol/user accounts
- `automation_wallets` - Encrypted keypairs for execution
- `rules` - Event-triggered automation rules
- `executions` - On-chain transaction history
- `market_snapshots` - Cross-platform probability data

See `migrations/001_initial_schema.sql` for complete schema.

---

## API Endpoints

### Oracle API (Probability Feeds)
- `GET /api/oracle/markets` - List available markets across platforms
- `GET /api/oracle/probability/:market_id` - Get consensus probability for specific event

### Automation API
- `POST /api/wallets` - Create automation wallet
- `POST /api/rules` - Create event-triggered rule
- `GET /api/executions` - View execution history

### System
- `GET /health` - Infrastructure health check

---

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run migrate` - Run database migrations
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

---

## Production Features

**Oracle Infrastructure:**
- Multi-platform data aggregation with consensus calculation
- Quality validation (staleness, manipulation detection)
- Developer-facing REST API
- Real-time probability updates

**Execution Infrastructure:**
- Idempotent execution with distributed locks
- Non-custodial automation wallet system
- Jupiter v6 integration for optimal routing
- Comprehensive error handling with dead letter queue
- Replay protection and memory-safe key handling

**Security:**
- AES-256-GCM encryption for private keys
- User-controlled fund withdrawal (cryptographic signature verification)
- $10K per-transaction cap
- All executions auditable on-chain

---

## Integration Examples

### Protocol Integration (Oracle API)
```typescript
// Get current recession probability across all platforms
const response = await fetch('https://api.tripwire.app/oracle/probability/US_RECESSION_2026');
const data = await response.json();

// Returns:
// {
//   market_id: "US_RECESSION_2026",
//   consensus_probability: 0.64,
//   sources: [
//     { platform: "kalshi", probability: 0.65, volume: "$2.3M" },
//     { platform: "polymarket", probability: 0.62, volume: "$5.1M" }
//   ],
//   updated_at: "2026-02-16T10:15:00Z"
// }

// Use in your protocol's logic
if (data.consensus_probability > 0.70) {
  await executeProtocolAction();
}
```

### User Automation (Full Stack)
```typescript
// Create rule via API
const rule = await createRule({
  market_id: "US_RECESSION_2026",
  threshold: 0.70,
  action: "SWAP_TO_USDC",
  percentage: 50
});

// TripWire monitors consensus probability
// Executes automatically when threshold crossed
// User receives notification + on-chain tx hash
```

---

## Project Structure
```
src/
  controllers/    - API route handlers
  middleware/     - Express middleware
  models/         - Database models
  services/       - Business logic (oracle, execution, encryption)
  scripts/        - Utility scripts
  types/          - TypeScript type definitions
  utils/          - Helper functions
migrations/       - Database migrations
tests/            - Test files
docs/             - Documentation
```

---

## License

MIT - Open-source infrastructure for the Solana ecosystem

---

## Links

**Grant Application:** Superteam Ireland + Kalshi Builders Program
**Documentation:** [Coming Soon]
**Demo:** [Coming Soon]
