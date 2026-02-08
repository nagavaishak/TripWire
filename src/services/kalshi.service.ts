import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';
import {
  KalshiMarketResponse,
  KalshiProbabilityData,
  KalshiError,
  KALSHI_API_BASE_URL,
  KALSHI_STALENESS_THRESHOLD_MS,
} from '../types/kalshi';

export class KalshiService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.KALSHI_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('KALSHI_API_KEY not configured');
    }

    this.client = axios.create({
      baseURL: KALSHI_API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });
  }

  /**
   * Fetch current probability for a market
   * @param marketId - Kalshi market ticker
   * @returns Probability data with staleness validation
   */
  async fetchProbability(marketId: string): Promise<KalshiProbabilityData> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Fetching Kalshi market data', { marketId, attempt });

        const response = await this.client.get<KalshiMarketResponse>(
          `/markets/${marketId}`,
        );

        // Validate response structure
        if (!response.data?.market) {
          throw new Error('Invalid Kalshi API response: missing market data');
        }

        const market = response.data.market;

        // Validate required fields
        if (typeof market.last_price !== 'number') {
          throw new Error('Invalid Kalshi API response: missing last_price');
        }

        // Calculate probability from last price (Kalshi prices are in cents, 0-100)
        const probability = market.last_price / 100;

        // Validate probability is within bounds
        if (probability < 0 || probability > 1) {
          throw new Error(
            `Invalid probability value: ${probability}. Must be between 0 and 1`,
          );
        }

        const timestamp = new Date();

        // Note: Kalshi doesn't provide data timestamp in market endpoint
        // We use fetch time as proxy, but validate market is active
        const data: KalshiProbabilityData = {
          marketId: market.ticker,
          probability,
          timestamp,
          lastPrice: market.last_price,
          volume: market.volume,
          openInterest: market.open_interest,
        };

        // Validate market is still active (not settled/closed)
        this.validateMarketActive(market);

        logger.info('Successfully fetched Kalshi probability', {
          marketId,
          probability,
          lastPrice: market.last_price,
          volume: market.volume,
        });

        return data;
      } catch (error) {
        lastError = this.handleError(error, attempt, maxRetries);

        if (attempt < maxRetries) {
          const delayMs = this.getRetryDelay(attempt);
          logger.info(`Retrying after ${delayMs}ms`, { attempt, maxRetries });
          await this.sleep(delayMs);
        }
      }
    }

    // All retries exhausted
    logger.error('Failed to fetch Kalshi probability after all retries', {
      marketId,
      error: lastError?.message,
    });
    throw lastError || new Error('Failed to fetch Kalshi probability');
  }

  /**
   * Validate that market is still active and not settled/closed
   * FIXED: Previous implementation had circular logic (set timestamp to now, then check if now is stale)
   * This actually validates market status instead
   */
  private validateMarketActive(market: any): void {
    // Check if market status indicates it's closed or settled
    if (market.status && !['active', 'open'].includes(market.status.toLowerCase())) {
      throw new Error(
        `Kalshi market is not active: status=${market.status}. Cannot use for rule evaluation.`,
      );
    }

    // Check if market has close_time and it has passed
    if (market.close_time) {
      const closeTime = new Date(market.close_time).getTime();
      const now = Date.now();
      if (now > closeTime) {
        throw new Error(
          `Kalshi market has closed at ${market.close_time}. Cannot use for rule evaluation.`,
        );
      }
    }

    // Sanity check: if volume is 0 and open_interest is 0, market might be inactive
    if (market.volume === 0 && market.open_interest === 0) {
      logger.warn('Kalshi market has zero volume and open interest', {
        marketId: market.ticker,
      });
      // Don't throw - this might be a new market. Just log warning.
    }
  }

  /**
   * Handle errors with proper logging and classification
   */
  private handleError(error: unknown, attempt: number, maxRetries: number): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<KalshiError>;

      if (axiosError.response) {
        // Server responded with error status
        const status = axiosError.response.status;
        const message =
          axiosError.response.data?.error?.message || axiosError.message;

        logger.error('Kalshi API error response', {
          status,
          message,
          attempt,
          maxRetries,
        });

        // Don't retry on client errors (4xx)
        if (status >= 400 && status < 500) {
          throw new Error(`Kalshi API error (${status}): ${message}`);
        }

        return new Error(`Kalshi API error (${status}): ${message}`);
      } else if (axiosError.request) {
        // Request made but no response received (network error)
        logger.error('Kalshi API network error', {
          message: axiosError.message,
          attempt,
          maxRetries,
        });
        return new Error(`Kalshi network error: ${axiosError.message}`);
      }
    }

    // Unknown error
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Kalshi service error', {
      error: errorMessage,
      attempt,
      maxRetries,
    });
    return new Error(`Kalshi service error: ${errorMessage}`);
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate response schema
   */
  private validateMarketResponse(response: any): response is KalshiMarketResponse {
    return (
      response &&
      typeof response === 'object' &&
      'market' in response &&
      response.market &&
      typeof response.market === 'object' &&
      'ticker' in response.market &&
      'last_price' in response.market &&
      typeof response.market.last_price === 'number'
    );
  }
}

// Export singleton instance
export const kalshiService = new KalshiService();
