# TripWire

Non-custodial automation system that converts Kalshi probability signals into automated Solana DeFi swaps.

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

**Need detailed setup help?** See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for a complete step-by-step guide with screenshots and troubleshooting.

### Alternative: Local PostgreSQL

If you prefer local PostgreSQL instead of Supabase:
1. Install PostgreSQL locally
2. Create database: `createdb tripwire`
3. Update `DATABASE_URL` in `.env` to: `postgresql://localhost:5432/tripwire`
4. Run migrations: `npm run migrate`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run migrate` - Run database migrations
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## Database Schema

The database consists of 5 main tables:

- **users** - User accounts
- **automation_wallets** - Dedicated wallets for automation (encrypted keypairs)
- **rules** - Automation rules with trigger conditions
- **executions** - Execution history for each triggered rule
- **market_snapshots** - Historical Kalshi market data

See `migrations/001_initial_schema.sql` for the complete schema.

## API Endpoints

### Health Check
- `GET /health` - Server and database health status

## Architecture

- **Runtime**: Node.js with TypeScript
- **Framework**: Express
- **Database**: PostgreSQL (Supabase recommended) with pg driver
- **Logging**: Winston
- **Blockchain**: Solana (via @solana/web3.js)
- **APIs**: Kalshi v2, Jupiter v6

## Production Features

TripWire implements production-grade safety features:

- **P0 Security**: Idempotent execution, distributed locks, replay protection, memory-safe key handling, dead letter queue
- **Rule Engine**: Conditional execution based on Kalshi probability thresholds
- **Wallet Management**: Encrypted automation wallets with AES-256-GCM
- **Real Swaps**: Jupiter v6 integration for optimal Solana DEX routing
- **Comprehensive Tests**: Integration tests for API endpoints and execution flow
- **Mock Mode**: Develop without API credentials using deterministic mock data

All advanced PostgreSQL features (advisory locks, transactions, constraints) work perfectly with Supabase.

## Project Structure

```
src/
  controllers/    - API route handlers
  middleware/     - Express middleware
  models/         - Database models
  services/       - Business logic
  scripts/        - Utility scripts
  types/          - TypeScript type definitions
  utils/          - Helper functions
migrations/       - Database migrations
tests/            - Test files
docs/             - Documentation
```
