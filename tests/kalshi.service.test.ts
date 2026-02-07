import axios from 'axios';
import { KalshiService } from '../src/services/kalshi.service';
import { KalshiMarketResponse, KALSHI_STALENESS_THRESHOLD_MS } from '../src/types/kalshi';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock isAxiosError
const mockIsAxiosError = jest.fn();
(axios.isAxiosError as unknown as jest.Mock) = mockIsAxiosError;

describe('KalshiService', () => {
  let kalshiService: KalshiService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockIsAxiosError.mockReturnValue(false);

    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create service instance
    kalshiService = new KalshiService('test-api-key');
  });

  describe('fetchProbability', () => {
    const mockMarketId = 'USRECESSION-2026';

    const createMockResponse = (lastPrice: number): KalshiMarketResponse => ({
      market: {
        ticker: mockMarketId,
        event_ticker: 'USRECESSION',
        market_type: 'binary',
        title: 'Will the US enter a recession in 2026?',
        subtitle: '',
        open_time: '2025-01-01T00:00:00Z',
        close_time: '2026-12-31T23:59:59Z',
        expected_expiration_time: '2026-12-31T23:59:59Z',
        latest_expiration_time: '2026-12-31T23:59:59Z',
        status: 'active',
        yes_bid: 45,
        yes_ask: 47,
        no_bid: 53,
        no_ask: 55,
        last_price: lastPrice,
        previous_yes_bid: 44,
        previous_yes_ask: 46,
        previous_price: lastPrice - 1,
        volume: 10000,
        volume_24h: 500,
        liquidity: 50000,
        open_interest: 15000,
        result: '',
        can_close_early: false,
        expiration_value: '',
        category: 'Economics',
        risk_limit_cents: 850,
        strike_type: 'binary',
        floor_strike: 0,
        cap_strike: 100,
        expiration_time: '2026-12-31T23:59:59Z',
        settlement_timer_seconds: 0,
        market_id: mockMarketId,
      },
    });

    it('should successfully fetch probability', async () => {
      const mockResponse = createMockResponse(46);
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await kalshiService.fetchProbability(mockMarketId);

      expect(result).toMatchObject({
        marketId: mockMarketId,
        probability: 0.46,
        lastPrice: 46,
        volume: 10000,
        openInterest: 15000,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/markets/${mockMarketId}`);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should calculate probability correctly from last price', async () => {
      const testCases = [
        { lastPrice: 0, expected: 0 },
        { lastPrice: 25, expected: 0.25 },
        { lastPrice: 50, expected: 0.5 },
        { lastPrice: 75, expected: 0.75 },
        { lastPrice: 100, expected: 1 },
      ];

      for (const { lastPrice, expected } of testCases) {
        const mockResponse = createMockResponse(lastPrice);
        mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await kalshiService.fetchProbability(mockMarketId);
        expect(result.probability).toBe(expected);
      }
    });

    it('should reject invalid probability values', async () => {
      const mockResponse = createMockResponse(150); // Invalid: > 100
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: mockResponse });

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow(
        'Invalid probability value',
      );
    });

    it('should reject negative probability values', async () => {
      const mockResponse = createMockResponse(-10);
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({ data: mockResponse });

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow(
        'Invalid probability value',
      );
    });

    it('should reject invalid response structure', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow(
        'Invalid Kalshi API response',
      );
    });

    it('should reject missing market data', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { market: null } })
        .mockResolvedValueOnce({ data: { market: null } })
        .mockResolvedValueOnce({ data: { market: null } });

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow(
        'Invalid Kalshi API response',
      );
    });
  });

  describe('Error handling and retries', () => {
    const mockMarketId = 'USRECESSION-2026';

    it('should retry on network errors', async () => {
      const networkError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        request: {},
      });

      mockIsAxiosError.mockReturnValue(true);

      // Fail twice, succeed on third attempt
      mockAxiosInstance.get
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: {
            market: {
              ticker: mockMarketId,
              last_price: 50,
              volume: 1000,
              open_interest: 500,
            },
          },
        });

      const result = await kalshiService.fetchProbability(mockMarketId);

      expect(result.probability).toBe(0.5);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should retry on 5xx server errors', async () => {
      const serverError = Object.assign(new Error('Request failed with status code 503'), {
        isAxiosError: true,
        response: {
          status: 503,
          data: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' } },
        },
      });

      mockIsAxiosError.mockReturnValue(true);

      mockAxiosInstance.get
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          data: {
            market: {
              ticker: mockMarketId,
              last_price: 50,
              volume: 1000,
              open_interest: 500,
            },
          },
        });

      const result = await kalshiService.fetchProbability(mockMarketId);

      expect(result.probability).toBe(0.5);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx client errors', async () => {
      const clientError = Object.assign(new Error('Request failed with status code 404'), {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: { code: 'NOT_FOUND', message: 'Market not found' } },
        },
      });

      mockIsAxiosError.mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(clientError);

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow(
        'Kalshi API error (404)',
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const networkError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        request: {},
      });

      mockIsAxiosError.mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3); // Max retries
    });

    it('should handle 401 unauthorized errors', async () => {
      const authError = Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
        },
      });

      mockIsAxiosError.mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(authError);

      await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow(
        'Kalshi API error (401)',
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = Object.assign(new Error('timeout of 10000ms exceeded'), {
        isAxiosError: true,
        code: 'ECONNABORTED',
        request: {},
      });

      mockIsAxiosError.mockReturnValue(true);

      mockAxiosInstance.get
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          data: {
            market: {
              ticker: mockMarketId,
              last_price: 50,
              volume: 1000,
              open_interest: 500,
            },
          },
        });

      const result = await kalshiService.fetchProbability(mockMarketId);
      expect(result.probability).toBe(0.5);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Schema validation', () => {
    const mockMarketId = 'USRECESSION-2026';

    it('should validate required fields are present', async () => {
      const invalidResponses = [
        { data: null },
        { data: {} },
        { data: { market: null } },
        { data: { market: {} } },
        { data: { market: { ticker: 'TEST' } } }, // Missing last_price
      ];

      for (const response of invalidResponses) {
        jest.clearAllMocks();
        mockAxiosInstance.get
          .mockResolvedValueOnce(response)
          .mockResolvedValueOnce(response)
          .mockResolvedValueOnce(response);

        await expect(kalshiService.fetchProbability(mockMarketId)).rejects.toThrow();
      }
    }, 30000);

    it('should accept valid response with all required fields', async () => {
      const validResponse = {
        data: {
          market: {
            ticker: mockMarketId,
            last_price: 50,
            volume: 1000,
            open_interest: 500,
            event_ticker: 'TEST',
            market_type: 'binary',
            title: 'Test',
            subtitle: '',
            open_time: '2025-01-01T00:00:00Z',
            close_time: '2026-12-31T23:59:59Z',
            expected_expiration_time: '2026-12-31T23:59:59Z',
            latest_expiration_time: '2026-12-31T23:59:59Z',
            status: 'active',
            yes_bid: 49,
            yes_ask: 51,
            no_bid: 49,
            no_ask: 51,
            previous_yes_bid: 48,
            previous_yes_ask: 52,
            previous_price: 49,
            volume_24h: 100,
            liquidity: 5000,
            result: '',
            can_close_early: false,
            expiration_value: '',
            category: 'Test',
            risk_limit_cents: 850,
            strike_type: 'binary',
            floor_strike: 0,
            cap_strike: 100,
            expiration_time: '2026-12-31T23:59:59Z',
            settlement_timer_seconds: 0,
            market_id: mockMarketId,
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(validResponse);

      const result = await kalshiService.fetchProbability(mockMarketId);
      expect(result.probability).toBe(0.5);
    });
  });

  describe('API configuration', () => {
    it('should create axios instance with correct config', () => {
      const service = new KalshiService('my-api-key');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.kalshi.com/trade-api/v2',
          timeout: 10000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer my-api-key',
          }),
        }),
      );
    });

    it('should work without API key', () => {
      const service = new KalshiService();

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });
});
