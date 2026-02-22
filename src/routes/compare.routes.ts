import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { marketComparisonService } from '../services/market-comparison.service';

const router = Router();

/**
 * GET /api/compare/search?q=<query>
 * Search both platforms and return auto-paired comparisons
 */
router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter: q', code: 'MISSING_QUERY' });
    return;
  }

  try {
    const comparisons = await marketComparisonService.compareByQuery(q);
    res.json({ comparisons, count: comparisons.length, query: q });
  } catch (error) {
    logger.error('Compare search error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to search comparisons', code: 'SEARCH_ERROR' });
  }
});

/**
 * GET /api/compare/arbitrage?threshold=<number>
 * Return cached arbitrage opportunities above threshold spread %
 */
router.get('/arbitrage', async (req: Request, res: Response) => {
  const threshold = req.query.threshold != null ? Number(req.query.threshold) : 5;
  if (isNaN(threshold) || threshold < 0) {
    res.status(400).json({ error: 'Invalid threshold', code: 'INVALID_THRESHOLD' });
    return;
  }

  try {
    const opportunities = await marketComparisonService.getArbitrageOpportunities(threshold);
    res.json({ opportunities, count: opportunities.length, threshold });
  } catch (error) {
    logger.error('Arbitrage fetch error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch arbitrage opportunities', code: 'ARBITRAGE_ERROR' });
  }
});

/**
 * GET /api/compare/:kalshi_id
 * Auto-match a Kalshi market to its Polymarket counterpart and compare
 */
router.get('/:kalshi_id', async (req: Request, res: Response) => {
  const kalshi_id = String(req.params.kalshi_id);

  try {
    const match = await marketComparisonService.findSameEvent(kalshi_id);

    if (!match) {
      res.status(404).json({
        error: 'No matching Polymarket market found',
        kalshi_id,
        code: 'NO_MATCH',
      });
      return;
    }

    const comparison = await marketComparisonService.compareMarkets(
      kalshi_id,
      match.polymarket.conditionId,
    );

    res.json({ comparison, similarity_score: match.score });
  } catch (error) {
    logger.error('Compare by kalshi_id error', {
      kalshi_id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to compare market', code: 'COMPARE_ERROR' });
  }
});

export default router;
