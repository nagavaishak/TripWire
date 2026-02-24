const ORACLE_URL =
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  'https://attention-markets-api.onrender.com';

export interface TopicScore {
  value: number;       // 0–100 DoA score
  timestamp: number;   // unix seconds
  topic: string;
  sources: string[];
  weights: { youtube: number; google_trends: number; farcaster: number };
}

export interface HistoryPoint {
  time: number;
  value: number;
  components: { youtube: number; google_trends: number; farcaster: number };
}

export interface TopicHistory {
  topic: string;
  hours: number;
  sources: string[];
  data: HistoryPoint[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${ORACLE_URL}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const oracleClient = {
  getTopic: (topic: string) =>
    get<TopicScore>(`/api/attention/${encodeURIComponent(topic)}`),

  getAllTopics: () =>
    get<{ topics: Record<string, { value: number; timestamp: number }> }>(
      '/api/attention'
    ),

  getHistory: (topic: string, hours = 24) =>
    get<TopicHistory>(
      `/api/attention/${encodeURIComponent(topic)}/history?hours=${hours}`
    ),
};
