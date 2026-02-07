# TripWire Technical Specification

## Database Schema
```sql
-- [Paste the complete PostgreSQL schema from the architecture review]
```

## API Endpoints

### Rules API
- POST /api/rules - Create new rule
- GET /api/rules - List user's rules
- GET /api/rules/:id - Get specific rule
- PUT /api/rules/:id - Update rule
- DELETE /api/rules/:id - Cancel rule

### Automation Wallet API
- POST /api/automation-wallet/create - Create automation wallet
- POST /api/automation-wallet/withdraw - Withdraw funds
- GET /api/automation-wallet/:address/balance - Check balance

### System API
- GET /health - Health check endpoint
- GET /api/markets - List available Kalshi markets

## State Machine Logic

[Paste the complete state transition table]

## Error Handling

[Paste the error classification and retry logic]

## Integration Requirements

### Kalshi API
- Endpoint: https://api.kalshi.com/v2
- Authentication: API key in headers
- Poll frequency: Every 15 minutes
- Required fields: market_id, probability, timestamp

### Jupiter API
- Quote endpoint: https://quote-api.jup.ag/v6/quote
- Swap endpoint: https://quote-api.jup.ag/v6/swap
- Slippage tolerance: 2% (200 bps)
- Mode: ExactIn

### Solana RPC
- Provider: Helius (paid tier)
- Commitment level: confirmed
- Compute budget: 200k units
- Priority fee: dynamic based on network

## Environment Variables Required
```
DATABASE_URL=postgresql://...
KALSHI_API_KEY=...
SOLANA_RPC_URL=https://...
MASTER_ENCRYPTION_KEY=... (32 bytes hex)
SENDGRID_API_KEY=...
JUPITER_API_URL=https://quote-api.jup.ag/v6
NODE_ENV=development|production
PORT=3000
```

## Testing Strategy

Unit tests:
- Rule evaluation logic
- State transitions
- Pre-flight checks
- Encryption/decryption

Integration tests:
- Kalshi API polling
- Jupiter swap execution (devnet)
- Automation wallet creation (devnet)
- End-to-end: rule trigger → execution (devnet)

Mainnet testing:
- Small amount ($10 worth)
- One manual rule
- Verify transaction success