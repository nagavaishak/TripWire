# TripWire — Project Context for Claude Code

## Mission
Build a non-custodial automation system that converts Kalshi probability signals into automated Solana DeFi swaps.

## Architecture Overview
[Paste the entire "TripWire v2 Architecture" document here]

## Implementation Decisions
- Language: Node.js + TypeScript
- Database: PostgreSQL
- APIs: Kalshi REST v2, Jupiter v6, Solana web3.js
- Deployment: Railway
- Notifications: SendGrid

## 30-Day Timeline
[Paste the week-by-week breakdown]

## Critical Requirements
1. Automation wallet model (user creates dedicated wallet, we hold keypair)
2. State machine: CREATED → ACTIVE → TRIGGERED → EXECUTING → EXECUTED/FAILED
3. Pre-flight checks before every swap
4. No custom smart contracts
5. API-first (no frontend in v1)

## Technical Constraints
- Never custody main wallet funds
- All executions must be idempotent
- System must handle Solana transaction failures gracefully
- Must enforce $10K max swap cap
- Must detect abnormal probability jumps (>15% in 2h)

## Security Model
- Automation wallet private keys encrypted at rest (AES-256-GCM)
- Master encryption key in environment variables
- User can withdraw funds anytime via signed message
- All transactions auditable on-chain

## Out of Scope (v1)
- Frontend UI
- Multiple markets (only US recession)
- Percentage-based swaps (only absolute amounts)
- Telegram notifications (email only)
- DAO features
- Lending integration

## Success Criteria (Day 30)
- One live rule monitoring Kalshi recession market
- Automated execution of Jupiter swap when triggered
- Verifiable on-chain transaction hash
- Documented API with working examples
- Clean GitHub repo