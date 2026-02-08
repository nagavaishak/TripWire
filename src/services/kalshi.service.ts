import { Configuration, MarketApi } from 'kalshi-typescript';
import logger from '../utils/logger';
import {
  KalshiProbabilityData,
  KALSHI_API_BASE_URL_PRODUCTION,
  KALSHI_API_BASE_URL_DEMO,
} from '../types/kalshi';

/**
 * Kalshi Service with Official SDK
 * Uses RSA-PSS authentication for secure API access
 */
export class KalshiService {
  private marketApi: MarketApi;
  private config: Configuration;
  private environment: 'demo' | 'production';

  constructor(params?: {
    apiKeyId?: string;
    privateKeyPem?: string;
    privateKeyPath?: string;
    environment?: 'demo' | 'production';
  }) {
    // Get credentials from params or environment
    const apiKeyId = params?.apiKeyId || process.env.KALSHI_API_KEY_ID || '';
    const privateKeyPem =
      params?.privateKeyPem || process.env.KALSHI_PRIVATE_KEY || '';
    const privateKeyPath =
      params?.privateKeyPath || process.env.KALSHI_PRIVATE_KEY_PATH || '';
    this.environment =
      params?.environment ||
      (process.env.KALSHI_ENVIRONMENT as 'demo' | 'production') ||
      'production';

    // Validate credentials
    if (!apiKeyId) {
      logger.warn('KALSHI_API_KEY_ID not configured - API calls will fail');
    }

    if (!privateKeyPem && !privateKeyPath) {
      logger.warn(
        'KALSHI_PRIVATE_KEY or KALSHI_PRIVATE_KEY_PATH not configured - API calls will fail',
      );
    }

    // Determine base URL
    const basePath =
      this.environment === 'demo'
        ? KALSHI_API_BASE_URL_DEMO
        : KALSHI_API_BASE_URL_PRODUCTION;

    // Configure SDK with RSA authentication
    this.config = new Configuration({
      apiKey: apiKeyId,
      privateKeyPem: privateKeyPem || undefined,
      privateKeyPath: privateKeyPath || undefined,
      basePath,
    });

    this.marketApi = new MarketApi(this.config);

    logger.info('Kalshi service initialized', {
      environment: this.environment,
      basePath,
      hasApiKey: !!apiKeyId,
      hasPrivateKey: !!(privateKeyPem || privateKeyPath),
    });
  }

  /**
   * Fetch current probability for a market
   * @param marketTicker - Kalshi market ticker (e.g., "INXD-24FEB28-B4500")
   * @returns Probability data with staleness validation
   */
  async fetchProbability(
    marketTicker: string,
  ): Promise<KalshiProbabilityData> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Fetching Kalshi market data', {
          marketTicker,
          attempt,
          environment: this.environment,
        });

        // Use official SDK to fetch market
        const response = await this.marketApi.getMarket({
          marketTicker,
        });

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

        // Validate market is still active (not settled/closed)
        this.validateMarketActive(market);

        const data: KalshiProbabilityData = {
          marketId: market.ticker,
          probability,
          timestamp,
          lastPrice: market.last_price,
          volume: market.volume || 0,
          openInterest: market.open_interest || 0,
        };

        logger.info('Successfully fetched Kalshi probability', {
          marketTicker,
          probability,
          lastPrice: market.last_price,
          volume: market.volume,
          status: market.status,
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
      marketTicker,
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
  private handleError(
    error: unknown,
    attempt: number,
    maxRetries: number,
  ): Error {
    // SDK throws axios errors
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;

      if (axiosError.response) {
        // Server responded with error status
        const status = axiosError.response.status;
        const message =
          axiosError.response.data?.error?.message ||
          axiosError.response.data?.message ||
          axiosError.message;

        logger.error('Kalshi API error response', {
          status,
          message,
          attempt,
          maxRetries,
          environment: this.environment,
        });

        // Don't retry on client errors (4xx) - likely auth or invalid request
        if (status >= 400 && status < 500) {
          if (status === 401) {
            throw new Error(
              'Kalshi authentication failed - check API key and private key',
            );
          }
          if (status === 404) {
            throw new Error('Kalshi market not found');
          }
          throw new Error(`Kalshi API error (${status}): ${message}`);
        }

        // Retry on 5xx server errors
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
   * Get current environment
   */
  getEnvironment(): 'demo' | 'production' {
    return this.environment;
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      (this.config.privateKeyPem || this.config.privateKeyPath)
    );
  }
}

// Export singleton instance
export const kalshiService = new KalshiService();
