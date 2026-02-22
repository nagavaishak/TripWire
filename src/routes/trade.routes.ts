import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { polymarketService } from '../services/polymarket.service';
import { kalshiService } from '../services/kalshi.service';
import { PolymarketOrderParams } from '../types/polymarket';

const router = Router();

/**
 * POST /api/trade
 * Execute a trade on Kalshi or Polymarket
 *
 * Body:
 *   platform:    'kalshi' | 'polymarket'
 *   market_id:   string
 *   outcome:     'YES' | 'NO'
 *   side:        'BUY' | 'SELL'
 *   size:        number   (shares)
 *   price:       number   (0-1 limit price)
 *   wallet_address: string  (for Polymarket)
 */
router.post('/', async (req: Request, res: Response) => {
  const { platform, market_id, outcome, side, size, price, wallet_address } = req.body;

  // Basic validation
  if (!platform || !market_id || !outcome || !side || size == null || price == null) {
    res.status(400).json({
      error: 'Missing required fields: platform, market_id, outcome, side, size, price',
      code: 'MISSING_FIELDS',
    });
    return;
  }

  if (!['kalshi', 'polymarket'].includes(platform)) {
    res.status(400).json({ error: 'Invalid platform', code: 'INVALID_PLATFORM' });
    return;
  }

  if (!['YES', 'NO'].includes(outcome)) {
    res.status(400).json({ error: 'outcome must be YES or NO', code: 'INVALID_OUTCOME' });
    return;
  }

  if (!['BUY', 'SELL'].includes(side)) {
    res.status(400).json({ error: 'side must be BUY or SELL', code: 'INVALID_SIDE' });
    return;
  }

  if (typeof size !== 'number' || size <= 0) {
    res.status(400).json({ error: 'size must be a positive number', code: 'INVALID_SIZE' });
    return;
  }

  if (typeof price !== 'number' || price < 0 || price > 1) {
    res.status(400).json({ error: 'price must be between 0 and 1', code: 'INVALID_PRICE' });
    return;
  }

  logger.info('Trade request', { platform, market_id, outcome, side, size, price });

  try {
    if (platform === 'polymarket') {
      if (!wallet_address) {
        res.status(400).json({
          error: 'wallet_address required for Polymarket trades',
          code: 'MISSING_WALLET',
        });
        return;
      }

      const params: PolymarketOrderParams = {
        conditionId: market_id,
        outcome: outcome as 'YES' | 'NO',
        side: side as 'BUY' | 'SELL',
        size,
        price,
        walletAddress: wallet_address,
      };

      const result = await polymarketService.placeOrder(params);
      res.json({
        success: true,
        platform,
        market_id,
        order: result,
        note: 'Polymarket order execution is currently in stub mode',
      });
    } else {
      // Kalshi — stub (real impl requires Kalshi trading API credentials)
      logger.info('Kalshi trade stub', { market_id, outcome, side, size, price });
      res.json({
        success: true,
        platform,
        market_id,
        order: {
          orderId: `kalshi-stub-${Date.now()}`,
          status: 'STUB_NOT_EXECUTED',
        },
        note: 'Kalshi order execution is currently in stub mode',
      });
    }
  } catch (error) {
    logger.error('Trade execution error', {
      platform,
      market_id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Trade execution failed', code: 'TRADE_ERROR' });
  }
});

export default router;
