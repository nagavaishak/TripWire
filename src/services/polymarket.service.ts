import axios from 'axios';
import logger from '../utils/logger';
import {
  PolymarketProbabilityData,
  PolymarketMarketData,
  PolymarketOrderbook,
  PolymarketPosition,
  PolymarketOrderParams,
  POLYMARKET_API_BASE_URL,
} from '../types/polymarket';
import { CONFIG } from '../utils/config';

/**
 * Polymarket Service
 * Fetches market data from Polymarket CLOB API (public, no auth required for reads)
 * Supports:
 * - Real mode: Public CLOB API — no authentication needed
 * - Mock mode: Deterministic fake data for testing
 */
export class PolymarketService {
  private mockMode: boolean;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(params?: { mockMode?: boolean; baseUrl?: string; timeoutMs?: number }) {
    this.mockMode = params?.mockMode ?? CONFIG.POLYMARKET_MOCK_MODE;
    this.baseUrl = params?.baseUrl ?? CONFIG.POLYMARKET_API_URL;
    this.timeoutMs = params?.timeoutMs ?? CONFIG.POLYMARKET_TIMEOUT_MS;

    logger.info('Polymarket service initialized', {
      mode: this.mockMode ? 'MOCK' : 'PUBLIC_API',
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Fetch current probability for a Polymarket market
   * @param conditionId - Polymarket condition ID (hex string)
   */
  async fetchProbability(conditionId: string): Promise<PolymarketProbabilityData> {
    if (this.mockMode) {
      return this.getMockProbability(conditionId);
    }
    return this.fetchFromPublicAPI(conditionId);
  }

  /**
   * Fetch market details for a specific condition ID
   */
  async fetchMarket(conditionId: string): Promise<PolymarketMarketData> {
    if (this.mockMode) {
      return this.getMockMarket(conditionId);
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Fetching Polymarket market', { conditionId, attempt });

        const response = await axios.get(`${this.baseUrl}/markets`, {
          params: { condition_id: conditionId },
          headers: { Accept: 'application/json' },
          timeout: this.timeoutMs,
        });

        const markets = response.data?.data ?? response.data;
        const market = Array.isArray(markets) ? markets[0] : markets;

        if (!market) {
          throw new Error(`Polymarket market not found: ${conditionId}`);
        }

        return this.mapMarket(market);
      } catch (error) {
        lastError = this.handleError(error, attempt, maxRetries);
        if (attempt < maxRetries) {
          const delayMs = this.getRetryDelay(attempt);
          logger.info(`Retrying after ${delayMs}ms`, { attempt, maxRetries });
          await this.sleep(delayMs);
        }
      }
    }

    logger.error('Failed to fetch Polymarket market after all retries', {
      conditionId,
      error: lastError?.message,
    });
    throw lastError || new Error('Failed to fetch Polymarket market');
  }

  /**
   * Fetch a list of active markets
   * @param limit - Number of markets to fetch (default 20)
   */
  async fetchMarkets(limit = 20): Promise<PolymarketMarketData[]> {
    if (this.mockMode) {
      return this.getMockMarkets();
    }

    try {
      logger.info('Fetching Polymarket markets list', { limit });

      const response = await axios.get(`${this.baseUrl}/markets`, {
        params: { limit },
        headers: { Accept: 'application/json' },
        timeout: this.timeoutMs,
      });

      const markets = response.data?.data ?? response.data ?? [];
      const marketArray = Array.isArray(markets) ? markets : [];

      return marketArray.map((m: any) => this.mapMarket(m));
    } catch (error) {
      logger.error('Failed to fetch Polymarket markets', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getMockMarkets();
    }
  }

  /**
   * Search markets by keyword against question text
   */
  async searchMarkets(query: string): Promise<PolymarketMarketData[]> {
    if (this.mockMode) {
      return this.getMockMarkets().filter((m) =>
        m.question.toLowerCase().includes(query.toLowerCase()),
      );
    }

    try {
      logger.info('Searching Polymarket markets', { query });

      // Polymarket CLOB doesn't have a dedicated search endpoint — fetch and filter
      const response = await axios.get(`${this.baseUrl}/markets`, {
        params: { limit: 100 },
        headers: { Accept: 'application/json' },
        timeout: this.timeoutMs,
      });

      const markets = response.data?.data ?? response.data ?? [];
      const marketArray = Array.isArray(markets) ? markets : [];
      const lowerQuery = query.toLowerCase();

      return marketArray
        .filter((m: any) => {
          const question = (m.question || m.description || '').toLowerCase();
          return question.includes(lowerQuery);
        })
        .map((m: any) => this.mapMarket(m));
    } catch (error) {
      logger.error('Failed to search Polymarket markets', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch probability data from the public Polymarket CLOB API
   * Uses the /books endpoint to get best bid/ask for YES outcome token
   */
  private async fetchFromPublicAPI(conditionId: string): Promise<PolymarketProbabilityData> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Fetching from public Polymarket CLOB API', {
          conditionId,
          attempt,
        });

        // Step 1: Get market to find YES outcome token ID
        const marketResponse = await axios.get(`${this.baseUrl}/markets`, {
          params: { condition_id: conditionId },
          headers: { Accept: 'application/json' },
          timeout: this.timeoutMs,
        });

        const markets = marketResponse.data?.data ?? marketResponse.data;
        const market = Array.isArray(markets) ? markets[0] : markets;

        if (!market) {
          throw new Error(`Polymarket market not found: ${conditionId}`);
        }

        // Step 2: Get YES token ID (first token in tokens array is typically YES)
        const tokens = market.tokens ?? [];
        const yesToken = tokens.find(
          (t: any) => (t.outcome ?? '').toLowerCase() === 'yes',
        ) ?? tokens[0];

        if (!yesToken?.token_id) {
          throw new Error('Could not find YES outcome token for market');
        }

        // Step 3: Fetch orderbook for YES token
        const bookResponse = await axios.get(`${this.baseUrl}/books`, {
          params: { token_id: yesToken.token_id },
          headers: { Accept: 'application/json' },
          timeout: this.timeoutMs,
        });

        const book = bookResponse.data;

        // Best bid on YES token = implied YES probability (Polymarket prices are 0-1)
        const bestBid = parseFloat(book?.bids?.[0]?.price ?? '0') || 0;
        const bestAsk = parseFloat(book?.asks?.[0]?.price ?? '1') || 1;

        // Validate probability
        const probability = bestBid;
        if (probability < 0 || probability > 1) {
          throw new Error(`Invalid Polymarket probability: ${probability}`);
        }

        const data: PolymarketProbabilityData = {
          marketId: conditionId,
          probability,
          timestamp: new Date(),
          bestBid,
          bestAsk,
          volume24h: parseFloat(market.volume_24hr ?? market.volume ?? '0') || 0,
          liquidity: parseFloat(market.liquidity ?? '0') || 0,
        };

        logger.info('Successfully fetched Polymarket probability', {
          conditionId,
          probability,
          bestBid,
          bestAsk,
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

    logger.warn('Failed to fetch Polymarket probability, falling back to mock', {
      conditionId,
      error: lastError?.message,
    });
    return this.getMockProbability(conditionId);
  }

  /**
   * Generate deterministic mock probability for testing
   */
  private getMockProbability(conditionId: string): PolymarketProbabilityData {
    const hash = conditionId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const probability = 0.3 + (hash % 40) / 100; // Range: 0.30 to 0.70
    const bestBid = Math.round(probability * 100) / 100;
    const bestAsk = Math.min(1, bestBid + 0.02);

    logger.info('Returning MOCK Polymarket probability', {
      conditionId,
      probability,
      note: 'Set POLYMARKET_MOCK_MODE=false to use real API',
    });

    return {
      marketId: conditionId,
      probability,
      timestamp: new Date(),
      bestBid,
      bestAsk,
      volume24h: 10000 + (hash % 50000),
      liquidity: 5000 + (hash % 20000),
    };
  }

  /**
   * Generate deterministic mock market data for testing
   */
  private getMockMarket(conditionId: string): PolymarketMarketData {
    return {
      conditionId,
      question: `Mock Polymarket Event (${conditionId.slice(0, 8)})`,
      outcomeTokens: ['Yes', 'No'],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
      volume: 100000,
    };
  }

  /**
   * Generate a list of mock markets
   */
  private getMockMarkets(): PolymarketMarketData[] {
    return [
      {
        conditionId: '0xmock001',
        question: 'Will there be a US recession in 2026?',
        outcomeTokens: ['Yes', 'No'],
        endDate: '2026-12-31T00:00:00Z',
        active: true,
        volume: 500000,
      },
      {
        conditionId: '0xmock002',
        question: 'Will the Fed cut rates in Q1 2026?',
        outcomeTokens: ['Yes', 'No'],
        endDate: '2026-03-31T00:00:00Z',
        active: true,
        volume: 250000,
      },
      {
        conditionId: '0xmock003',
        question: 'Will Bitcoin reach $150k in 2026?',
        outcomeTokens: ['Yes', 'No'],
        endDate: '2026-12-31T00:00:00Z',
        active: true,
        volume: 1200000,
      },
    ];
  }

  /**
   * Map raw Polymarket API market object to PolymarketMarketData
   */
  private mapMarket(market: any): PolymarketMarketData {
    return {
      conditionId: market.condition_id ?? market.id ?? '',
      question: market.question ?? market.description ?? 'Unknown market',
      outcomeTokens: (market.tokens ?? []).map((t: any) => t.outcome ?? t) as string[],
      endDate: market.end_date_iso ?? market.end_date ?? '',
      active: market.active ?? market.accepting_orders ?? false,
      volume: parseFloat(market.volume ?? '0') || 0,
    };
  }

  /**
   * Handle errors with proper logging and classification
   */
  private handleError(error: unknown, attempt: number, maxRetries: number): Error {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const message =
          axiosError.response.data?.message ||
          axiosError.message;

        logger.error('Polymarket API error response', {
          status,
          message,
          attempt,
          maxRetries,
        });

        if (status >= 400 && status < 500) {
          if (status === 404) {
            throw new Error('Polymarket market not found');
          }
          throw new Error(`Polymarket API error (${status}): ${message}`);
        }

        return new Error(`Polymarket API error (${status}): ${message}`);
      } else if (axiosError.request) {
        logger.error('Polymarket API network error', {
          message: axiosError.message,
          attempt,
          maxRetries,
        });
        return new Error(`Polymarket network error: ${axiosError.message}`);
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Polymarket service error', { error: errorMessage, attempt, maxRetries });
    return new Error(`Polymarket service error: ${errorMessage}`);
  }

  /**
   * Exponential backoff: 1s, 2s, 4s (capped at 10s)
   */
  private getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch level-2 orderbook for a specific token
   */
  async getOrderbook(tokenId: string): Promise<PolymarketOrderbook> {
    if (this.mockMode) {
      return this.getMockOrderbook(tokenId);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/books`, {
        params: { token_id: tokenId },
        headers: { Accept: 'application/json' },
        timeout: this.timeoutMs,
      });

      const book = response.data;
      const bids = (book?.bids ?? []).map((b: any) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }));
      const asks = (book?.asks ?? []).map((a: any) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }));

      const bestBid = bids[0]?.price ?? 0;
      const bestAsk = asks[0]?.price ?? 1;

      return {
        tokenId,
        bids,
        asks,
        spread: bestAsk - bestBid,
        midpoint: (bestBid + bestAsk) / 2,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.warn('Failed to fetch Polymarket orderbook, using mock', {
        tokenId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getMockOrderbook(tokenId);
    }
  }

  /**
   * Get current mid-price (implied probability) for a market
   */
  async getCurrentPrice(conditionId: string): Promise<number> {
    const prob = await this.fetchProbability(conditionId);
    return (prob.bestBid + prob.bestAsk) / 2;
  }

  /**
   * Place an order on Polymarket CLOB (stub — requires private key signing)
   * In production this would sign a ClobClient order with the user's wallet.
   */
  async placeOrder(params: PolymarketOrderParams): Promise<{ orderId: string; status: string }> {
    logger.info('Polymarket placeOrder called (stub)', params);
    // Stub: returns a mock order ID
    // Real impl: use @polymarket/clob-client with user L1/L2 auth
    return {
      orderId: `mock-order-${Date.now()}`,
      status: 'STUB_NOT_EXECUTED',
    };
  }

  /**
   * Get positions for a wallet address (stub — requires Polymarket data API)
   */
  async getPositions(address: string): Promise<PolymarketPosition[]> {
    if (this.mockMode) {
      return this.getMockPositions(address);
    }
    logger.info('Polymarket getPositions called (stub)', { address });
    // Real impl: query Polymarket data API or on-chain CTF positions
    return this.getMockPositions(address);
  }

  private getMockOrderbook(tokenId: string): PolymarketOrderbook {
    const hash = tokenId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const mid = 0.35 + (hash % 30) / 100;
    const spread = 0.02;
    return {
      tokenId,
      bids: [
        { price: mid - spread / 2, size: 500 },
        { price: mid - spread, size: 1200 },
      ],
      asks: [
        { price: mid + spread / 2, size: 600 },
        { price: mid + spread, size: 1000 },
      ],
      spread,
      midpoint: mid,
      timestamp: new Date(),
    };
  }

  private getMockPositions(address: string): PolymarketPosition[] {
    return [
      {
        conditionId: '0xmock001',
        tokenId: `${address.slice(0, 6)}-token-yes`,
        outcome: 'Yes',
        size: 100,
        avgPrice: 0.42,
        currentPrice: 0.55,
        pnl: 13,
      },
      {
        conditionId: '0xmock003',
        tokenId: `${address.slice(0, 6)}-token-no`,
        outcome: 'No',
        size: 50,
        avgPrice: 0.61,
        currentPrice: 0.48,
        pnl: -6.5,
      },
    ];
  }

  isMockMode(): boolean {
    return this.mockMode;
  }
}

// Export singleton instance
export const polymarketService = new PolymarketService();
