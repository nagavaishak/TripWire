// Mock data for testing frontend without backend

export const mockRules = [
  {
    id: 1,
    name: 'Recession Hedge',
    kalshi_market_id: 'INXD-26DEC29',
    condition_type: 'THRESHOLD_ABOVE',
    threshold_probability: 0.65,
    trigger_type: 'SWAP_TO_STABLECOIN',
    automation_wallet_id: 1,
    swap_percentage: 80,
    cooldown_hours: 24,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Fed Rate Cut Response',
    kalshi_market_id: 'FED-RATE-MAR',
    condition_type: 'THRESHOLD_ABOVE',
    threshold_probability: 0.70,
    trigger_type: 'SWAP_TO_SOL',
    automation_wallet_id: 1,
    swap_percentage: 50,
    cooldown_hours: 48,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  },
];

export const mockWallets = [
  {
    id: 1,
    name: 'Primary Automation Wallet',
    public_key: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    balance: 2.5,
    created_at: new Date().toISOString(),
  },
];

export const mockMetrics = {
  executions: {
    total: 12,
    succeeded: 10,
    failed: 2,
    pending: 0,
    successRate: 83.3,
  },
  rules: {
    total: 2,
    active: 2,
    paused: 0,
    failed: 0,
  },
  users: {
    total: 1,
    withActiveRules: 1,
  },
  dlq: {
    pending: 0,
    resolved: 2,
  },
  uptime: 86400000,
  timestamp: new Date(),
};

export const MOCK_MODE = true; // Set to false when backend works
