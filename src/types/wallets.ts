/**
 * Automation Wallet Management Types
 */

/**
 * Request to create a new automation wallet
 */
export interface CreateWalletRequest {
  name: string; // User-friendly name for the wallet
}

/**
 * Request to fund a wallet
 */
export interface FundWalletRequest {
  amount: number; // Amount in lamports
}

/**
 * Request to withdraw from a wallet
 */
export interface WithdrawRequest {
  amount: number; // Amount in lamports
  destination_address: string; // Solana address to send to
}

/**
 * Wallet response (what API returns)
 */
export interface WalletResponse {
  id: number;
  user_id: number;
  name: string;
  public_key: string; // Solana public key
  balance?: number; // Balance in lamports (if fetched)
  key_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Wallet list response
 */
export interface WalletListResponse {
  wallets: WalletResponse[];
  total: number;
}

/**
 * Wallet validation errors
 */
export interface WalletValidationError {
  field: string;
  message: string;
}

/**
 * Validate create wallet request
 */
export function validateCreateWalletRequest(
  data: any,
): { valid: boolean; errors: WalletValidationError[] } {
  const errors: WalletValidationError[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (data.name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Name must be 100 characters or less',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate fund wallet request
 */
export function validateFundWalletRequest(
  data: any,
): { valid: boolean; errors: WalletValidationError[] } {
  const errors: WalletValidationError[] = [];

  if (typeof data.amount !== 'number') {
    errors.push({ field: 'amount', message: 'Amount is required' });
  } else if (data.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be positive' });
  } else if (!Number.isInteger(data.amount)) {
    errors.push({
      field: 'amount',
      message: 'Amount must be an integer (lamports)',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate withdraw request
 */
export function validateWithdrawRequest(
  data: any,
): { valid: boolean; errors: WalletValidationError[] } {
  const errors: WalletValidationError[] = [];

  if (typeof data.amount !== 'number') {
    errors.push({ field: 'amount', message: 'Amount is required' });
  } else if (data.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be positive' });
  } else if (!Number.isInteger(data.amount)) {
    errors.push({
      field: 'amount',
      message: 'Amount must be an integer (lamports)',
    });
  }

  if (
    !data.destination_address ||
    typeof data.destination_address !== 'string'
  ) {
    errors.push({
      field: 'destination_address',
      message: 'Destination address is required',
    });
  } else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.destination_address)) {
    errors.push({
      field: 'destination_address',
      message: 'Invalid Solana address format',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
