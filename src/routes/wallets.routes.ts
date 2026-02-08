import { Router, Request, Response } from 'express';
import { walletService } from '../services/wallet.service';
import {
  validateCreateWalletRequest,
  validateWithdrawRequest,
  CreateWalletRequest,
  WithdrawRequest,
} from '../types/wallets';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/wallets
 * Create a new automation wallet
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const validation = validateCreateWalletRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors,
      });
      return;
    }

    const data: CreateWalletRequest = req.body;

    // Create wallet
    const wallet = await walletService.createWallet(userId, data.name);

    res.status(201).json({
      message: 'Wallet created successfully',
      wallet,
      note: 'Save the public_key for funding this wallet. Private key is encrypted and stored securely.',
    });
  } catch (error) {
    logger.error('Error creating wallet', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to create wallet',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/wallets
 * List all wallets for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const includeBalance = req.query.includeBalance === 'true';

    const wallets = await walletService.listWallets(userId, includeBalance);

    res.json({
      wallets,
      total: wallets.length,
    });
  } catch (error) {
    logger.error('Error listing wallets', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to list wallets',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/wallets/:id
 * Get a specific wallet by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const walletId = parseInt(String(req.params.id));
    const includeBalance = req.query.includeBalance !== 'false'; // Default true

    if (isNaN(walletId)) {
      res.status(400).json({
        error: 'Invalid wallet ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const wallet = await walletService.getWallet(
      walletId,
      userId,
      includeBalance,
    );

    if (!wallet) {
      res.status(404).json({
        error: 'Wallet not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({ wallet });
  } catch (error) {
    logger.error('Error getting wallet', {
      userId: req.user?.id,
      walletId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to get wallet',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/wallets/:id/balance
 * Get wallet balance from Solana
 */
router.get('/:id/balance', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const walletId = parseInt(String(req.params.id));

    if (isNaN(walletId)) {
      res.status(400).json({
        error: 'Invalid wallet ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const wallet = await walletService.getWallet(walletId, userId, false);

    if (!wallet) {
      res.status(404).json({
        error: 'Wallet not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    const balance = await walletService.getWalletBalance(wallet.public_key);

    res.json({
      wallet_id: walletId,
      public_key: wallet.public_key,
      balance,
      balance_sol: balance / 1_000_000_000, // Convert to SOL
    });
  } catch (error) {
    logger.error('Error getting wallet balance', {
      userId: req.user?.id,
      walletId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to get wallet balance',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/wallets/:id/stats
 * Get wallet statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const walletId = parseInt(String(req.params.id));

    if (isNaN(walletId)) {
      res.status(400).json({
        error: 'Invalid wallet ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const stats = await walletService.getWalletStats(walletId, userId);

    res.json({
      wallet_id: walletId,
      ...stats,
    });
  } catch (error) {
    logger.error('Error getting wallet stats', {
      userId: req.user?.id,
      walletId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: error.message,
        code: 'NOT_FOUND',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to get wallet stats',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/wallets/:id/withdraw
 * Initiate withdrawal from automation wallet
 */
router.post('/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const walletId = parseInt(String(req.params.id));

    if (isNaN(walletId)) {
      res.status(400).json({
        error: 'Invalid wallet ID',
        code: 'INVALID_ID',
      });
      return;
    }

    // Validate request body
    const validation = validateWithdrawRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors,
      });
      return;
    }

    const data: WithdrawRequest = req.body;

    // Initiate withdrawal
    const result = await walletService.initiateWithdrawal(
      walletId,
      userId,
      BigInt(data.amount),
      data.destination_address,
    );

    if (result.isNew) {
      res.status(201).json({
        message: 'Withdrawal initiated successfully',
        withdrawal_id: result.withdrawalId,
        note: 'Withdrawal will be processed. Check status at GET /api/withdrawals/:id',
      });
    } else {
      res.status(200).json({
        message: 'Withdrawal already exists (duplicate detected)',
        withdrawal_id: result.withdrawalId,
        note: 'This withdrawal was already initiated. Check status at GET /api/withdrawals/:id',
      });
    }
  } catch (error) {
    logger.error('Error initiating withdrawal', {
      userId: req.user?.id,
      walletId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
        return;
      }

      if (error.message.includes('Insufficient balance')) {
        res.status(400).json({
          error: error.message,
          code: 'INSUFFICIENT_BALANCE',
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to initiate withdrawal',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
