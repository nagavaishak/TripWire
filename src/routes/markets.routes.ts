import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { marketComparisonService } from '../services/market-comparison.service';

const router = Router();

/**
 * GET /api/markets/search?q=<query>
 * Search both Kalshi and Polymarket for markets matching the query
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;

    if (!q || q.trim().length === 0) {
      res.status(400).json({
        error: 'Query parameter "q" is required',
        code: 'MISSING_QUERY',
      });
      return;
    }

    logger.info('Markets search request', { query: q, userId: req.user?.id });

    const results = await marketComparisonService.searchBothPlatforms(q.trim());

    res.json({
      query: q.trim(),
      results,
    });
  } catch (error) {
    logger.error('Markets search error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to search markets',
      code: 'SEARCH_ERROR',
    });
  }
});

/**
 * GET /api/markets/compare?kalshi=<id>&poly=<condition_id>
 * Compare a specific paired market across Kalshi and Polymarket
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const kalshiId = req.query.kalshi as string;
    const polyId = req.query.poly as string;

    if (!kalshiId || !polyId) {
      res.status(400).json({
        error: 'Both "kalshi" and "poly" query parameters are required',
        code: 'MISSING_PARAMS',
      });
      return;
    }

    logger.info('Markets compare request', {
      kalshiId,
      polyId,
      userId: req.user?.id,
    });

    const comparison = await marketComparisonService.compareMarkets(kalshiId, polyId);

    res.json({ comparison });
  } catch (error) {
    logger.error('Markets compare error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to compare markets',
      code: 'COMPARE_ERROR',
    });
  }
});

/**
 * GET /api/markets/arbitrage?threshold=5
 * Retrieve arbitrage opportunities with spread above threshold %
 */
router.get('/arbitrage', async (req: Request, res: Response) => {
  try {
    const threshold = parseFloat((req.query.threshold as string) || '5');

    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      res.status(400).json({
        error: 'threshold must be a number between 0 and 100',
        code: 'INVALID_THRESHOLD',
      });
      return;
    }

    logger.info('Arbitrage opportunities request', {
      threshold,
      userId: req.user?.id,
    });

    const opportunities = await marketComparisonService.getArbitrageOpportunities(threshold);

    res.json({
      threshold,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    logger.error('Arbitrage opportunities error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to fetch arbitrage opportunities',
      code: 'ARBITRAGE_ERROR',
    });
  }
});

export default router;
