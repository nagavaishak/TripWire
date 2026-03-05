const ORACLE_URL =
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  'https://attention-markets-api.onrender.com';

export interface TAIBreakdown {
  level:     number; // 0-1, raw attention level (EI)
  momentum:  number; // 0-1, 0.5=neutral, >0.5=rising
  velocity:  number; // 0-1, 0.5=neutral, >0.5=accelerating
  consensus: number; // 0-1, fraction of sources with real signal
  score:     number; // 0-1, composite TAI before ×100
}

export interface TopicScore {
  value:     number;   // 0–100 DoA score (backward-compatible)
  timestamp: number;   // unix seconds
  topic:     string;
  tai?:      TAIBreakdown | null;
  sources:   string[];
  weights:   { youtube: number; google_trends: number; farcaster: number };
}

export interface HistoryPoint {
  time:  number;
  value: number;
  components: { youtube: number; google_trends: number; farcaster: number };
  tai?:  TAIBreakdown | null;
}

export interface TopicHistory {
  topic:   string;
  hours:   number;
  sources: string[];
  data:    HistoryPoint[];
}

export interface Narrative {
  keyword:     string;
  source:      string;
  growth:      number;
  status:      'emerging' | 'trending' | 'fading' | 'dead';
  detected_at: string;
}

export interface TopicMeta {
  id:           number;
  name:         string;
  slug:         string;
  status:       'active' | 'inactive';
  doa:          number | null;
  tai_score:    number | null;
  last_updated: string | null;
}

export interface NarrativesResponse {
  narratives:   Narrative[];
  generated_at: string;
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
    get<{ topics: Record<string, { value: number; timestamp: number; tai_score: number | null }> }>(
      '/api/attention'
    ),

  getHistory: (topic: string, hours = 24) =>
    get<TopicHistory>(
      `/api/attention/${encodeURIComponent(topic)}/history?hours=${hours}`
    ),

  getNarratives: (topic?: string) =>
    topic
      ? get<{ topic: string; narratives: Narrative[] }>(`/api/narratives/${encodeURIComponent(topic)}`)
      : get<NarrativesResponse>('/api/narratives'),

  getGlobalNarratives: () =>
    get<NarrativesResponse>('/api/narratives/global'),

  getTopics: () =>
    get<{ topics: TopicMeta[] }>('/api/topics'),
};
