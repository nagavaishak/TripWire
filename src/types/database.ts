export interface User {
  id: number;
  email: string;
  main_wallet_address: string;
  created_at: Date;
  updated_at: Date;
}

export interface AutomationWallet {
  id: number;
  user_id: number;
  address: string;
  encrypted_private_key: string;
  encryption_iv: string;
  balance_sol: number;
  balance_usdc: number;
  last_balance_check: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type RuleStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'TRIGGERED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'CANCELLED';

export type TriggerType = 'above' | 'below';

export interface Rule {
  id: number;
  user_id: number;
  automation_wallet_id: number;
  market_id: string;
  trigger_type: TriggerType;
  threshold_probability: number;
  input_token: string;
  output_token: string;
  swap_amount: number;
  slippage_bps: number;
  status: RuleStatus;
  created_at: Date;
  activated_at: Date | null;
  triggered_at: Date | null;
  executed_at: Date | null;
  cancelled_at: Date | null;
  last_checked_at: Date | null;
  error_message: string | null;
  updated_at: Date;
}

export type ExecutionStatus =
  | 'PENDING'
  | 'PRE_FLIGHT_CHECK'
  | 'GETTING_QUOTE'
  | 'BUILDING_TX'
  | 'SIGNING'
  | 'SENDING'
  | 'CONFIRMING'
  | 'SUCCESS'
  | 'FAILED';

export interface Execution {
  id: number;
  rule_id: number;
  status: ExecutionStatus;
  market_probability: number | null;
  input_token: string | null;
  output_token: string | null;
  input_amount: number | null;
  expected_output_amount: number | null;
  actual_output_amount: number | null;
  transaction_signature: string | null;
  slot: number | null;
  block_time: Date | null;
  compute_units_consumed: number | null;
  priority_fee: number | null;
  error_type: string | null;
  error_message: string | null;
  retry_count: number;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MarketSnapshot {
  id: number;
  market_id: string;
  probability: number;
  volume: number | null;
  open_interest: number | null;
  timestamp: Date;
  created_at: Date;
}
