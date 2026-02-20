import { query } from '../utils/db';
import logger from '../utils/logger';
import { kalshiService } from './kalshi.service';
import { polymarketService } from './polymarket.service';
import { PolymarketMarketData } from '../types/polymarket';

export interface MarketComparison {
  event: string;
  kalshi: { probability: number; volume: number; market_id: string } | null;
  polymarket: { probability: number; volume24h: number; market_id: string } | null;
  spread_pct: number;               // |kalshi_prob - poly_prob| * 100
  best_platform: 'kalshi' | 'polymarket'; // Lower price for YES
  arbitrage_opportunity: boolean;   // spread_pct > 5
  consensus_probability: number;    // Volume-weighted average
  timestamp: Date;
}

/**
 * Market Comparison Service
 * Fetches and compares probabilities across Kalshi and Polymarket
 */
export class MarketComparisonService {
  /**
   * Compare a specific paired event (user supplies both market IDs explicitly)
   * @param kalshiMarketId - Kalshi ticker (e.g. "INXD-26DEC29")
   * @param polymarketConditionId - Polymarket condition_id (hex string)
   */
  async compareMarkets(
    kalshiMarketId: string,
    polymarketConditionId: string,
  ): Promise<MarketComparison> {
    logger.info('Comparing markets across platforms', {
      kalshiMarketId,
      polymarketConditionId,
    });

    // Fetch both in parallel, don't fail if one side errors
    const [kalshiResult, polyResult] = await Promise.allSettled([
      kalshiService.fetchProbability(kalshiMarketId),
      polymarketService.fetchProbability(polymarketConditionId),
    ]);

    const kalshiData =
      kalshiResult.status === 'fulfilled'
        ? {
            probability: kalshiResult.value.probability,
            volume: kalshiResult.value.volume,
            market_id: kalshiMarketId,
          }
        : null;

    const polyData =
      polyResult.status === 'fulfilled'
        ? {
            probability: polyResult.value.probability,
            volume24h: polyResult.value.volume24h,
            market_id: polymarketConditionId,
          }
        : null;

    if (kalshiResult.status === 'rejected') {
      logger.warn('Failed to fetch Kalshi probability', {
        kalshiMarketId,
        error: kalshiResult.reason?.message,
      });
    }
    if (polyResult.status === 'rejected') {
      logger.warn('Failed to fetch Polymarket probability', {
        polymarketConditionId,
        error: polyResult.reason?.message,
      });
    }

    const kalshiProb = kalshiData?.probability ?? 0;
    const polyProb = polyData?.probability ?? 0;

    const spread_pct =
      kalshiData && polyData
        ? Math.abs(kalshiProb - polyProb) * 100
        : 0;

    const arbitrage_opportunity = spread_pct > 5;

    // Best platform = lower YES price (more favourable to buyer)
    const best_platform: 'kalshi' | 'polymarket' =
      !polyData || (kalshiData && kalshiProb <= polyProb) ? 'kalshi' : 'polymarket';

    // Volume-weighted average consensus probability
    const kalshiVol = kalshiData?.volume ?? 0;
    const polyVol = polyData?.volume24h ?? 0;
    const totalVol = kalshiVol + polyVol;

    let consensus_probability: number;
    if (totalVol > 0) {
      consensus_probability =
        (kalshiProb * kalshiVol + polyProb * polyVol) / totalVol;
    } else if (kalshiData && polyData) {
      consensus_probability = (kalshiProb + polyProb) / 2;
    } else {
      consensus_probability = kalshiData?.probability ?? polyData?.probability ?? 0;
    }

    const comparison: MarketComparison = {
      event: `${kalshiMarketId} / ${polymarketConditionId}`,
      kalshi: kalshiData,
      polymarket: polyData,
      spread_pct,
      best_platform,
      arbitrage_opportunity,
      consensus_probability,
      timestamp: new Date(),
    };

    // Cache to DB (best-effort, don't throw on failure)
    try {
      await this.saveComparison(kalshiMarketId, polymarketConditionId, comparison);
    } catch (dbError) {
      logger.warn('Failed to save comparison to DB', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    return comparison;
  }

  /**
   * Search both platforms independently and return unpaired results
   * The UI displays them side-by-side for the user to pair
   */
  async searchBothPlatforms(searchQuery: string): Promise<{
    kalshi: any[];
    polymarket: PolymarketMarketData[];
  }> {
    logger.info('Searching both platforms', { query: searchQuery });

    const [kalshiResult, polyResult] = await Promise.allSettled([
      kalshiService.searchMarkets(searchQuery),
      polymarketService.searchMarkets(searchQuery),
    ]);

    const kalshi = kalshiResult.status === 'fulfilled' ? kalshiResult.value : [];
    const polymarket = polyResult.status === 'fulfilled' ? polyResult.value : [];

    if (kalshiResult.status === 'rejected') {
      logger.warn('Kalshi search failed', { error: kalshiResult.reason?.message });
    }
    if (polyResult.status === 'rejected') {
      logger.warn('Polymarket search failed', { error: polyResult.reason?.message });
    }

    return { kalshi, polymarket };
  }

  /**
   * Retrieve comparisons from DB with arbitrage spread above threshold
   * @param spreadThreshold - Minimum spread % to include (default 5)
   */
  async getArbitrageOpportunities(spreadThreshold = 5): Promise<MarketComparison[]> {
    try {
      const result = await query(
        `SELECT * FROM market_comparisons
         WHERE spread_pct >= $1
         ORDER BY spread_pct DESC, created_at DESC
         LIMIT 50`,
        [spreadThreshold],
      );

      return result.rows.map((row: any) => ({
        event: row.event_name ?? `${row.kalshi_market_id} / ${row.polymarket_condition_id}`,
        kalshi: row.kalshi_probability != null
          ? {
              probability: parseFloat(row.kalshi_probability),
              volume: row.raw_data?.kalshi?.volume ?? 0,
              market_id: row.kalshi_market_id,
            }
          : null,
        polymarket: row.polymarket_probability != null
          ? {
              probability: parseFloat(row.polymarket_probability),
              volume24h: row.raw_data?.polymarket?.volume24h ?? 0,
              market_id: row.polymarket_condition_id,
            }
          : null,
        spread_pct: parseFloat(row.spread_pct),
        best_platform:
          (parseFloat(row.kalshi_probability ?? '1')) <=
          (parseFloat(row.polymarket_probability ?? '1'))
            ? 'kalshi'
            : 'polymarket',
        arbitrage_opportunity: row.arbitrage_opportunity,
        consensus_probability: parseFloat(row.consensus_probability ?? '0'),
        timestamp: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to fetch arbitrage opportunities from DB', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Persist comparison result to the market_comparisons table
   */
  private async saveComparison(
    kalshiMarketId: string,
    polymarketConditionId: string,
    comparison: MarketComparison,
  ): Promise<void> {
    await query(
      `INSERT INTO market_comparisons
         (kalshi_market_id, polymarket_condition_id, event_name,
          kalshi_probability, polymarket_probability, spread_pct,
          consensus_probability, arbitrage_opportunity, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        kalshiMarketId,
        polymarketConditionId,
        comparison.event,
        comparison.kalshi?.probability ?? null,
        comparison.polymarket?.probability ?? null,
        comparison.spread_pct,
        comparison.consensus_probability,
        comparison.arbitrage_opportunity,
        JSON.stringify({
          kalshi: comparison.kalshi,
          polymarket: comparison.polymarket,
        }),
      ],
    );
  }
}

export const marketComparisonService = new MarketComparisonService();
