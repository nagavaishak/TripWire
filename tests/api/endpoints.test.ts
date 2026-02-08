import request from 'supertest';
import app from '../../src/index';
import {
  cleanupTestDatabase,
  createTestUser,
  createTestWallet,
  createTestRule,
  generateRandomSolanaAddress,
} from '../helpers/test-utils';

describe('API Endpoints Integration Tests', () => {
  let testUser: any;
  let testApiKey: string;
  let testWallet: any;

  beforeAll(async () => {
    // Create test user
    const { user, apiKey } = await createTestUser();
    testUser = user;
    testApiKey = apiKey;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Authentication', () => {
    test('POST /api/auth/register - creates new user', async () => {
      const email = `test-new-${Date.now()}@example.com`;
      const wallet = generateRandomSolanaAddress();

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          main_wallet_address: wallet,
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('api_key');
      expect(response.body.user.email).toBe(email);
      expect(response.body.api_key).toMatch(/^tw_/);
    });

    test('POST /api/auth/register - rejects duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          main_wallet_address: generateRandomSolanaAddress(),
        })
        .expect(409);
    });

    test('GET /api/me - returns authenticated user', async () => {
      const response = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('GET /api/me - rejects without auth', async () => {
      await request(app).get('/api/me').expect(401);
    });

    test('GET /api/me - rejects invalid API key', async () => {
      await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer invalid-key')
        .expect(401);
    });
  });

  describe('Wallets API', () => {
    test('POST /api/wallets - creates automation wallet', async () => {
      const response = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ name: 'Test Automation Wallet' })
        .expect(201);

      expect(response.body.wallet).toHaveProperty('id');
      expect(response.body.wallet).toHaveProperty('public_key');
      expect(response.body.wallet.name).toBe('Test Automation Wallet');

      testWallet = response.body.wallet;
    });

    test('GET /api/wallets - lists user wallets', async () => {
      const response = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body.wallets).toBeInstanceOf(Array);
      expect(response.body.wallets.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('total');
    });

    test('GET /api/wallets/:id - gets wallet details', async () => {
      const response = await request(app)
        .get(`/api/wallets/${testWallet.id}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body.wallet.id).toBe(testWallet.id);
      expect(response.body.wallet).toHaveProperty('balance');
    });

    test('GET /api/wallets/:id - rejects unauthorized access', async () => {
      const { user: otherUser, apiKey: otherKey } = await createTestUser();

      await request(app)
        .get(`/api/wallets/${testWallet.id}`)
        .set('Authorization', `Bearer ${otherKey}`)
        .expect(404);
    });

    test('GET /api/wallets/:id/balance - gets wallet balance', async () => {
      const response = await request(app)
        .get(`/api/wallets/${testWallet.id}/balance`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('balance_sol');
      expect(typeof response.body.balance).toBe('number');
    });
  });

  describe('Rules API', () => {
    let testRule: any;

    test('POST /api/rules - creates rule', async () => {
      const response = await request(app)
        .post('/api/rules')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          name: 'Test Rule',
          kalshi_market_id: 'USRECESSION-2026',
          condition_type: 'THRESHOLD_ABOVE',
          threshold_probability: 0.65,
          trigger_type: 'SWAP_TO_STABLECOIN',
          automation_wallet_id: testWallet.id,
          swap_percentage: 80,
          cooldown_hours: 24,
        })
        .expect(201);

      expect(response.body.rule).toHaveProperty('id');
      expect(response.body.rule.status).toBe('CREATED');
      expect(response.body.rule.threshold_probability).toBe(0.65);

      testRule = response.body.rule;
    });

    test('POST /api/rules - validates threshold probability', async () => {
      await request(app)
        .post('/api/rules')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          name: 'Invalid Rule',
          kalshi_market_id: 'TEST',
          condition_type: 'THRESHOLD_ABOVE',
          threshold_probability: 1.5, // Invalid!
          trigger_type: 'SWAP_TO_STABLECOIN',
          automation_wallet_id: testWallet.id,
        })
        .expect(400);
    });

    test('GET /api/rules - lists user rules', async () => {
      const response = await request(app)
        .get('/api/rules')
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body.rules).toBeInstanceOf(Array);
      expect(response.body.rules.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('total');
    });

    test('GET /api/rules/:id - gets rule details', async () => {
      const response = await request(app)
        .get(`/api/rules/${testRule.id}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body.rule.id).toBe(testRule.id);
      expect(response.body.rule.name).toBe('Test Rule');
    });

    test('PUT /api/rules/:id - updates rule', async () => {
      const response = await request(app)
        .put(`/api/rules/${testRule.id}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          name: 'Updated Rule Name',
          status: 'ACTIVE',
        })
        .expect(200);

      expect(response.body.rule.name).toBe('Updated Rule Name');
      expect(response.body.rule.status).toBe('ACTIVE');
    });

    test('PUT /api/rules/:id - validates status transitions', async () => {
      // Try invalid transition: ACTIVE -> EXECUTING (not allowed)
      await request(app)
        .put(`/api/rules/${testRule.id}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ status: 'EXECUTING' })
        .expect(400);
    });

    test('DELETE /api/rules/:id - deletes rule', async () => {
      await request(app)
        .delete(`/api/rules/${testRule.id}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      // Verify rule is cancelled
      const response = await request(app)
        .get(`/api/rules/${testRule.id}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(response.body.rule.status).toBe('CANCELLED');
    });
  });

  describe('Health Check', () => {
    test('GET /health - returns system status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('marketPoller');
      expect(response.body.marketPoller).toHaveProperty('running');
    });
  });
});
