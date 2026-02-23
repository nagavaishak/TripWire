'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, Youtube, Zap } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchScores() {
  const res = await fetch(`${API}/api/attention`);
  if (!res.ok) throw new Error('Failed to fetch scores');
  return res.json();
}

async function fetchHistory(topic: string) {
  const res = await fetch(`${API}/api/attention/${encodeURIComponent(topic)}/history?hours=24`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

function DoABar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-muted rounded-full h-2 mt-3">
      <div
        className="h-2 rounded-full bg-primary transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SparkLine({ data }: { data: { time: number; value: number }[] }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 200, H = 40;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 mt-2 opacity-60">
      <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
}

function TopicCard({ topic, score, timestamp }: { topic: string; score: number; timestamp: number }) {
  const { data: histData } = useQuery({
    queryKey: ['history', topic],
    queryFn: () => fetchHistory(topic),
    refetchInterval: 300000,
  });

  const history: { time: number; value: number }[] = histData?.data || [];
  const age = timestamp ? Math.floor((Date.now() / 1000 - timestamp) / 60) : null;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{topic}</CardTitle>
        <Badge variant="outline" className="text-xs">
          {age !== null ? `${age}m ago` : '—'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-4xl font-bold tabular-nums">{score.toFixed(1)}</span>
            <span className="text-muted-foreground text-sm ml-1">DoA</span>
          </div>
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
        </div>
        <DoABar value={score} max={100} />
        <SparkLine data={history} />
        <p className="text-xs text-muted-foreground mt-2">
          {history.length > 0 ? `${history.length} data points (24h)` : 'Building history…'}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['attention-scores'],
    queryFn: fetchScores,
    refetchInterval: 300000, // re-fetch every 5 min
  });

  const topics: Record<string, { value: number; timestamp: number }> = data?.topics || {};
  const topicList = Object.entries(topics).sort((a, b) => b[1].value - a[1].value);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Attention Markets</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-green-500" />
            <span>Oracle live · updates every 5 min</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tagline */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Dollar of Attention Index</h2>
          <p className="text-muted-foreground text-sm">
            Real-time attention scores (0–100) derived from YouTube engagement · feeds on-chain Switchboard oracle
          </p>
        </div>

        {/* Score cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : isError ? (
          <Card className="border-destructive/50 mb-8">
            <CardContent className="py-8 text-center text-muted-foreground">
              Could not reach oracle backend at <code className="text-xs">{API}</code>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {topicList.map(([topic, { value, timestamp }]) => (
              <TopicCard key={topic} topic={topic} score={value} timestamp={timestamp} />
            ))}
          </div>
        )}

        {/* Data source */}
        <div className="border rounded-lg p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
            <Youtube className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium">YouTube Data API v3</p>
            <p className="text-xs text-muted-foreground">50 videos · view-weighted engagement · 7-day window</p>
          </div>
          <Badge variant="outline" className="ml-auto text-green-600 border-green-500/30 bg-green-500/10">
            Live
          </Badge>
        </div>

        {/* API reference */}
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Oracle endpoints</p>
          <p><code className="bg-muted px-1 rounded">{API}/api/attention</code> — all topics</p>
          <p><code className="bg-muted px-1 rounded">{API}/api/attention/Solana</code> — latest score</p>
          <p><code className="bg-muted px-1 rounded">{API}/api/attention/Solana/history?hours=24</code> — time series</p>
        </div>

        {dataUpdatedAt > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            UI last fetched: {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  );
}
