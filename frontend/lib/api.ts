import axios from 'axios';
import { mockRules, mockWallets, mockMetrics, MOCK_MODE } from './mock-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tripwire_api_key');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API client functions
export const apiClient = {
  // Auth
  async register(email: string, walletAddress: string) {
    const { data } = await api.post('/api/auth/register', {
      email,
      main_wallet_address: walletAddress,
    });
    return data;
  },

  // Rules
  async getRules() {
    if (MOCK_MODE) return mockRules;
    const { data } = await api.get('/api/rules');
    return data.rules;
  },

  async getRule(id: number) {
    const { data } = await api.get(`/api/rules/${id}`);
    return data.rule;
  },

  async createRule(ruleData: any) {
    const { data } = await api.post('/api/rules', ruleData);
    return data.rule;
  },

  async updateRule(id: number, updates: any) {
    const { data } = await api.put(`/api/rules/${id}`, updates);
    return data.rule;
  },

  async deleteRule(id: number) {
    const { data } = await api.delete(`/api/rules/${id}`);
    return data;
  },

  // Wallets
  async getWallets() {
    if (MOCK_MODE) return mockWallets;
    const { data } = await api.get('/api/wallets');
    return data.wallets;
  },

  async getWallet(id: number) {
    const { data } = await api.get(`/api/wallets/${id}`);
    return data.wallet;
  },

  async createWallet(name: string) {
    const { data } = await api.post('/api/wallets', { name });
    return data.wallet;
  },

  async getWalletBalance(id: number) {
    const { data } = await api.get(`/api/wallets/${id}/balance`);
    return data.balance;
  },

  // Webhooks
  async getWebhooks() {
    const { data } = await api.get('/api/webhooks');
    return data.webhooks;
  },

  async createWebhook(webhookData: any) {
    const { data } = await api.post('/api/webhooks', webhookData);
    return data.webhook;
  },

  async deleteWebhook(id: number) {
    const { data } = await api.delete(`/api/webhooks/${id}`);
    return data;
  },

  async testWebhook(id: number) {
    const { data } = await api.post(`/api/webhooks/${id}/test`);
    return data;
  },

  // Admin
  async getMetrics() {
    if (MOCK_MODE) return mockMetrics;
    const { data } = await api.get('/api/admin/metrics');
    return data.metrics;
  },

  async getHealth() {
    const { data } = await api.get('/api/admin/health');
    return data;
  },

  async getExecutions(params?: any) {
    const { data } = await api.get('/api/admin/executions', { params });
    return data.executions;
  },
};
