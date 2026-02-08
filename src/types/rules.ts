/**
 * Rule Management Types
 * Defines all types for rule CRUD operations
 */

/**
 * Rule condition types
 */
export type RuleConditionType = 'THRESHOLD_ABOVE' | 'THRESHOLD_BELOW';

/**
 * Rule trigger actions
 */
export type RuleTriggerType = 'SWAP_TO_STABLECOIN' | 'SWAP_TO_SOL';

/**
 * Rule status
 */
export type RuleStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'TRIGGERED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'PAUSED'
  | 'CANCELLED';

/**
 * Request to create a new rule
 */
export interface CreateRuleRequest {
  name: string; // User-friendly name
  kalshi_market_id: string; // Kalshi market ticker
  condition_type: RuleConditionType; // THRESHOLD_ABOVE or THRESHOLD_BELOW
  threshold_probability: number; // 0.0 to 1.0
  trigger_type: RuleTriggerType; // What action to take
  automation_wallet_id: number; // Which wallet to use
  swap_percentage?: number; // Optional: percentage to swap (default 100)
  cooldown_hours?: number; // Optional: hours before rule can trigger again (default 24)
}

/**
 * Request to update an existing rule
 */
export interface UpdateRuleRequest {
  name?: string;
  threshold_probability?: number;
  swap_percentage?: number;
  cooldown_hours?: number;
  status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED'; // Only allow status transitions
}

/**
 * Rule response (what API returns)
 */
export interface RuleResponse {
  id: number;
  user_id: number;
  name: string;
  kalshi_market_id: string;
  condition_type: RuleConditionType;
  threshold_probability: number;
  trigger_type: RuleTriggerType;
  automation_wallet_id: number;
  swap_percentage: number;
  cooldown_hours: number;
  status: RuleStatus;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Rule list response
 */
export interface RuleListResponse {
  rules: RuleResponse[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Rule validation errors
 */
export interface RuleValidationError {
  field: string;
  message: string;
}

/**
 * Validate create rule request
 */
export function validateCreateRuleRequest(
  data: any,
): { valid: boolean; errors: RuleValidationError[] } {
  const errors: RuleValidationError[] = [];

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Name must be 100 characters or less' });
  }

  if (!data.kalshi_market_id || typeof data.kalshi_market_id !== 'string') {
    errors.push({
      field: 'kalshi_market_id',
      message: 'Kalshi market ID is required',
    });
  }

  if (!['THRESHOLD_ABOVE', 'THRESHOLD_BELOW'].includes(data.condition_type)) {
    errors.push({
      field: 'condition_type',
      message: 'Condition type must be THRESHOLD_ABOVE or THRESHOLD_BELOW',
    });
  }

  if (typeof data.threshold_probability !== 'number') {
    errors.push({
      field: 'threshold_probability',
      message: 'Threshold probability is required',
    });
  } else if (data.threshold_probability < 0 || data.threshold_probability > 1) {
    errors.push({
      field: 'threshold_probability',
      message: 'Threshold probability must be between 0 and 1',
    });
  }

  if (!['SWAP_TO_STABLECOIN', 'SWAP_TO_SOL'].includes(data.trigger_type)) {
    errors.push({
      field: 'trigger_type',
      message: 'Trigger type must be SWAP_TO_STABLECOIN or SWAP_TO_SOL',
    });
  }

  if (!data.automation_wallet_id || typeof data.automation_wallet_id !== 'number') {
    errors.push({
      field: 'automation_wallet_id',
      message: 'Automation wallet ID is required',
    });
  }

  // Optional fields
  if (
    data.swap_percentage !== undefined &&
    (typeof data.swap_percentage !== 'number' ||
      data.swap_percentage < 1 ||
      data.swap_percentage > 100)
  ) {
    errors.push({
      field: 'swap_percentage',
      message: 'Swap percentage must be between 1 and 100',
    });
  }

  if (
    data.cooldown_hours !== undefined &&
    (typeof data.cooldown_hours !== 'number' || data.cooldown_hours < 0)
  ) {
    errors.push({
      field: 'cooldown_hours',
      message: 'Cooldown hours must be non-negative',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate update rule request
 */
export function validateUpdateRuleRequest(
  data: any,
): { valid: boolean; errors: RuleValidationError[] } {
  const errors: RuleValidationError[] = [];

  // All fields are optional for update, but validate if provided
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push({ field: 'name', message: 'Name must be a non-empty string' });
    } else if (data.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be 100 characters or less' });
    }
  }

  if (data.threshold_probability !== undefined) {
    if (typeof data.threshold_probability !== 'number') {
      errors.push({
        field: 'threshold_probability',
        message: 'Threshold probability must be a number',
      });
    } else if (
      data.threshold_probability < 0 ||
      data.threshold_probability > 1
    ) {
      errors.push({
        field: 'threshold_probability',
        message: 'Threshold probability must be between 0 and 1',
      });
    }
  }

  if (data.swap_percentage !== undefined) {
    if (
      typeof data.swap_percentage !== 'number' ||
      data.swap_percentage < 1 ||
      data.swap_percentage > 100
    ) {
      errors.push({
        field: 'swap_percentage',
        message: 'Swap percentage must be between 1 and 100',
      });
    }
  }

  if (data.cooldown_hours !== undefined) {
    if (typeof data.cooldown_hours !== 'number' || data.cooldown_hours < 0) {
      errors.push({
        field: 'cooldown_hours',
        message: 'Cooldown hours must be non-negative',
      });
    }
  }

  if (data.status !== undefined) {
    if (!['ACTIVE', 'PAUSED', 'CANCELLED'].includes(data.status)) {
      errors.push({
        field: 'status',
        message: 'Status must be ACTIVE, PAUSED, or CANCELLED',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
