# TripWire Frontend Plan

## Overview
A clean, minimal dashboard for DeFi users to automate trades based on real-world events (Kalshi markets).

## Tech Stack Recommendation
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: React Query for API calls
- **Wallet**: @solana/wallet-adapter-react
- **Charts**: Recharts or Chart.js

## Pages & Features

### 1. Landing Page (`/`)
**Purpose**: Explain TripWire, show value proposition

**Content:**
- Hero: "Automate Your DeFi Portfolio Based on Real-World Events"
- How it works (3 steps)
- Example use cases:
  - "Swap to stablecoins if recession probability > 70%"
  - "Buy SOL if Fed rate cut probability > 60%"
- CTA: Sign Up / Connect Wallet

### 2. Dashboard (`/dashboard`)
**Purpose**: Main control center

**Layout:**
```
┌─────────────────────────────────────────┐
│ Header: Logo | Wallets | Settings | Logout│
├─────────────────────────────────────────┤
│                                         │
│  📊 Portfolio Overview                  │
│  ┌──────────┬──────────┬──────────┐   │
│  │ Total    │ Active   │ Executed │   │
│  │ Value    │ Rules    │ Today    │   │
│  └──────────┴──────────┴──────────┘   │
│                                         │
│  🎯 Active Rules                        │
│  ┌─────────────────────────────────┐  │
│  │ ✅ Recession Hedge              │  │
│  │ Market: USRECESSION-2026        │  │
│  │ Current: 67% | Trigger: >65%   │  │
│  │ Status: Monitoring              │  │
│  └─────────────────────────────────┘  │
│  [+ Create New Rule]                   │
│                                         │
│  📈 Recent Executions                   │
│  ┌─────────────────────────────────┐  │
│  │ Feb 8, 11:23 AM                 │  │
│  │ Swapped 0.8 SOL → 120 USDC     │  │
│  │ View on Solscan →              │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Features:**
- Quick stats cards
- List of active rules with live probability indicators
- Recent execution history
- "Create Rule" prominent CTA

### 3. Create Rule (`/rules/new`)
**Purpose**: Wizard-style rule creation

**Flow:**
```
Step 1: Select Market
┌─────────────────────────────────┐
│ Search Kalshi Markets           │
│ [Search: "recession"...]        │
│                                 │
│ Results:                        │
│ ○ US Recession 2026            │
│ ○ GDP Growth Q1 2026           │
│ ○ Fed Rate Decision March      │
└─────────────────────────────────┘

Step 2: Set Condition
┌─────────────────────────────────┐
│ When probability goes:          │
│ ○ Above threshold               │
│ ● Below threshold               │
│                                 │
│ Threshold: [65]%                │
│ Current: 67% ⚠️ Would trigger! │
└─────────────────────────────────┘

Step 3: Choose Action
┌─────────────────────────────────┐
│ Action:                         │
│ ● Swap to Stablecoin (USDC)    │
│ ○ Swap to SOL                  │
│                                 │
│ Amount: [80]% of wallet         │
│ Wallet: Automation Wallet #1    │
│ Balance: 2.5 SOL ($450)        │
└─────────────────────────────────┘

Step 4: Review & Activate
┌─────────────────────────────────┐
│ Rule Summary:                   │
│ • Market: US Recession 2026     │
│ • Trigger: Probability < 65%    │
│ • Action: Swap 80% to USDC     │
│ • Cooldown: 24 hours           │
│                                 │
│ [Cancel] [Save as Draft] [Activate]│
└─────────────────────────────────┘
```

### 4. Wallets Page (`/wallets`)
**Purpose**: Manage automation wallets

**Features:**
- List of automation wallets
- Balance display (SOL, USDC)
- Fund wallet button (shows address + QR code)
- Create new wallet
- Withdraw funds
- Transaction history per wallet

**Example:**
```
┌─────────────────────────────────────┐
│ Automation Wallet #1                │
│ HQt7o2...7Cm7 [Copy] [QR Code]    │
│                                     │
│ Balance:                            │
│ • 2.5 SOL ($450)                   │
│ • 120 USDC                         │
│                                     │
│ [Fund Wallet] [Withdraw] [History] │
└─────────────────────────────────────┘
```

### 5. Rule Detail Page (`/rules/[id]`)
**Purpose**: Deep dive into specific rule

**Sections:**
- Rule configuration
- Live probability chart (last 24h)
- Execution history for this rule
- Edit rule settings
- Pause/Resume/Delete rule

### 6. Execution Detail (`/executions/[id]`)
**Purpose**: Show detailed execution info

**Content:**
- Trigger details (what caused execution)
- Transaction details (signature, amounts, fees)
- Before/after wallet balances
- Timeline of execution steps
- Link to Solscan

### 7. Settings (`/settings`)
**Purpose**: User preferences

**Tabs:**
- Profile (email, API key)
- Notifications (email alerts, webhook URL)
- Security (2FA, sessions)
- Billing (if needed)

## Key Components to Build

### Reusable Components:
1. **RuleCard** - Shows rule summary
2. **ProbabilityIndicator** - Live probability with color coding
3. **WalletBalance** - Shows SOL/USDC with USD value
4. **ExecutionTimeline** - Visual steps of execution
5. **MarketSearch** - Autocomplete for Kalshi markets
6. **ConfirmationModal** - For important actions

### Data Hooks:
```typescript
// API hooks using React Query
useRules() // Fetch user's rules
useWallets() // Fetch user's wallets
useExecutions() // Fetch execution history
useMarketSearch(query) // Search Kalshi markets
useMarketData(marketId) // Get live probability
```

## Design Principles

1. **Clean & Minimal** - DeFi users want speed, not clutter
2. **Live Updates** - Use WebSocket or polling for live probabilities
3. **Mobile Responsive** - Many DeFi users on mobile
4. **Dark Mode** - DeFi standard
5. **Trust Indicators** - Show security features prominently

## Sample Color Scheme

```css
/* Dark theme (primary) */
--background: #0a0a0a
--card: #1a1a1a
--primary: #8b5cf6 (purple)
--success: #10b981 (green)
--warning: #f59e0b (orange)
--danger: #ef4444 (red)

/* Light theme (optional) */
--background: #ffffff
--card: #f9fafb
--primary: #7c3aed
```

## Development Phases

### Phase 1: MVP (2-3 days)
- Dashboard with rules list
- Create rule wizard
- Wallet management
- Basic execution history

### Phase 2: Polish (1-2 days)
- Live probability charts
- Better UX/animations
- Mobile optimization
- Dark mode

### Phase 3: Advanced (optional)
- Portfolio analytics
- Multi-wallet support
- Advanced rule types
- Social features (share rules)

## API Integration

Your backend is ready! Frontend just needs to:

```typescript
// Example: Create a rule
const createRule = async (ruleData) => {
  const response = await fetch('http://localhost:3000/api/rules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(ruleData)
  });
  return response.json();
};
```

## Quick Start Options

### Option A: Next.js Dashboard (Recommended)
```bash
npx create-next-app@latest tripwire-dashboard
cd tripwire-dashboard
npm install @tanstack/react-query @solana/wallet-adapter-react
# Start building!
```

### Option B: Use Template
Use a DeFi dashboard template and customize:
- [shadcn-admin-template](https://github.com/shadcn-ui/ui)
- [DexScreener](https://dexscreener.com/) style
- [Uniswap](https://uniswap.org/) minimalism

### Option C: No Code (MVP Testing)
- Use Retool or Budibase
- Connect to your API
- Build internal dashboard for testing
- Perfect for prototype validation

## Monitoring Dashboard

For internal use (not user-facing):

**Admin Dashboard** (`/admin`)
- System health
- All executions (all users)
- DLQ items
- API usage stats
- Error logs

Could use Grafana + Prometheus or simple Next.js admin panel.

---

## Recommendation for Your Prototype

**For rapid validation:**
1. Build minimal Next.js dashboard (3-4 key pages)
2. Use shadcn/ui for components (looks professional fast)
3. Focus on rule creation + execution monitoring
4. Dark mode only (save time)
5. Mobile can wait for V2

**Time estimate:** 2-3 days for working MVP

**Alternative:** Use Retool for 1-day MVP to validate with users first!

---

Would you like me to:
1. **Generate the Next.js boilerplate** with these pages?
2. **Create a Retool config** for quick testing?
3. **Skip frontend for now** and move to monitoring/webhooks?
