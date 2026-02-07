# TripWire

Non-custodial automation system that converts Kalshi probability signals into automated Solana DeFi swaps.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Set up the database:
```bash
# Make sure PostgreSQL is running and DATABASE_URL is configured
npm run migrate
```

4. Start the development server:
```bash
npm run dev
```

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
- **Database**: PostgreSQL with pg driver
- **Logging**: Winston
- **Blockchain**: Solana (via @solana/web3.js)
- **APIs**: Kalshi v2, Jupiter v6

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
