import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { query } from '../utils/db';
import { polymarketService } from '../services/polymarket.service';

const router = Router();

/**
 * GET /api/portfolio
 * Returns the authenticated user's cross-platform positions + summary
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const walletAddress = req.user!.main_wallet_address;

  try {
    // Fetch DB positions (Kalshi + any stored Polymarket)
    let dbPositions: any[] = [];
    try {
      const result = await query(
        `SELECT * FROM user_positions WHERE user_id = $1 ORDER BY opened_at DESC`,
        [userId],
      );
      dbPositions = result.rows;
    } catch (dbError) {
      logger.warn('Could not fetch user_positions from DB (table may not exist yet)', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    // Fetch live Polymarket positions (from wallet, best-effort)
    let polyPositions: any[] = [];
    try {
      const raw = await polymarketService.getPositions(walletAddress);
      polyPositions = raw.map((p) => ({
        id: null,
        platform: 'polymarket',
        market_id: p.conditionId,
        question: `Polymarket: ${p.conditionId.slice(0, 12)}...`,
        side: p.outcome.toUpperCase(),
        shares: p.size,
        avg_price: p.avgPrice,
        current_price: p.currentPrice,
        cost_basis: p.size * p.avgPrice,
        current_value: p.size * p.currentPrice,
        realized_pnl: 0,
        unrealized_pnl: p.pnl,
        status: 'open',
        source: 'live',
      }));
    } catch (polyError) {
      logger.warn('Could not fetch Polymarket positions', {
        error: polyError instanceof Error ? polyError.message : String(polyError),
      });
    }

    // Merge: DB positions + live Polymarket (dedup by market_id)
    const polyIdsInDb = new Set(
      dbPositions.filter((p) => p.platform === 'polymarket').map((p) => p.market_id),
    );
    const freshPolyPositions = polyPositions.filter((p) => !polyIdsInDb.has(p.market_id));

    const allPositions = [
      ...dbPositions.map((p) => ({
        ...p,
        unrealized_pnl:
          p.current_value != null && p.cost_basis != null
            ? p.current_value - p.cost_basis
            : null,
        source: 'db',
      })),
      ...freshPolyPositions,
    ];

    // Summary stats
    const open = allPositions.filter((p) => p.status === 'open');
    const totalValue = open.reduce((sum, p) => sum + (Number(p.current_value) || 0), 0);
    const totalCost = open.reduce((sum, p) => sum + (Number(p.cost_basis) || 0), 0);
    const totalUnrealized = open.reduce(
      (sum, p) => sum + (Number(p.unrealized_pnl) || 0),
      0,
    );
    const totalRealized = allPositions.reduce(
      (sum, p) => sum + (Number(p.realized_pnl) || 0),
      0,
    );

    const resolved = allPositions.filter((p) => p.status === 'resolved');
    const wins = resolved.filter(
      (p) => (Number(p.realized_pnl) || 0) > 0,
    ).length;
    const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;

    res.json({
      summary: {
        total_value: totalValue,
        total_cost: totalCost,
        unrealized_pnl: totalUnrealized,
        realized_pnl: totalRealized,
        total_pnl: totalUnrealized + totalRealized,
        open_positions: open.length,
        resolved_positions: resolved.length,
        win_rate: winRate,
      },
      positions: allPositions,
    });
  } catch (error) {
    logger.error('Portfolio fetch error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch portfolio', code: 'PORTFOLIO_ERROR' });
  }
});

export default router;
